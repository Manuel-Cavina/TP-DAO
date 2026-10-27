from datetime import datetime
from typing import Any

from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.control_precinto import Control_Precinto
from modules.logistica.domain.evento_trazabilidad import Evento_Trazabilidad
from modules.logistica.domain.exceptions import (
    Bulto_No_Encontrado_Exception,
    Motivo_Rechazo_Requerido_Exception,
    Remito_No_Encontrado_Exception,
    Transicion_Estado_Invalida_Exception,
)
from modules.logistica.domain.remito import Remito
from modules.logistica.dto.logistica_dtos import Item_Control_Bulto_Request_DTO
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.control_precinto_repository import Control_Precinto_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository
from modules.logistica.infrastructure.precinto_repository import Precinto_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository
from modules.logistica.infrastructure.trazabilidad_repository import Trazabilidad_Repository


class Recepcion_Service:
    """Caso de uso para recepcion, verificacion fisica de precintos y cierre de remito con impacto en stock (P6, V1, US5)."""

    def __init__(
        self,
        stock_service: Stock_Service_Contract,
        remito_repository: Remito_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        precinto_repository: Precinto_Repository | None = None,
        control_precinto_repository: Control_Precinto_Repository | None = None,
        trazabilidad_repository: Trazabilidad_Repository | None = None,
    ) -> None:
        self._stock_service = stock_service
        self._bulto_repository = bulto_repository if bulto_repository is not None else Bulto_Repository()
        self._remito_repository = (
            remito_repository if remito_repository is not None else Remito_Repository(self._bulto_repository)
        )
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._precinto_repository = (
            precinto_repository if precinto_repository is not None else Precinto_Repository()
        )
        self._control_precinto_repository = (
            control_precinto_repository
            if control_precinto_repository is not None
            else Control_Precinto_Repository()
        )
        self._trazabilidad_repository = (
            trazabilidad_repository
            if trazabilidad_repository is not None
            else Trazabilidad_Repository()
        )

    def recibir_remito(self, remito_numero: str) -> Remito:
        """Registra la llegada de mercaderia en la sucursal y pasa los bultos a RECIBIDO."""
        remito = self._obtener_remito(remito_numero)
        remito.recibir()
        self._remito_repository.actualizar(remito)
        for b in remito.bultos:
            self._bulto_repository.actualizar(b, remito.numero)
        return remito

    def verificar_bulto(
        self,
        bulto_id: int,
        codigo_precinto_recibido: str | None = None,
        esta_intacto: bool = True,
        codigo_esperado: str | None = None,
        codigo_leido: str | None = None,
        resultado_precinto: str | None = None,
        motivo_rechazo: str = "",
        actor: str = "Operador",
        ubicacion_id: int | None = None,
        version: int = 1,
    ) -> Bulto:
        """Verifica fisicamente el precinto de un bulto recibido transicionando a VERIFICADO o RECHAZADO (US5 / T056, T057)."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")

        leido = (codigo_leido if codigo_leido is not None else (codigo_precinto_recibido or "")).strip()

        if codigo_esperado is not None:
            esperado = codigo_esperado.strip()
        elif bulto.precinto is not None:
            esperado = bulto.precinto.codigo.strip()
        else:
            esperado = ""

        if resultado_precinto is not None:
            intacto = resultado_precinto.strip().upper() == "INTACTO"
        else:
            intacto = bool(esta_intacto)

        es_rechazo = (not intacto) or (esperado != leido) or (not esperado)
        es_flujo_enriquecido = (
            codigo_leido is not None or resultado_precinto is not None or codigo_esperado is not None
        )

        if es_rechazo and es_flujo_enriquecido and not motivo_rechazo.strip():
            raise Motivo_Rechazo_Requerido_Exception(
                "Es obligatorio registrar un motivo de rechazo para precintos violados o no coincidentes."
            )

        motivo_final = motivo_rechazo.strip()
        if es_rechazo and not motivo_final:
            motivo_final = (
                f"Codigo no coincide (esperado: {esperado}, leido: {leido})"
                if esperado != leido
                else "Precinto violado al arribo"
            )

        bulto.verificar(leido, intacto)
        self._bulto_repository.actualizar(bulto)

        precinto = bulto.precinto
        if not intacto and precinto is not None and precinto.codigo == leido:
            precinto.romper()
            self._precinto_repository.actualizar(precinto)

        resultado_control = "VERIFICADO" if bulto.estado.nombre == "VERIFICADO" else "RECHAZADO"

        control = Control_Precinto(
            bulto_id=bulto.id,
            codigo_esperado=esperado,
            codigo_leido=leido,
            resultado=resultado_control,
            motivo_rechazo=motivo_final if resultado_control == "RECHAZADO" else "",
            actor=actor or "Operador",
            ubicacion_id=ubicacion_id,
            version_bulto=version,
        )
        self._control_precinto_repository.guardar(control)

        motivo_evento = (
            motivo_final if resultado_control == "RECHAZADO" else f"Control precinto {leido} OK"
        )
        evento = Evento_Trazabilidad(
            tipo_entidad="BULTO",
            entidad_id=bulto.id,
            accion="CONTROL_PRECINTO",
            estado_anterior="RECIBIDO",
            estado_nuevo=bulto.estado.nombre,
            actor=actor or "Operador",
            destino_id=ubicacion_id,
            registros_asociados=f"control_id:{control.id}",
            motivo_o_evidencia=motivo_evento,
            fecha_hora=datetime.now(),
        )
        self._trazabilidad_repository.guardar(evento)

        return bulto

    def controlar_bultos_batch(
        self,
        remito_numero: str,
        items: list[Item_Control_Bulto_Request_DTO],
        actor: str,
        ubicacion_id: int | None = None,
    ) -> dict[str, Any]:
        """Procesa el control físico de precintos para un lote de bultos de un remito de forma atómica (US5 / T057)."""
        remito = self._obtener_remito(remito_numero)
        bultos_remito = {b.id: b for b in remito.bultos if b.id is not None}

        # 1. Validar primero que ningún ítem rechazado carezca de motivo (validación atómica previa)
        for item in items:
            intacto = item.resultado.strip().upper() == "INTACTO"
            coincide = item.codigo_esperado.strip() == item.codigo_leido.strip()
            if (not intacto or not coincide) and not item.motivo_rechazo.strip():
                raise Motivo_Rechazo_Requerido_Exception(
                    f"Es obligatorio registrar un motivo de rechazo para el bulto {item.bulto_id} con precinto violado o no coincidente."
                )

        # 2. Validar precondiciones de pertenencia y estado en el remito
        for item in items:
            if item.bulto_id not in bultos_remito:
                raise Transicion_Estado_Invalida_Exception(
                    f"El bulto con ID {item.bulto_id} no pertenece al remito '{remito_numero}'."
                )

            bulto = bultos_remito[item.bulto_id]
            if bulto.estado.nombre != "RECIBIDO":
                raise Transicion_Estado_Invalida_Exception(
                    f"El bulto {bulto.id} está en estado '{bulto.estado.nombre}' y no puede ser controlado (se requiere RECIBIDO)."
                )

        verificados = 0
        rechazados = 0
        resultados: list[dict[str, Any]] = []

        destino_final = ubicacion_id or remito.destino_id

        for item in items:
            bulto_controlado = self.verificar_bulto(
                bulto_id=item.bulto_id,
                codigo_esperado=item.codigo_esperado,
                codigo_leido=item.codigo_leido,
                resultado_precinto=item.resultado,
                motivo_rechazo=item.motivo_rechazo,
                actor=actor,
                ubicacion_id=destino_final,
                version=item.version,
            )

            es_verificado = bulto_controlado.estado.nombre == "VERIFICADO"
            if es_verificado:
                verificados += 1
            else:
                rechazados += 1

            resultados.append(
                {
                    "bulto_id": item.bulto_id,
                    "resultado": "VERIFICADO" if es_verificado else "RECHAZADO",
                    "estado_bulto": bulto_controlado.estado.nombre,
                    "motivo_rechazo": item.motivo_rechazo if not es_verificado else "",
                }
            )

        return {
            "remito_numero": remito.numero,
            "total_controlados": len(items),
            "verificados": verificados,
            "rechazados": rechazados,
            "resultados": resultados,
        }

    def cerrar_remito(self, remito_numero: str) -> dict[str, Any]:
        """Cierra el remito tras verificar todos los bultos e impacta stock vendible o merma (V1)."""
        remito = self._obtener_remito(remito_numero)
        remito.cerrar()
        self._remito_repository.actualizar(remito)

        unidades_acreditadas = unidades_merma = bultos_verificados = bultos_rechazados = 0
        for bulto in remito.bultos:
            if bulto.estado.nombre == "VERIFICADO":
                bultos_verificados += 1
                for det in bulto.detalles:
                    self._stock_service.acreditar_verificado(det.producto_id, remito.destino_id, det.cantidad)
                    unidades_acreditadas += det.cantidad
            else:
                bultos_rechazados += 1
                for det in bulto.detalles:
                    self._stock_service.registrar_merma(det.producto_id, remito.destino_id, det.cantidad)
                    unidades_merma += det.cantidad

        orden_id = remito.orden_id or (remito.bultos[0].orden_id if remito.bultos else None)
        if orden_id is not None:
            self._cerrar_orden_si_corresponde(orden_id)
        return {
            "remito_numero": remito.numero,
            "estado": remito.estado,
            "bultos_verificados": bultos_verificados,
            "bultos_rechazados": bultos_rechazados,
            "unidades_acreditadas": unidades_acreditadas,
            "unidades_merma": unidades_merma,
        }

    def obtener_remito(self, remito_numero: str) -> Remito:
        """Recupera un remito por su número garantizando su existencia."""
        return self._obtener_remito(remito_numero)

    def obtener_destino_bulto(self, bulto_id: int) -> int | None:
        """Consulta el bulto y su remito asignado en repositorios internos devolviendo destino_id."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            return None
        remito_numero = self._bulto_repository.remito_asignado(bulto_id)
        if remito_numero:
            remito = self._remito_repository.obtener_por_numero(remito_numero)
            if remito is not None:
                return remito.destino_id
        orden = self._orden_repository.obtener_por_id(bulto.orden_id)
        if orden is not None:
            return orden.destino_id
        return None

    def _obtener_remito(self, remito_numero: str) -> Remito:
        remito = self._remito_repository.obtener_por_numero(remito_numero)
        if remito is None:
            raise Remito_No_Encontrado_Exception(f"No se encontro el remito con numero '{remito_numero}'.")
        return remito

    def _cerrar_orden_si_corresponde(self, orden_id: int) -> None:
        """La orden se cierra cuando ya fue despachada y todos los remitos de sus bultos estan cerrados."""
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None or orden.estado != "DESPACHADA":
            return
        bultos = self._bulto_repository.listar_por_orden(orden_id)
        remitos = {self._bulto_repository.remito_asignado(b.id) for b in bultos}
        if None in remitos or any(self._remito_repository.estado(n) != "CERRADO" for n in remitos):
            return
        orden.cerrar()
        self._orden_repository.actualizar(orden)

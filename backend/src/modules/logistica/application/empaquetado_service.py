from typing import Any

from modules.logistica.application.stock_service_contract import Stock_Service_Contract
from modules.logistica.domain.aprobacion_bulto import Aprobacion_Bulto
from modules.logistica.domain.bulto import Bulto
from modules.logistica.domain.detalle_bulto import Detalle_Bulto
from modules.logistica.domain.evento_trazabilidad import Evento_Trazabilidad
from modules.logistica.domain.exceptions import (
    Bulto_Invalido_Exception,
    Bulto_No_Encontrado_Exception,
    Bulto_Vacio_Exception,
    Bulto_Ya_Aprobado_Exception,
    Orden_Invalida_Exception,
    Orden_No_Encontrada_Exception,
    Precinto_Duplicado_Exception,
    Precinto_Invalido_Exception,
    Remito_Duplicado_Exception,
    Remito_Incompleto_Exception,
    Transicion_Estado_Invalida_Exception,
)
from modules.logistica.domain.orden_reposicion import Orden_Reposicion
from modules.logistica.domain.precinto import Precinto
from modules.logistica.domain.remito import Remito
from modules.logistica.infrastructure.aprobacion_bulto_repository import (
    Aprobacion_Bulto_Repository,
)
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import (
    Orden_Reposicion_Repository,
)
from modules.logistica.infrastructure.precinto_repository import Precinto_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository
from modules.logistica.infrastructure.trazabilidad_repository import (
    Trazabilidad_Repository,
)


class Empaquetado_Service:
    """Caso de uso para empaquetado de mercaderia, asignacion de precintos, aprobacion y remito unico (P4 / US4)."""

    def __init__(
        self,
        stock_service: Stock_Service_Contract,
        bulto_repository: Bulto_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        precinto_repository: Precinto_Repository | None = None,
        remito_repository: Remito_Repository | None = None,
        aprobacion_repository: Aprobacion_Bulto_Repository | None = None,
        trazabilidad_repository: Trazabilidad_Repository | None = None,
    ) -> None:
        self._stock_service = stock_service
        self._bulto_repository = bulto_repository if bulto_repository is not None else Bulto_Repository()
        self._orden_repository = (
            orden_repository if orden_repository is not None else Orden_Reposicion_Repository()
        )
        self._precinto_repository = (
            precinto_repository if precinto_repository is not None else Precinto_Repository()
        )
        self._remito_repository = (
            remito_repository if remito_repository is not None else Remito_Repository(self._bulto_repository)
        )
        self._aprobacion_repository = (
            aprobacion_repository
            if aprobacion_repository is not None
            else Aprobacion_Bulto_Repository()
        )
        self._trazabilidad_repository = (
            trazabilidad_repository
            if trazabilidad_repository is not None
            else Trazabilidad_Repository()
        )

    def registrar_precinto(self, codigo: str) -> Precinto:
        """Da de alta un precinto nuevo en la base de datos."""
        precinto = Precinto(codigo=codigo, esta_intacto=True)
        if self._precinto_repository.obtener_por_codigo(precinto.codigo) is not None:
            raise Precinto_Duplicado_Exception(f"El precinto '{precinto.codigo}' ya esta registrado.")
        self._precinto_repository.guardar(precinto)
        return precinto

    def crear_bulto(self, orden_id: int, items: list[dict[str, Any]]) -> Bulto:
        """Arma un bulto en preparacion reservando el stock del Centro de Distribucion."""
        if not items:
            raise Bulto_Vacio_Exception("No se puede armar un bulto sin items.")
        productos = [item["producto_id"] for item in items]
        if len(set(productos)) != len(productos):
            raise Bulto_Invalido_Exception("Un producto no puede aparecer dos veces en el mismo bulto.")

        orden = self._obtener_orden(orden_id)
        if orden.estado == "PENDIENTE":
            orden.iniciar_preparacion()
        if orden.estado != "EN_PREPARACION":
            raise Orden_Invalida_Exception(
                f"No se pueden armar bultos para una orden en estado '{orden.estado}'."
            )

        detalles_bulto: list[Detalle_Bulto] = []
        for item in items:
            producto_id, cantidad = item["producto_id"], item["cantidad"]
            detalle_orden = orden.buscar_detalle(producto_id)
            if detalle_orden is None:
                raise Orden_Invalida_Exception(
                    f"El producto '{producto_id}' no forma parte de la orden de reposicion."
                )
            detalle_orden.registrar_envio(cantidad)
            self._stock_service.reservar_para_despacho(producto_id, orden.origen_id, cantidad)
            detalles_bulto.append(Detalle_Bulto(producto_id=producto_id, cantidad=cantidad))

        bulto = self._bulto_repository.guardar(Bulto(orden_id=orden_id, detalles=detalles_bulto))
        self._orden_repository.actualizar(orden)
        return bulto

    def precintar_bulto(self, bulto_id: int, codigo_precinto: str) -> Bulto:
        """Asigna un precinto valido al bulto y transiciona a PRECINTADO."""
        bulto = self.obtener_bulto(bulto_id)
        codigo_limpio = codigo_precinto.strip() if codigo_precinto else ""
        if not self._precinto_repository.esta_disponible(codigo_limpio):
            raise Precinto_Invalido_Exception(
                f"El precinto '{codigo_limpio}' no existe, no esta disponible o ya fue utilizado."
            )
        precinto = self._precinto_repository.obtener_por_codigo(codigo_limpio)
        if precinto is None:
            raise Precinto_Invalido_Exception(f"Precinto '{codigo_limpio}' inexistente.")

        bulto.precintar(precinto)
        self._bulto_repository.actualizar(bulto)
        self._precinto_repository.marcar_utilizado(codigo_limpio)
        return bulto

    def precintar_bultos_lote(
        self, orden_id: int, items: list[dict[str, Any]]
    ) -> list[Bulto]:
        """Precinta de forma atómica una lista revisada de bultos (US4 / T044).

        Valida duplicados y disponibilidad de precintos antes de aplicar cambios: todos o ninguno.
        """
        self._obtener_orden(orden_id)
        if not items:
            raise Bulto_Invalido_Exception("La lista de bultos para precintar no puede estar vacia.")

        bulto_ids = [it["bulto_id"] for it in items]
        if len(set(bulto_ids)) != len(bulto_ids):
            raise Bulto_Invalido_Exception(
                "No se puede asignar precinto al mismo bulto mas de una vez en el lote."
            )

        codigos = [it["codigo_precinto"].strip() for it in items]
        if len(set(codigos)) != len(codigos):
            raise Precinto_Duplicado_Exception(
                "No se puede utilizar el mismo codigo de precinto mas de una vez en el lote."
            )

        # Validación previa completa (atomicidad)
        pares_validados: list[tuple[Bulto, Precinto]] = []
        for it in items:
            bid = it["bulto_id"]
            codigo = it["codigo_precinto"].strip()
            bulto = self.obtener_bulto(bid)

            if bulto.orden_id != orden_id:
                raise Bulto_Invalido_Exception(f"El bulto {bid} no pertenece a la orden {orden_id}.")
            if bulto.estado.nombre != "PREPARADO":
                raise Transicion_Estado_Invalida_Exception(
                    f"El bulto {bid} esta en estado '{bulto.estado.nombre}', debe estar PREPARADO."
                )
            if not bulto.detalles:
                raise Bulto_Vacio_Exception(f"El bulto {bid} no tiene contenido.")

            if not self._precinto_repository.esta_disponible(codigo):
                raise Precinto_Invalido_Exception(
                    f"El precinto '{codigo}' no existe, no esta disponible o ya fue utilizado."
                )
            precinto = self._precinto_repository.obtener_por_codigo(codigo)
            if precinto is None:
                raise Precinto_Invalido_Exception(f"Precinto '{codigo}' inexistente.")

            pares_validados.append((bulto, precinto))

        # Aplicación garantizada para todos
        actualizados: list[Bulto] = []
        for bulto, precinto in pares_validados:
            bulto.precintar(precinto)
            self._bulto_repository.actualizar(bulto)
            self._precinto_repository.marcar_utilizado(precinto.codigo)
            actualizados.append(bulto)

        return actualizados

    def aprobar_bulto(
        self, bulto_id: int, actor: str | None = None, observacion: str = ""
    ) -> Bulto:
        """Aprueba un bulto precintado si está completo y no fue aprobado previamente (US4 / T042, T043)."""
        bulto = self.obtener_bulto(bulto_id)
        if bulto.estado.nombre != "PRECINTADO":
            raise Transicion_Estado_Invalida_Exception(
                f"El bulto {bulto_id} no esta en estado PRECINTADO (estado actual: {bulto.estado.nombre})."
            )
        if not bulto.precinto or not bulto.precinto.codigo:
            raise Precinto_Invalido_Exception(f"El bulto {bulto_id} no tiene precinto asignado.")
        if not bulto.detalles or sum(d.cantidad for d in bulto.detalles) <= 0:
            raise Bulto_Vacio_Exception(f"El bulto {bulto_id} no tiene contenido.")
        if self._aprobacion_repository.esta_aprobado(bulto_id):
            raise Bulto_Ya_Aprobado_Exception(f"El bulto {bulto_id} ya fue aprobado previamente.")

        aprobacion = Aprobacion_Bulto(
            bulto_id=bulto_id,
            actor=actor or "Operador",
            observacion=observacion or "Aprobacion conforme para remito",
        )
        self._aprobacion_repository.guardar(aprobacion)
        bulto.registrar_aprobacion(aprobacion)

        evento = Evento_Trazabilidad(
            tipo_entidad="BULTO",
            entidad_id=bulto_id,
            accion="APROBACION",
            estado_anterior=bulto.estado.nombre,
            estado_nuevo=bulto.estado.nombre,
            actor=actor or "Operador",
            motivo_o_evidencia=observacion or "Aprobacion conforme para remito",
            registros_asociados=f"ORDEN:{bulto.orden_id}",
        )
        self._trazabilidad_repository.guardar(evento)
        return bulto

    def aprobar_bultos_elegibles(
        self, orden_id: int, actor: str | None = None, observacion: str = ""
    ) -> dict[str, Any]:
        """Evalúa todos los bultos de una orden; aprueba los elegibles y reporta bloqueados con motivo (US4 / T043)."""
        self._obtener_orden(orden_id)
        bultos = self._bulto_repository.listar_por_orden(orden_id)
        approved: list[int] = []
        blocked: list[dict[str, Any]] = []

        for b in bultos:
            if b.id is None:
                continue
            if b.estado.nombre != "PRECINTADO":
                blocked.append({
                    "id": b.id,
                    "motivo": f"El bulto no esta en estado PRECINTADO (estado actual: {b.estado.nombre})",
                })
            elif not b.precinto or not b.precinto.codigo:
                blocked.append({
                    "id": b.id,
                    "motivo": "El bulto no tiene precinto asignado",
                })
            elif not b.detalles or sum(d.cantidad for d in b.detalles) <= 0:
                blocked.append({
                    "id": b.id,
                    "motivo": "El bulto no tiene contenido",
                })
            elif self._aprobacion_repository.esta_aprobado(b.id):
                blocked.append({
                    "id": b.id,
                    "motivo": "El bulto ya fue aprobado previamente",
                })
            else:
                aprobacion = Aprobacion_Bulto(
                    bulto_id=b.id,
                    actor=actor or "Operador",
                    observacion=observacion or "Aprobacion en lote elegible",
                )
                self._aprobacion_repository.guardar(aprobacion)
                b.registrar_aprobacion(aprobacion)

                evento = Evento_Trazabilidad(
                    tipo_entidad="BULTO",
                    entidad_id=b.id,
                    accion="APROBACION",
                    estado_anterior=b.estado.nombre,
                    estado_nuevo=b.estado.nombre,
                    actor=actor or "Operador",
                    motivo_o_evidencia=observacion or "Aprobacion en lote elegible",
                    registros_asociados=f"ORDEN:{orden_id}",
                )
                self._trazabilidad_repository.guardar(evento)
                approved.append(b.id)

        return {"approved": approved, "blocked": blocked}

    def generar_remito(
        self,
        numero: str,
        orden_id: int,
        bultos_ids: list[int] | None = None,
        validar_aprobacion: bool = False,
    ) -> Remito:
        """Genera el remito para una orden de reposicion (US4 / T047, T049).

        Si validar_aprobacion es True (modo estricto US4):
        - Una orden tiene como maximo UN solo remito.
        - Cantidades empaquetadas deben igualar a las cantidades solicitadas en la orden.
        - El remito debe incluir TODOS los bultos de la orden.
        - Todos los bultos deben estar PRECINTADOS y APROBADOS.

        Si validar_aprobacion es False (modo compatibilidad):
        - Bultos deben pertenecer a la orden, estar precintados y no estar en otro remito.
        """
        if self._remito_repository.existe(numero):
            raise Remito_Duplicado_Exception(f"Ya existe un remito con numero '{numero.strip()}'.")

        orden = self._obtener_orden(orden_id)

        if validar_aprobacion:
            if self._remito_repository.existe_para_orden(orden_id):
                raise Remito_Duplicado_Exception(
                    f"La orden {orden_id} ya posee un remito emitido. No se permite un segundo remito."
                )
            if not orden.esta_completamente_enviada:
                raise Remito_Incompleto_Exception(
                    "Las cantidades empaquetadas deben igualar a las cantidades solicitadas en la orden."
                )

            bultos_orden = self._bulto_repository.listar_por_orden(orden_id)
            if not bultos_orden:
                raise Remito_Incompleto_Exception(
                    "La orden no tiene bultos armados para emitir remito."
                )

            bultos_orden_ids = {b.id for b in bultos_orden if b.id is not None}
            if bultos_ids is not None:
                if len(set(bultos_ids)) != len(bultos_ids):
                    raise Remito_Incompleto_Exception("El remito no puede incluir el mismo bulto dos veces.")
                if set(bultos_ids) != bultos_orden_ids:
                    raise Remito_Incompleto_Exception(
                        "El remito debe incluir todos los bultos de la orden (no se admiten remitos parciales)."
                    )

            for b in bultos_orden:
                if b.id is None:
                    continue
                if b.estado.nombre != "PRECINTADO":
                    raise Remito_Incompleto_Exception(
                        f"El bulto {b.id} esta en estado '{b.estado.nombre}', debe estar PRECINTADO."
                    )
                if not self._aprobacion_repository.esta_aprobado(b.id):
                    raise Remito_Incompleto_Exception(
                        f"El bulto {b.id} debe contar con evidencia inmutable de aprobacion antes de emitir el remito."
                    )

            remito = Remito(
                numero=numero,
                origen_id=orden.origen_id,
                destino_id=orden.destino_id,
                bultos=bultos_orden,
                orden_id=orden.id,
            )
            return self._remito_repository.guardar(remito)
        else:
            if not bultos_ids:
                raise Remito_Incompleto_Exception("El remito debe incluir al menos un bulto.")
            if len(set(bultos_ids)) != len(bultos_ids):
                raise Remito_Incompleto_Exception("El remito no puede incluir el mismo bulto dos veces.")

            bultos = [self._bulto_para_remito(bid, orden_id) for bid in bultos_ids]
            remito = Remito(
                numero=numero,
                origen_id=orden.origen_id,
                destino_id=orden.destino_id,
                bultos=bultos,
                orden_id=orden.id,
            )
            return self._remito_repository.guardar(remito)

    def _bulto_para_remito(self, bulto_id: int, orden_id: int) -> Bulto:
        bulto = self.obtener_bulto(bulto_id)
        if bulto.orden_id != orden_id:
            raise Remito_Incompleto_Exception(f"El bulto {bulto_id} no pertenece a la orden {orden_id}.")
        remito_actual = self._bulto_repository.remito_asignado(bulto_id)
        if remito_actual is not None:
            raise Remito_Incompleto_Exception(
                f"El bulto {bulto_id} ya forma parte del remito '{remito_actual}'."
            )
        if bulto.estado.nombre != "PRECINTADO":
            raise Remito_Incompleto_Exception(
                f"El bulto {bulto_id} esta en estado '{bulto.estado.nombre}', debe estar PRECINTADO."
            )
        return bulto

    def obtener_bulto(self, bulto_id: int) -> Bulto:
        """Obtiene un bulto por su identificador."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")
        return bulto

    def listar_bultos_por_orden(self, orden_id: int) -> list[Bulto]:
        """Lista los bultos pertenecientes a una orden."""
        self._obtener_orden(orden_id)
        return self._bulto_repository.listar_por_orden(orden_id)

    def _obtener_orden(self, orden_id: int) -> Orden_Reposicion:
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_No_Encontrada_Exception(f"No se encontro la orden {orden_id}.")
        return orden

    def _bulto_para_remito(self, bulto_id: int, orden_id: int) -> Bulto:
        bulto = self.obtener_bulto(bulto_id)
        if bulto.orden_id != orden_id:
            raise Remito_Incompleto_Exception(f"El bulto {bulto_id} no pertenece a la orden {orden_id}.")
        remito_actual = self._bulto_repository.remito_asignado(bulto_id)
        if remito_actual is not None:
            raise Remito_Incompleto_Exception(
                f"El bulto {bulto_id} ya forma parte del remito '{remito_actual}'."
            )
        if bulto.estado.nombre != "PRECINTADO":
            raise Remito_Incompleto_Exception(
                f"El bulto {bulto_id} esta en estado '{bulto.estado.nombre}', debe estar PRECINTADO."
            )
        return bulto

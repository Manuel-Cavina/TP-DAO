from datetime import datetime
from typing import Any

from modules.logistica.domain.evento_trazabilidad import Evento_Trazabilidad
from modules.logistica.domain.exceptions import (
    Bulto_No_Encontrado_Exception,
    Orden_No_Encontrada_Exception,
    Remito_No_Encontrado_Exception,
)
from modules.logistica.domain.historial_bulto import Historial_Bulto
from modules.logistica.infrastructure.bulto_repository import Bulto_Repository
from modules.logistica.infrastructure.control_precinto_repository import Control_Precinto_Repository
from modules.logistica.infrastructure.historial_bulto_repository import Historial_Bulto_Repository
from modules.logistica.infrastructure.orden_reposicion_repository import Orden_Reposicion_Repository
from modules.logistica.infrastructure.remito_repository import Remito_Repository
from modules.logistica.infrastructure.trazabilidad_repository import Trazabilidad_Repository


class Trazabilidad_Service:
    """Caso de uso para consulta y registro de trazabilidad inmutable y auditoria logística (V2/US3, US5)."""

    def __init__(
        self,
        historial_repository: Historial_Bulto_Repository | None = None,
        bulto_repository: Bulto_Repository | None = None,
        trazabilidad_repository: Trazabilidad_Repository | None = None,
        orden_repository: Orden_Reposicion_Repository | None = None,
        remito_repository: Remito_Repository | None = None,
        control_precinto_repository: Control_Precinto_Repository | None = None,
    ) -> None:
        self._historial_repository = (
            historial_repository
            if historial_repository is not None
            else Historial_Bulto_Repository()
        )
        self._bulto_repository = (
            bulto_repository if bulto_repository is not None else Bulto_Repository()
        )
        self._trazabilidad_repository = (
            trazabilidad_repository
            if trazabilidad_repository is not None
            else Trazabilidad_Repository()
        )
        self._orden_repository = (
            orden_repository
            if orden_repository is not None
            else Orden_Reposicion_Repository()
        )
        self._remito_repository = (
            remito_repository
            if remito_repository is not None
            else Remito_Repository(self._bulto_repository)
        )
        self._control_precinto_repository = (
            control_precinto_repository
            if control_precinto_repository is not None
            else Control_Precinto_Repository()
        )

    def registrar_evento(self, evento: Evento_Trazabilidad) -> Evento_Trazabilidad:
        """Persiste un nuevo evento de trazabilidad inmutable."""
        return self._trazabilidad_repository.guardar(evento)

    def consultar_historial_entidad(
        self, tipo_entidad: str, entidad_id: int
    ) -> list[Evento_Trazabilidad]:
        """Recupera la línea de tiempo inmutable de una entidad."""
        return self._trazabilidad_repository.listar_por_entidad(tipo_entidad, entidad_id)

    def listar_eventos_recientes(self, limite: int = 20) -> list[Evento_Trazabilidad]:
        return self._trazabilidad_repository.listar_recientes(limite)

    def consultar_historial_bulto(
        self, bulto_id: int
    ) -> list[Historial_Bulto]:
        """Obtiene la linea temporal completa e inmutable de eventos de un bulto."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")
        return self._historial_repository.listar_por_bulto(bulto_id)

    def consultar_resumen_trazabilidad(
        self, bulto_id: int
    ) -> dict[str, Any]:
        """Devuelve un resumen con estado actual y el historial completo del bulto."""
        bulto = self._bulto_repository.obtener_por_id(bulto_id)
        if bulto is None:
            raise Bulto_No_Encontrado_Exception(f"No se encontro el bulto con ID {bulto_id}.")
        historial = self._historial_repository.listar_por_bulto(bulto_id)

        return {
            "bulto_id": bulto.id,
            "orden_id": bulto.orden_id,
            "estado_actual": bulto.estado.nombre,
            "codigo_precinto": bulto.precinto.codigo if bulto.precinto else None,
            "total_items": sum(d.cantidad for d in bulto.detalles),
            "eventos": [
                {
                    "estado_anterior": h.estado_anterior,
                    "estado_nuevo": h.estado_nuevo,
                    "fecha_hora": h.fecha_hora.isoformat(),
                    "observacion": h.observacion,
                }
                for h in historial
            ],
        }

    def consultar_resumen_orden(self, orden_id: int) -> dict[str, Any]:
        """Devuelve la trazabilidad completa y resumen de una orden de reposicion."""
        orden = self._orden_repository.obtener_por_id(orden_id)
        if orden is None:
            raise Orden_No_Encontrada_Exception(f"No se encontro la orden con ID {orden_id}.")
        eventos = self._trazabilidad_repository.listar_por_entidad("ORDEN", orden_id)
        return {
            "orden_id": orden.id,
            "origen_id": orden.origen_id,
            "destino_id": orden.destino_id,
            "estado_actual": orden.estado,
            "eventos": [
                {
                    "id": e.id,
                    "tipo_entidad": e.tipo_entidad,
                    "entidad_id": e.entidad_id,
                    "accion": e.accion,
                    "estado_anterior": e.estado_anterior,
                    "estado_nuevo": e.estado_nuevo,
                    "actor": e.actor,
                    "origen_id": e.origen_id,
                    "destino_id": e.destino_id,
                    "registros_asociados": e.registros_asociados,
                    "motivo_o_evidencia": e.motivo_o_evidencia,
                    "fecha_hora": e.fecha_hora.isoformat() if e.fecha_hora else None,
                }
                for e in eventos
            ],
        }

    def buscar_logistica(self, termino: str) -> dict[str, list[dict[str, Any]]]:
        """Busca entidades logisticas por ID o codigo parcial (ordenes, remitos y bultos) (US5 / T061)."""
        termino_limpio = termino.strip().lower()
        if not termino_limpio:
            return {"ordenes": [], "remitos": [], "bultos": []}

        # 1. Ordenes
        ordenes_match: list[dict[str, Any]] = []
        for o in self._orden_repository.listar_todas():
            if (
                str(o.id) == termino_limpio
                or termino_limpio in str(o.id)
                or termino_limpio in o.estado.lower()
            ):
                ordenes_match.append(
                    {
                        "id": o.id,
                        "origen_id": o.origen_id,
                        "destino_id": o.destino_id,
                        "estado": o.estado,
                        "fecha": o.fecha.isoformat() if hasattr(o.fecha, "isoformat") else str(o.fecha),
                    }
                )

        # 2. Remitos
        remitos_match: list[dict[str, Any]] = []
        for r in self._remito_repository.listar_todos():
            if (
                termino_limpio in r.numero.lower()
                or (r.orden_id is not None and str(r.orden_id) == termino_limpio)
                or termino_limpio in r.estado.lower()
            ):
                remitos_match.append(
                    {
                        "numero": r.numero,
                        "orden_id": r.orden_id,
                        "origen_id": r.origen_id,
                        "destino_id": r.destino_id,
                        "estado": r.estado,
                        "fecha_emision": (
                            r.fecha_emision.isoformat()
                            if hasattr(r.fecha_emision, "isoformat")
                            else str(r.fecha_emision)
                        ),
                    }
                )

        # 3. Bultos
        bultos_match: list[dict[str, Any]] = []
        for b in self._bulto_repository.listar_todos():
            id_coincide = str(b.id) == termino_limpio or termino_limpio in str(b.id)
            precinto_coincide = (
                b.precinto is not None and termino_limpio in b.precinto.codigo.lower()
            )
            if id_coincide or precinto_coincide:
                orden_bulto = self._orden_repository.obtener_por_id(b.orden_id)
                bultos_match.append(
                    {
                        "id": b.id,
                        "orden_id": b.orden_id,
                        "estado": b.estado.nombre,
                        "codigo_precinto": b.precinto.codigo if b.precinto else None,
                        "origen_id": orden_bulto.origen_id if orden_bulto else None,
                        "destino_id": orden_bulto.destino_id if orden_bulto else None,
                    }
                )

        return {
            "ordenes": ordenes_match,
            "remitos": remitos_match,
            "bultos": bultos_match,
        }

    def consultar_resumen_remito(self, remito_numero: str) -> dict[str, Any]:
        """Consulta el resumen integral de un remito: bultos, controles de precinto y linea temporal (US5 / T061)."""
        remito = self._remito_repository.obtener_por_numero(remito_numero)
        if remito is None:
            raise Remito_No_Encontrado_Exception(f"No se encontro el remito con numero '{remito_numero}'.")

        bultos = remito.bultos
        bulto_ids = [b.id for b in bultos if b.id is not None]

        controles = self._control_precinto_repository.listar_por_bultos(bulto_ids)
        controles_dict = {c.bulto_id: c for c in controles}

        orden_dict: dict[str, Any] | None = None
        if remito.orden_id is not None:
            orden = self._orden_repository.obtener_por_id(remito.orden_id)
            if orden is not None:
                orden_dict = {
                    "id": orden.id,
                    "origen_id": orden.origen_id,
                    "destino_id": orden.destino_id,
                    "estado": orden.estado,
                    "fecha": orden.fecha.isoformat() if hasattr(orden.fecha, "isoformat") else str(orden.fecha),
                }

        bultos_resumen: list[dict[str, Any]] = []
        for b in bultos:
            ctrl = controles_dict.get(b.id)
            precinto_esperado = (
                b.precinto.codigo
                if b.precinto
                else (ctrl.codigo_esperado if ctrl else None)
            )
            bultos_resumen.append(
                {
                    "id": b.id,
                    "estado": b.estado.nombre,
                    "precinto_esperado": precinto_esperado,
                    "precinto_leido": ctrl.codigo_leido if ctrl else None,
                    "resultado_control": ctrl.resultado if ctrl else None,
                    "motivo_rechazo": ctrl.motivo_rechazo if ctrl else "",
                    "detalles": [
                        {"producto_id": d.producto_id, "cantidad": d.cantidad}
                        for d in b.detalles
                    ],
                }
            )

        controles_resumen: list[dict[str, Any]] = [
            {
                "id": c.id,
                "bulto_id": c.bulto_id,
                "codigo_esperado": c.codigo_esperado,
                "codigo_leido": c.codigo_leido,
                "resultado": c.resultado,
                "motivo_rechazo": c.motivo_rechazo,
                "actor": c.actor,
                "ubicacion_id": c.ubicacion_id,
                "fecha_hora": c.fecha_hora.isoformat() if hasattr(c.fecha_hora, "isoformat") else str(c.fecha_hora),
                "version_bulto": c.version_bulto,
            }
            for c in controles
        ]

        eventos_acumulados: list[Evento_Trazabilidad] = []
        for b_id in bulto_ids:
            eventos_acumulados.extend(
                self._trazabilidad_repository.listar_por_entidad("BULTO", b_id)
            )
        if remito.orden_id is not None:
            eventos_acumulados.extend(
                self._trazabilidad_repository.listar_por_entidad("ORDEN", remito.orden_id)
            )

        eventos_acumulados.sort(
            key=lambda e: (
                e.fecha_hora if e.fecha_hora is not None else datetime.min,
                e.id if e.id is not None else 0,
            )
        )

        eventos_resumen: list[dict[str, Any]] = [
            {
                "id": e.id,
                "tipo_entidad": e.tipo_entidad,
                "entidad_id": e.entidad_id,
                "accion": e.accion,
                "estado_anterior": e.estado_anterior,
                "estado_nuevo": e.estado_nuevo,
                "actor": e.actor,
                "origen_id": e.origen_id,
                "destino_id": e.destino_id,
                "registros_asociados": e.registros_asociados,
                "motivo_o_evidencia": e.motivo_o_evidencia,
                "fecha_hora": e.fecha_hora.isoformat() if hasattr(e.fecha_hora, "isoformat") else str(e.fecha_hora),
            }
            for e in eventos_acumulados
        ]

        return {
            "numero": remito.numero,
            "orden_id": remito.orden_id,
            "origen_id": remito.origen_id,
            "destino_id": remito.destino_id,
            "fecha_emision": (
                remito.fecha_emision.isoformat()
                if hasattr(remito.fecha_emision, "isoformat")
                else str(remito.fecha_emision)
            ),
            "estado": remito.estado,
            "orden": orden_dict,
            "bultos": bultos_resumen,
            "controles_precintos": controles_resumen,
            "eventos_trazabilidad": eventos_resumen,
        }

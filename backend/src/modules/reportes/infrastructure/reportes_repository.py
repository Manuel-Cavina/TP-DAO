"""Consultas de solo lectura que cruzan los módulos para armar los reportes.

Los reportes nunca modifican datos. Las tablas de otros módulos se describen con
`table()`/`column()` de SQLAlchemy: así se consultan sin importar la infraestructura
ajena (regla de dependencias entre módulos) y sin registrar modelos duplicados.
"""

from collections import defaultdict
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import DateTime, Numeric, Select, column, func, select, table
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.reportes.domain import (
    Existencia,
    Merma_Bulto,
    Producto_Vendido,
    Rango_Fechas,
    Tiempo_Transito_Local,
    Ventas_Por_Medio_Pago,
)

# Las columnas de fecha y dinero llevan tipo: así SQLAlchemy devuelve datetime y Decimal
# en lugar del texto crudo que guarda SQLite.
FECHA = DateTime()
DINERO = Numeric(12, 2, asdecimal=True)

_ventas = table("ventas", column("id"), column("local_id"), column("fecha_hora", FECHA))
_comprobantes = table("comprobantes", column("venta_id"), column("medio_pago"), column("total_cobrado", DINERO))
_detalles_venta = table(
    "detalles_venta", column("venta_id"), column("producto_id"), column("cantidad"), column("precio_unitario", DINERO)
)
_devoluciones = table(
    "devoluciones",
    column("id"),
    column("venta_id"),
    column("local_id"),
    column("fecha_hora", FECHA),
    column("medio_pago"),
    column("monto_reintegrado", DINERO),
)
_detalles_devolucion = table(
    "detalles_devolucion", column("devolucion_id"), column("producto_id"), column("cantidad"), column("precio_unitario", DINERO)
)
_productos = table("productos", column("id"), column("codigo"), column("nombre"), column("costo_unitario", DINERO), column("activo"))
_ubicaciones = table("ubicaciones", column("id"), column("nombre"), column("activo"))
_stocks = table(
    "stocks",
    column("producto_id"),
    column("ubicacion_id"),
    column("cantidad_disponible"),
    column("cantidad_en_transito"),
    column("nivel_minimo_existencia"),
)
_bultos = table("bultos", column("id"), column("remito_numero"), column("estado"))
_detalles_bulto = table("detalles_bulto", column("bulto_id"), column("producto_id"), column("cantidad"))
_historial = table("historial_bultos", column("bulto_id"), column("estado_nuevo"), column("fecha_hora", FECHA))
_remitos = table("remitos", column("numero"), column("destino_id"))

CENTAVOS = Decimal("0.01")
SIN_MOVIMIENTO = (0, Decimal("0.00"))


class Reportes_Repository:
    """Lecturas agregadas para los cinco reportes de la consigna."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    # --- Reporte 1: ventas e ingresos por local y medio de pago ---

    def ventas_por_local_y_medio(self, rango: Rango_Fechas, local_id: int | None) -> list[Ventas_Por_Medio_Pago]:
        vendido = self._totales_por_local_y_medio(self._consulta_cobrado(rango, local_id))
        devuelto = self._totales_por_local_y_medio(self._consulta_reintegrado(rango, local_id))
        nombres = self._nombres_ubicaciones()
        claves = sorted(vendido.keys() | devuelto.keys(), key=lambda c: (nombres.get(c[0], ""), c[1]))
        return [
            Ventas_Por_Medio_Pago(
                local, nombres.get(local, f"Local {local}"), medio,
                *vendido.get((local, medio), SIN_MOVIMIENTO),
                *devuelto.get((local, medio), SIN_MOVIMIENTO),
            )
            for local, medio in claves
        ]

    @staticmethod
    def _consulta_cobrado(rango: Rango_Fechas, local_id: int | None) -> Select:
        v, c = _ventas.c, _comprobantes.c
        stmt = (
            select(v.local_id, c.medio_pago, func.count(v.id), func.sum(c.total_cobrado))
            .join(_comprobantes, c.venta_id == v.id)
            .where(v.fecha_hora.between(rango.inicio, rango.fin))
            .group_by(v.local_id, c.medio_pago)
        )
        return stmt.where(v.local_id == local_id) if local_id is not None else stmt

    @staticmethod
    def _consulta_reintegrado(rango: Rango_Fechas, local_id: int | None) -> Select:
        d = _devoluciones.c
        stmt = (
            select(d.local_id, d.medio_pago, func.count(d.id), func.sum(d.monto_reintegrado))
            .where(d.fecha_hora.between(rango.inicio, rango.fin))
            .group_by(d.local_id, d.medio_pago)
        )
        return stmt.where(d.local_id == local_id) if local_id is not None else stmt

    def _totales_por_local_y_medio(self, stmt: Select) -> dict[tuple[int, str], tuple[int, Decimal]]:
        filas = self._get_session().execute(stmt)
        return {(local, medio): (cantidad, _decimal(total)) for local, medio, cantidad, total in filas}

    # --- Reporte 2: productos más vendidos y margen ---

    def productos_vendidos(self, rango: Rango_Fechas) -> list[Producto_Vendido]:
        vendidos = self._unidades_e_ingresos(self._consulta_vendidos(rango))
        devueltos = self._unidades_e_ingresos(self._consulta_devueltos(rango))
        productos = self._datos_productos()
        filas = []
        for producto_id, (unidades, ingresos) in vendidos.items():
            codigo, nombre, costo = productos[producto_id]
            unidades_dev, ingresos_dev = devueltos.get(producto_id, SIN_MOVIMIENTO)
            filas.append(Producto_Vendido(producto_id, codigo, nombre, unidades, unidades_dev, ingresos, ingresos_dev, costo))
        return filas

    @staticmethod
    def _consulta_vendidos(rango: Rango_Fechas) -> Select:
        dv = _detalles_venta.c
        return (
            select(dv.producto_id, func.sum(dv.cantidad), func.sum(dv.cantidad * dv.precio_unitario))
            .join(_ventas, _ventas.c.id == dv.venta_id)
            .where(_ventas.c.fecha_hora.between(rango.inicio, rango.fin))
            .group_by(dv.producto_id)
        )

    @staticmethod
    def _consulta_devueltos(rango: Rango_Fechas) -> Select:
        """Devoluciones de las ventas del período: así las unidades netas cierran con lo vendido."""
        dd = _detalles_devolucion.c
        return (
            select(dd.producto_id, func.sum(dd.cantidad), func.sum(dd.cantidad * dd.precio_unitario))
            .join(_devoluciones, _devoluciones.c.id == dd.devolucion_id)
            .join(_ventas, _ventas.c.id == _devoluciones.c.venta_id)
            .where(_ventas.c.fecha_hora.between(rango.inicio, rango.fin))
            .group_by(dd.producto_id)
        )

    def _unidades_e_ingresos(self, stmt: Select) -> dict[int, tuple[int, Decimal]]:
        filas = self._get_session().execute(stmt)
        return {producto: (int(unidades), _decimal(ingresos)) for producto, unidades, ingresos in filas}

    def _datos_productos(self) -> dict[int, tuple[str, str, Decimal]]:
        p = _productos.c
        filas = self._get_session().execute(select(p.id, p.codigo, p.nombre, p.costo_unitario))
        return {producto_id: (codigo, nombre, _decimal(costo)) for producto_id, codigo, nombre, costo in filas}

    # --- Reporte 3: existencias, mínimo y valorización ---

    def existencias(self, ubicacion_id: int | None) -> list[Existencia]:
        s, p, u = _stocks.c, _productos.c, _ubicaciones.c
        stmt = (
            select(p.id, p.codigo, p.nombre, s.ubicacion_id, u.nombre, s.cantidad_disponible,
                   s.cantidad_en_transito, s.nivel_minimo_existencia, p.costo_unitario)
            .join(_productos, p.id == s.producto_id)
            .join(_ubicaciones, u.id == s.ubicacion_id)
            .where(p.activo.is_(True), u.activo.is_(True))
            .order_by(s.ubicacion_id, p.codigo)
        )
        if ubicacion_id is not None:
            stmt = stmt.where(s.ubicacion_id == ubicacion_id)
        return [Existencia(*fila[:8], costo_unitario=_decimal(fila[8])) for fila in self._get_session().execute(stmt)]

    # --- Reporte 4: bultos rechazados y mermas ---

    def mermas(self, rango: Rango_Fechas, local_id: int | None) -> list[Merma_Bulto]:
        bultos = self._bultos_rechazados(rango, local_id)
        contenido = self._contenido_bultos([bulto[0] for bulto in bultos]) if bultos else {}
        nombres = self._nombres_ubicaciones()
        return [
            Merma_Bulto(
                bulto_id=bulto_id,
                remito_numero=remito,
                local_id=destino,
                local_nombre=nombres.get(destino, f"Local {destino}"),
                fecha_rechazo=fecha.isoformat(),
                unidades_perdidas=sum(cantidad for _, cantidad, _ in contenido[bulto_id]),
                valor_perdido=sum((cantidad * costo for _, cantidad, costo in contenido[bulto_id]), Decimal("0.00")),
                productos=tuple(f"{codigo} x{cantidad}" for codigo, cantidad, _ in contenido[bulto_id]),
            )
            for bulto_id, remito, destino, fecha in bultos
        ]

    def _bultos_rechazados(self, rango: Rango_Fechas, local_id: int | None) -> list[tuple[int, str, int, datetime]]:
        """Bultos en RECHAZADO cuya transición a ese estado ocurrió en el período."""
        b, h, r = _bultos.c, _historial.c, _remitos.c
        stmt = (
            select(b.id, b.remito_numero, r.destino_id, h.fecha_hora)
            .join(_remitos, r.numero == b.remito_numero)
            .join(_historial, (h.bulto_id == b.id) & (h.estado_nuevo == "RECHAZADO"))
            .where(b.estado == "RECHAZADO", h.fecha_hora.between(rango.inicio, rango.fin))
            .order_by(h.fecha_hora)
        )
        if local_id is not None:
            stmt = stmt.where(r.destino_id == local_id)
        return [tuple(fila) for fila in self._get_session().execute(stmt)]

    def _contenido_bultos(self, bultos_ids: list[int]) -> dict[int, list[tuple[str, int, Decimal]]]:
        """Por bulto: (código, cantidad, costo unitario) de cada producto que traía."""
        db, p = _detalles_bulto.c, _productos.c
        stmt = (
            select(db.bulto_id, p.codigo, db.cantidad, p.costo_unitario)
            .join(_productos, p.id == db.producto_id)
            .where(db.bulto_id.in_(bultos_ids))
        )
        contenido: dict[int, list[tuple[str, int, Decimal]]] = defaultdict(list)
        for bulto_id, codigo, cantidad, costo in self._get_session().execute(stmt):
            contenido[bulto_id].append((codigo, cantidad, _decimal(costo)))
        return contenido

    # --- Reporte 5: tiempo de tránsito CD -> local ---

    def tiempos_transito(self, rango: Rango_Fechas) -> list[Tiempo_Transito_Local]:
        """Horas entre En_Transito y Recibido de cada bulto, por local, según la fecha de recepción."""
        horas_por_local: dict[int, list[Decimal]] = defaultdict(list)
        for despacho, recepcion, destino in self._despachos_y_recepciones():
            if rango.inicio <= recepcion <= rango.fin:
                horas = Decimal(str((recepcion - despacho).total_seconds() / 3600))
                horas_por_local[destino].append(horas.quantize(CENTAVOS, ROUND_HALF_UP))
        nombres = self._nombres_ubicaciones()
        return [
            Tiempo_Transito_Local(local, nombres.get(local, f"Local {local}"), tuple(horas))
            for local, horas in sorted(horas_por_local.items())
        ]

    def _despachos_y_recepciones(self) -> list[tuple[datetime, datetime, int]]:
        """(fecha de despacho, fecha de recepción, local destino) de cada bulto ya recibido."""
        h = _historial.c
        stmt = (
            select(h.bulto_id, h.estado_nuevo, h.fecha_hora, _remitos.c.destino_id)
            .join(_bultos, _bultos.c.id == h.bulto_id)
            .join(_remitos, _remitos.c.numero == _bultos.c.remito_numero)
            .where(h.estado_nuevo.in_(("EN_TRANSITO", "RECIBIDO")))
        )
        fechas: dict[int, dict[str, datetime]] = defaultdict(dict)
        destinos: dict[int, int] = {}
        for bulto_id, estado, fecha, destino in self._get_session().execute(stmt):
            fechas[bulto_id][estado] = fecha
            destinos[bulto_id] = destino
        return [
            (eventos["EN_TRANSITO"], eventos["RECIBIDO"], destinos[bulto_id])
            for bulto_id, eventos in fechas.items()
            if "EN_TRANSITO" in eventos and "RECIBIDO" in eventos
        ]

    def _nombres_ubicaciones(self) -> dict[int, str]:
        return dict(self._get_session().execute(select(_ubicaciones.c.id, _ubicaciones.c.nombre)).all())


def _decimal(valor: object) -> Decimal:
    """SQLite suma NUMERIC como REAL: se pasa por str y se redondea a centavos."""
    if valor is None:
        return Decimal("0.00")
    return Decimal(str(valor)).quantize(CENTAVOS, rounding=ROUND_HALF_UP)

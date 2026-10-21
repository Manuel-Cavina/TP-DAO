"""Carga datos de demostración recorriendo los casos de uso reales (no inserta SQL a mano).

Uso, desde backend/src:  python -m bootstrap.seed_demo

Crea 1 CD, 3 locales, 3 categorías, 3 proveedores y 10 productos; ingresa stock al CD;
abastece cada local con un remito completo (uno con un bulto de precinto roto); registra
ventas en tres meses distintos con los tres medios de pago y una devolución. Las ventas
disparan el Observer de stock bajo, así que también quedan alertas y necesidades.
Es idempotente: si ya existe un Centro de Distribución, no hace nada.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from modules.catalogo.application import Categoria_Service, Producto_Service, Proveedor_Service
from modules.logistica.application import Despacho_Service, Empaquetado_Service, Recepcion_Service, Reposicion_Service
from modules.logistica.infrastructure import Stock_Logistica_Adapter
from modules.seguridad.application import Auth_Service
from modules.ubicaciones_stock.application import Stock_Service, Ubicacion_Service
from modules.ventas_caja.application import Devolucion_Service, Venta_Service
from modules.ventas_caja.domain import Estrategia_Pago, Pago_Efectivo, Pago_Tarjeta, Pago_Transferencia
from modules.ventas_caja.infrastructure import Catalogo_Venta_Adapter, Stock_Venta_Adapter

# codigo, nombre, categoria, proveedor, precio, costo, minimo
PRODUCTOS = [
    ("BEB-AGUA", "Agua mineral 500 ml", "Bebidas", 0, "800.00", "450.00", 5),
    ("BEB-GAS", "Gaseosa cola 1,5 L", "Bebidas", 0, "2500.00", "1500.00", 5),
    ("BEB-JUGO", "Jugo de naranja 1 L", "Bebidas", 0, "1900.00", "1100.00", 4),
    ("BEB-CERV", "Cerveza rubia 473 ml", "Bebidas", 1, "1700.00", "1050.00", 6),
    ("ALM-YERBA", "Yerba mate 1 kg", "Almacén", 1, "4200.00", "2900.00", 4),
    ("ALM-ARROZ", "Arroz largo fino 1 kg", "Almacén", 1, "1600.00", "950.00", 4),
    ("ALM-FIDEO", "Fideos spaghetti 500 g", "Almacén", 1, "1100.00", "1250.00", 4),  # en liquidación: margen negativo
    ("LIM-LAVA", "Lavandina 2 L", "Limpieza", 2, "1300.00", "700.00", 3),
    ("LIM-DETER", "Detergente 750 ml", "Limpieza", 2, "1800.00", "1000.00", 3),
    ("LIM-ESPON", "Esponja doble faz x3", "Limpieza", 2, "900.00", "400.00", 3),
]
PROVEEDORES = [
    ("30-71000001-1", "Distribuidora Bebidas del Sur SA", "011-4000-1000", "ventas@bebidasdelsur.com"),
    ("30-71000002-9", "Almacén Mayorista Pampa SRL", "011-4000-2000", "pedidos@pampa.com"),
    ("30-71000003-7", "Química Limpia SA", "011-4000-3000", "comercial@quimicalimpia.com"),
]
EFECTIVO_SUFICIENTE = Decimal("100000")


@dataclass
class Datos_Base:
    cd_id: int
    locales: list[int]
    productos: dict[str, int]


def cargar_datos_demo(database_url: str | None = None) -> bool:
    """Carga los datos de demo en una transacción. Devuelve False si ya estaban cargados.

    Sin URL usa la base configurada (ERP_DATABASE_URL o runtime/erp.sqlite3).
    """
    Application_Factory.crear_aplicacion(database_url)  # crea el esquema ORM y suscribe los observadores
    sesion = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
    token = Request_Session_Context.establecer_sesion(sesion)
    try:
        Auth_Service().sembrar_identidades_defecto()
        if Ubicacion_Service().listar(tipo="CD"):
            return False
        base = _cargar_catalogo_y_ubicaciones()
        _abastecer_locales(base)
        _registrar_ventas(base)
        # Fuera de HTTP no hay middleware: el script delimita su propia transacción.
        sesion.commit()
        return True
    except BaseException:
        sesion.rollback()
        raise
    finally:
        Request_Session_Context.restablecer(token)
        sesion.close()


def _cargar_catalogo_y_ubicaciones() -> Datos_Base:
    ubicaciones = Ubicacion_Service()
    cd = ubicaciones.crear_centro_distribucion("CD Central", "Ruta 9 km 25, Córdoba", "0351-400-0000")
    locales = [
        ubicaciones.crear_local(nombre, direccion, telefono).id
        for nombre, direccion, telefono in (
            ("Local Centro", "San Martín 120", "0351-411-1111"),
            ("Local Norte", "Av. Rafael Núñez 4500", "0351-422-2222"),
            ("Local Sur", "Av. Vélez Sarsfield 2100", "0351-433-3333"),
        )
    ]

    categorias = {nombre: Categoria_Service().crear(nombre).id for nombre in ("Bebidas", "Almacén", "Limpieza")}
    proveedores = [Proveedor_Service().crear(*datos).id for datos in PROVEEDORES]
    alta_productos = Producto_Service(Stock_Service())
    productos = {
        codigo: alta_productos.crear(
            codigo, nombre, Decimal(precio), Decimal(costo), categorias[categoria], proveedores[proveedor], minimo
        ).id
        for codigo, nombre, categoria, proveedor, precio, costo, minimo in PRODUCTOS
    }

    stock = Stock_Service()
    for producto_id in productos.values():
        stock.ingresar_mercaderia_cd(producto_id, cd.id, 200)
    return Datos_Base(cd.id, locales, productos)


UNIDADES_POR_PRODUCTO = 30
Venta_Planificada = tuple[datetime, int, list[tuple[str, int]], Estrategia_Pago]


@dataclass
class Servicios_Logistica:
    """Casos de uso de logística conectados al stock real, para recorrer P3 a P6."""

    adaptador: Stock_Logistica_Adapter = field(default_factory=Stock_Logistica_Adapter)

    def __post_init__(self) -> None:
        self.reposicion = Reposicion_Service(self.adaptador)
        self.empaquetado = Empaquetado_Service(self.adaptador)
        self.despacho = Despacho_Service(self.adaptador)
        self.recepcion = Recepcion_Service(self.adaptador)


def _abastecer_locales(base: Datos_Base) -> None:
    """Un remito completo por local, en tres bultos. En el Local Norte el bulto de esponjas
    (que no se venden en la demo) llega con el precinto roto: queda como merma."""
    servicios = Servicios_Logistica()
    for numero, local_id in enumerate(base.locales, start=1):
        _enviar_remito(servicios, base, numero, local_id, rechazar_ultimo_bulto=local_id == base.locales[1])


def _enviar_remito(
    servicios: Servicios_Logistica, base: Datos_Base, numero: int, local_id: int, rechazar_ultimo_bulto: bool
) -> None:
    codigos = list(base.productos)
    orden = servicios.reposicion.crear_orden_manual(
        base.cd_id, local_id, [{"producto_id": base.productos[c], "cantidad": UNIDADES_POR_PRODUCTO} for c in codigos]
    )
    grupos = (codigos[:5], codigos[5:9], codigos[9:])
    bultos = [_bulto_precintado(servicios, base, orden.id, grupo, f"PREC-{numero:02d}-{i}") for i, grupo in enumerate(grupos, 1)]

    remito = f"REM-2026-{numero:04d}"
    servicios.empaquetado.generar_remito(remito, orden.id, [bulto_id for bulto_id, _ in bultos])
    servicios.despacho.despachar_remito(remito)
    servicios.recepcion.recibir_remito(remito)
    for indice, (bulto_id, precinto) in enumerate(bultos):
        intacto = not (rechazar_ultimo_bulto and indice == len(bultos) - 1)
        servicios.recepcion.verificar_bulto(bulto_id, precinto, esta_intacto=intacto)
    servicios.recepcion.cerrar_remito(remito)


def _bulto_precintado(
    servicios: Servicios_Logistica, base: Datos_Base, orden_id: int, codigos: list[str], precinto: str
) -> tuple[int, str]:
    items = [{"producto_id": base.productos[c], "cantidad": UNIDADES_POR_PRODUCTO} for c in codigos]
    bulto = servicios.empaquetado.crear_bulto(orden_id, items)
    servicios.empaquetado.registrar_precinto(precinto)
    servicios.empaquetado.precintar_bulto(bulto.id, precinto)
    return bulto.id, precinto


def _registrar_ventas(base: Datos_Base) -> None:
    """Ventas en tres meses distintos con los tres medios de pago, y una devolución reciente."""
    ventas = Venta_Service(Stock_Venta_Adapter(), Catalogo_Venta_Adapter())
    registradas = [
        ventas.registrar_venta(local_id, [(base.productos[c], n) for c, n in items], pago, fecha)
        for fecha, local_id, items, pago in _plan_de_ventas(base)
    ]
    ultima = registradas[-1]
    Devolucion_Service(Stock_Venta_Adapter()).registrar_devolucion(
        ultima.id, ultima.local_id, [(base.productos["BEB-JUGO"], 1)], "Envase dañado", ultima.fecha_hora + timedelta(days=1)
    )


def _plan_de_ventas(base: Datos_Base) -> list[Venta_Planificada]:
    ahora = datetime.now().replace(microsecond=0)
    hace_un_mes = ahora.replace(day=1) - timedelta(days=10)
    hace_dos_meses = hace_un_mes.replace(day=1) - timedelta(days=10)
    plan: list[Venta_Planificada] = []
    for mes, fecha in enumerate((hace_dos_meses, hace_un_mes, ahora - timedelta(days=3))):
        for indice, local_id in enumerate(base.locales):
            momento = fecha - timedelta(hours=indice * 3)
            transferencia = Pago_Transferencia("almacen.pampa.mp", f"TX-{mes}{indice}")
            plan += [
                (momento, local_id, [("BEB-AGUA", 3 + mes), ("ALM-YERBA", 1)], Pago_Efectivo(EFECTIVO_SUFICIENTE)),
                (momento + timedelta(hours=1), local_id, [("BEB-GAS", 2), ("ALM-FIDEO", 2 + mes)], _tarjeta(3)),
                (momento + timedelta(hours=2), local_id, [("LIM-DETER", 1), ("BEB-CERV", 4)], transferencia),
            ]
    # Deja la lavandina del Local Sur en su mínimo: el Observer genera alerta y necesidad de reposición.
    plan.append((ahora - timedelta(days=1), base.locales[2], [("LIM-LAVA", 27)], Pago_Efectivo(EFECTIVO_SUFICIENTE)))
    # La última venta es la que después se devuelve en parte.
    plan.append((ahora - timedelta(days=2), base.locales[0], [("BEB-JUGO", 2), ("LIM-LAVA", 1)], _tarjeta(12)))
    return plan


def _tarjeta(cuotas: int) -> Estrategia_Pago:
    return Pago_Tarjeta("4509953566233704", cuotas)


if __name__ == "__main__":
    if cargar_datos_demo():
        print("Datos de demostración cargados.")
    else:
        print("La base ya tenía datos: no se cargó nada.")

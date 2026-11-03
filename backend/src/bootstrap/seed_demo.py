"""Carga datos de demostración completos y realistas según la especificación del TP Integrador y Stocky UX.

Uso desde backend/src:
    python -m bootstrap.seed_demo [--reset | --force]

Crea:
- Múltiples Centros de Distribución (CD Central y CD Regional Villa María) y 5 sucursales (Centro, Norte, Sur, Carlos Paz, Río Cuarto).
- Catálogo amplio con 6 categorías representativas del retail minorista, 6 proveedores con CUITs válidos y 27 productos con precios, costos y stock mínimo (incluyendo productos con margen negativo en liquidación para reportes analíticos).
- Usuarios operativos y administrativos: Administrador y Operador móvil con alcance a todas las sucursales.
- Historial real de remitos entregados y cerrados con tiempos de tránsito calculados entre CD y locales (promedio y máximos reales) y bultos rechazados por rotura de precinto o merma en transporte.
- Ventas distribuidas en 3 meses y en los 5 locales utilizando los 3 medios de pago (Efectivo, Tarjeta con cuotas, Transferencia), y devoluciones con impacto en stock y caja.
- Disparo del patrón Observer para alertas de stock bajo mínimo y generación automática de necesidades de reposición.
- Cola operativa completa para el operador móvil: órdenes listas para armado, bultos preparados para precintar, bultos precintados listos para aprobación inmutable, bultos aprobados listos para emisión de remito, remitos listos para despacho, remitos en tránsito listos para arribo, remitos recibidos con bultos pendientes de verificación y remito listo para cierre con HoldToConfirm.
- Pool de precintos nuevos y disponibles listos para ser utilizados por el operador en el dispositivo móvil.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
import sys

from sqlalchemy import update
from sqlalchemy.orm import Session

from bootstrap.application_factory import Application_Factory
from config.database.base import Base
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.request_session_context import Request_Session_Context
from config.database.schema_migrations import aplicar_migraciones_sqlite
from modules.catalogo.application import Categoria_Service, Producto_Service, Proveedor_Service
from modules.catalogo.infrastructure.producto_repository import Producto_Repository
from modules.logistica.application import Despacho_Service, Empaquetado_Service, Recepcion_Service, Reposicion_Service
from modules.logistica.infrastructure import Stock_Logistica_Adapter
from modules.logistica.infrastructure.models import Historial_Bulto_Model
from modules.logistica.infrastructure.remito_repository import Remito_Repository
from modules.seguridad.application import Auth_Service
from modules.seguridad.infrastructure.seguridad_repository import Seguridad_Repository
from modules.ubicaciones_stock.application import Alerta_Stock_Service, Stock_Service, Ubicacion_Service
from modules.ventas_caja.application import Devolucion_Service, Venta_Service
from modules.ventas_caja.domain import Estrategia_Pago, Pago_Efectivo, Pago_Tarjeta, Pago_Transferencia
from modules.ventas_caja.infrastructure import Catalogo_Venta_Adapter, Stock_Venta_Adapter

CATEGORIAS = [
    "Bebidas",
    "Almacén",
    "Limpieza",
    "Lácteos y Refrigerados",
    "Golosinas y Snacks",
    "Perfumería y Cuidado Personal",
]

PROVEEDORES = [
    ("30-71000001-1", "Distribuidora Bebidas del Sur SA", "011-4000-1000", "ventas@bebidasdelsur.com"),
    ("30-71000002-9", "Almacén Mayorista Pampa SRL", "011-4000-2000", "pedidos@pampa.com"),
    ("30-71000003-7", "Química Limpia SA", "011-4000-3000", "comercial@quimicalimpia.com"),
    ("30-71000004-5", "Lácteos Serranos Coop Ltda", "0351-480-1122", "ventas@lacteosserranos.com.ar"),
    ("30-71000005-3", "Golosinas Mediterráneas SA", "0351-490-3344", "pedidos@golosinasmed.com"),
    ("30-71000006-1", "Laboratorios Higiene & Belleza SA", "011-4770-5500", "contacto@higienebelleza.com.ar"),
]

# (codigo, nombre, categoria, proveedor_idx, precio_venta, costo_unitario, nivel_minimo)
PRODUCTOS = [
    # Bebidas
    ("BEB-AGUA", "Agua mineral 500 ml", "Bebidas", 0, "800.00", "450.00", 10),
    ("BEB-GAS", "Gaseosa cola 1,5 L", "Bebidas", 0, "2500.00", "1500.00", 8),
    ("BEB-JUGO", "Jugo de naranja 1 L", "Bebidas", 0, "1900.00", "1100.00", 6),
    ("BEB-CERV", "Cerveza rubia 473 ml", "Bebidas", 0, "1700.00", "1050.00", 12),
    ("BEB-SODA", "Soda en sifón 1,25 L", "Bebidas", 0, "1200.00", "700.00", 6),
    # Almacén
    ("ALM-YERBA", "Yerba mate 1 kg", "Almacén", 1, "4200.00", "2900.00", 10),
    ("ALM-ARROZ", "Arroz largo fino 1 kg", "Almacén", 1, "1600.00", "950.00", 8),
    ("ALM-FIDEO", "Fideos spaghetti 500 g", "Almacén", 1, "1100.00", "1250.00", 8),  # liquidación: margen negativo
    ("ALM-ACEIT", "Aceite de girasol 900 ml", "Almacén", 1, "2200.00", "1400.00", 8),
    ("ALM-AZUC", "Azúcar común tipo A 1 kg", "Almacén", 1, "1300.00", "850.00", 8),
    ("ALM-ATUN", "Atún al natural lata 170 g", "Almacén", 1, "2900.00", "1800.00", 5),
    # Limpieza
    ("LIM-LAVA", "Lavandina 2 L", "Limpieza", 2, "1300.00", "700.00", 6),
    ("LIM-DETER", "Detergente 750 ml", "Limpieza", 2, "1800.00", "1000.00", 8),
    ("LIM-ESPON", "Esponja doble faz x3", "Limpieza", 2, "900.00", "400.00", 6),
    ("LIM-JABON", "Jabón líquido para ropa 3 L", "Limpieza", 2, "5800.00", "3600.00", 4),
    ("LIM-DESIN", "Desinfectante de pisos 900 ml", "Limpieza", 2, "1500.00", "850.00", 6),
    # Lácteos y Refrigerados
    ("LAC-LECHE", "Leche entera sachet 1 L", "Lácteos y Refrigerados", 3, "1400.00", "920.00", 12),
    ("LAC-QUESO", "Queso cremoso 1 kg", "Lácteos y Refrigerados", 3, "7800.00", "5200.00", 4),
    ("LAC-MANTE", "Manteca extra 200 g", "Lácteos y Refrigerados", 3, "2400.00", "1600.00", 5),
    ("LAC-YOGUR", "Yogur bebible frutilla 1 L", "Lácteos y Refrigerados", 3, "2100.00", "1350.00", 6),
    # Golosinas y Snacks
    ("GOL-ALFAC", "Alfajor chocolate negro triple", "Golosinas y Snacks", 4, "1200.00", "650.00", 10),
    ("GOL-CHOC", "Chocolate semiamargo 100 g", "Golosinas y Snacks", 4, "2600.00", "1550.00", 6),
    ("GOL-GALLE", "Galletitas rellenas vainilla 160 g", "Golosinas y Snacks", 4, "1500.00", "900.00", 8),
    ("GOL-PAPAS", "Papas fritas tradicionales 150 g", "Golosinas y Snacks", 4, "2300.00", "1400.00", 6),
    # Perfumería y Cuidado Personal
    ("PER-SHAMP", "Shampoo hidratación 400 ml", "Perfumería y Cuidado Personal", 5, "3900.00", "2300.00", 4),
    ("PER-JABON", "Jabón de tocador cremoso x3", "Perfumería y Cuidado Personal", 5, "2100.00", "1200.00", 6),
    ("PER-CREMA", "Crema dental anticaries 90 g", "Perfumería y Cuidado Personal", 5, "1800.00", "1050.00", 8),
]

EFECTIVO_SUFICIENTE = Decimal("150000.00")
UNIDADES_POR_PRODUCTO = 30


@dataclass
class Datos_Base:
    cd_id: int
    cd_secundario_id: int
    locales: list[int]
    productos: dict[str, int]


@dataclass
class Servicios_Logistica:
    """Casos de uso de logística conectados al stock real, para recorrer P3 a P6."""

    adaptador: Stock_Logistica_Adapter = field(default_factory=Stock_Logistica_Adapter)

    def __post_init__(self) -> None:
        self.reposicion = Reposicion_Service(self.adaptador)
        self.empaquetado = Empaquetado_Service(self.adaptador)
        self.despacho = Despacho_Service(self.adaptador)
        self.recepcion = Recepcion_Service(self.adaptador)


def cargar_datos_demo(database_url: str | None = None, forzar: bool = False) -> bool:
    """Carga los datos de demo en una transacción. Devuelve False si ya estaban cargados."""
    engine = Database_Engine_Singleton.obtener_instancia(database_url)
    Application_Factory.crear_aplicacion(database_url)  # inicializa schema y observer

    if forzar:
        from config.database.base import Base
        from config.database.schema_migrations import aplicar_migraciones_sqlite
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        aplicar_migraciones_sqlite(engine)
        Application_Factory._suscribir_observadores_de_stock()

    sesion = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
    token = Request_Session_Context.establecer_sesion(sesion)
    try:
        from modules.catalogo.infrastructure.producto_repository import Producto_Repository
        from modules.logistica.infrastructure.remito_repository import Remito_Repository

        tiene_seed_incompleto = (
            Remito_Repository().existe("REM-DEMO-EMITIDO")
            and not (
                Remito_Repository().existe("REM-DEMO-LISTO-CIERRE")
                and Producto_Repository().obtener_por_codigo("LAC-LECHE") is not None
            )
        )

        if tiene_seed_incompleto:
            Request_Session_Context.restablecer(token)
            sesion.close()
            from config.database.base import Base
            from config.database.schema_migrations import aplicar_migraciones_sqlite
            Base.metadata.drop_all(engine)
            Base.metadata.create_all(engine)
            aplicar_migraciones_sqlite(engine)
            Application_Factory._suscribir_observadores_de_stock()
            sesion = Database_Engine_Singleton.obtener_session_factory().crear_sesion()
            token = Request_Session_Context.establecer_sesion(sesion)

        Auth_Service().sembrar_identidades_defecto()
        if _demo_operativo_ya_cargado():
            if not _crear_alerta_demo_si_falta():
                return False
            sesion.commit()
            return True

        base = _obtener_base_demo()
        if base is None:
            base = _cargar_catalogo_y_ubicaciones(sesion)
            _abastecer_locales(sesion, base)
            _registrar_ventas(base)
        _cargar_cola_operativa(base)
        sesion.commit()
        return True
    except BaseException:
        sesion.rollback()
        raise
    finally:
        Request_Session_Context.restablecer(token)
        sesion.close()


def _cargar_catalogo_y_ubicaciones(sesion: Session) -> Datos_Base:
    ubicaciones = Ubicacion_Service()
    cd_central = ubicaciones.crear_centro_distribucion("CD Central", "Ruta 9 km 25, Córdoba", "0351-400-0000")
    cd_secundario = ubicaciones.crear_centro_distribucion(
        "CD Logística Regional", "Ruta Nac. 158 km 120, Villa María", "0353-460-0000"
    )

    locales = [
        ubicaciones.crear_local(nombre, direccion, telefono).id
        for nombre, direccion, telefono in (
            ("Local Centro", "San Martín 120, Córdoba", "0351-411-1111"),
            ("Local Norte", "Av. Rafael Núñez 4500, Córdoba", "0351-422-2222"),
            ("Local Sur", "Av. Vélez Sarsfield 2100, Córdoba", "0351-433-3333"),
            ("Local Carlos Paz", "Av. San Martín 850, Villa Carlos Paz", "03541-420-100"),
            ("Local Río Cuarto", "Constitución 420, Río Cuarto", "0358-464-2000"),
        )
    ]

    # Asignar al operador móvil todas las sucursales para permitir cambio de sede en la app móvil
    repo_seg = Seguridad_Repository()
    operador = repo_seg.buscar_usuario_por_login("operador@stocky.local")
    if operador is not None and operador.asignacion is not None:
        operador.asignacion._authorised_branch_ids = list(locales)
        operador.asignacion._reporting_cd_id = cd_central.id
        repo_seg.guardar_asignacion(operador.asignacion)

    categorias = {nombre: Categoria_Service().crear(nombre).id for nombre in CATEGORIAS}
    proveedores = [Proveedor_Service().crear(*datos).id for datos in PROVEEDORES]

    alta_productos = Producto_Service(Stock_Service())
    productos = {
        codigo: alta_productos.crear(
            codigo,
            nombre,
            Decimal(precio),
            Decimal(costo),
            categorias[categoria],
            proveedores[proveedor],
            minimo,
        ).id
        for codigo, nombre, categoria, proveedor, precio, costo, minimo in PRODUCTOS
    }

    stock = Stock_Service()
    for producto_id in productos.values():
        stock.ingresar_mercaderia_cd(producto_id, cd_central.id, 450)
        stock.ingresar_mercaderia_cd(producto_id, cd_secundario.id, 150)

    return Datos_Base(cd_central.id, cd_secundario.id, locales, productos)


def _obtener_base_demo() -> Datos_Base | None:
    ubicaciones = Ubicacion_Service()
    centros = ubicaciones.listar(tipo="CD", solo_activas=True)
    locales = ubicaciones.listar(tipo="LOCAL", solo_activas=True)
    productos = {producto.codigo: producto.id for producto in Producto_Repository().listar(solo_activos=True)}
    if not centros or len(locales) < 5 or not set(codigo for codigo, *_ in PRODUCTOS) <= set(productos):
        return None
    cd_sec = centros[1].id if len(centros) > 1 else centros[0].id
    return Datos_Base(centros[0].id, cd_sec, [local.id for local in locales[:5]], productos)


def _demo_operativo_ya_cargado() -> bool:
    from modules.catalogo.infrastructure.producto_repository import Producto_Repository
    from modules.logistica.infrastructure.remito_repository import Remito_Repository

    return (
        Remito_Repository().existe("REM-DEMO-EMITIDO")
        and Remito_Repository().existe("REM-DEMO-LISTO-CIERRE")
        and Producto_Repository().obtener_por_codigo("LAC-LECHE") is not None
    )


def _crear_alerta_demo_si_falta() -> bool:
    if Alerta_Stock_Service().listar(leida=False):
        return False
    ubicaciones = Ubicacion_Service().listar(tipo="LOCAL", solo_activas=True)
    productos = Producto_Repository().listar(solo_activos=True)
    stock = Stock_Service()
    for local in ubicaciones:
        for producto in productos:
            existencia = stock.consultar_stock(producto.id, local.id)
            cantidad = existencia.cantidad_disponible - existencia.nivel_minimo_existencia
            if cantidad >= 0:
                stock.descontar_por_venta(producto.id, local.id, cantidad)
                return True
    return False


def _abastecer_locales(sesion: Session, base: Datos_Base) -> None:
    """Envía remitos cerrados completos a cada local para stock inicial, mermas y tiempos de tránsito."""
    servicios = Servicios_Logistica()
    rechazos = [
        (False, ""),
        (True, "Precinto violado y merma de mercadería al arribo"),
        (True, "Contenedor aplastado con pérdida de producto y precinto cortado"),
        (False, ""),
        (True, "Pérdida de frío y rotura física de mercadería"),
    ]
    tiempos_horas = [2.2, 3.1, 3.7, 5.4, 10.6]
    ahora = datetime.now()

    trayectos: list[tuple[int, datetime, datetime, datetime | None]] = []

    for numero, (local_id, (rechazar, motivo), horas) in enumerate(zip(base.locales, rechazos, tiempos_horas), start=1):
        bultos_resultado = _enviar_remito(
            servicios, base, numero, local_id, rechazar_ultimo_bulto=rechazar, motivo_rechazo=motivo
        )
        hace_dias = 22 - numero * 2
        despacho = ahora - timedelta(days=hace_dias, hours=8)
        recepcion = despacho + timedelta(hours=horas)
        for bulto_id, es_rechazo in bultos_resultado:
            rechazo_time = recepcion + timedelta(minutes=15) if es_rechazo else None
            trayectos.append((bulto_id, despacho, recepcion, rechazo_time))

    _ajustar_tiempos_historicos(sesion, trayectos)


def _enviar_remito(
    servicios: Servicios_Logistica, base: Datos_Base, numero: int, local_id: int, rechazar_ultimo_bulto: bool, motivo_rechazo: str = ""
) -> list[tuple[int, bool]]:
    # Grupo 1 y 2 tienen productos vendibles en todos los locales (100% verificados e intactos)
    grupo_1 = ["BEB-AGUA", "BEB-GAS", "BEB-JUGO", "BEB-CERV", "ALM-YERBA", "ALM-ARROZ", "ALM-FIDEO", "ALM-ACEIT", "LIM-LAVA"]
    grupo_2 = ["LIM-DETER", "LIM-JABON", "LAC-LECHE", "LAC-QUESO", "LAC-MANTE", "GOL-ALFAC", "GOL-CHOC", "GOL-PAPAS", "PER-SHAMP"]
    # Grupo 3 actúa como bulto de reserva / merma en traslados para los locales con rotura de precinto
    grupo_3 = ["BEB-SODA", "ALM-AZUC", "ALM-ATUN", "LIM-ESPON", "LIM-DESIN", "LAC-YOGUR", "GOL-GALLE", "PER-JABON", "PER-CREMA"]
    grupos = (grupo_1, grupo_2, grupo_3)

    todos_codigos = grupo_1 + grupo_2 + grupo_3
    orden = servicios.reposicion.crear_orden_manual(
        base.cd_id, local_id, [{"producto_id": base.productos[c], "cantidad": UNIDADES_POR_PRODUCTO} for c in todos_codigos]
    )
    bultos = [
        _bulto_precintado(servicios, base, orden.id, grupo, f"PREC-2026-{numero:02d}-{i}")
        for i, grupo in enumerate(grupos, 1)
    ]

    remito = f"REM-2026-{numero:04d}"
    servicios.empaquetado.generar_remito(remito, orden.id, [bulto_id for bulto_id, _ in bultos])
    servicios.despacho.despachar_remito(remito)
    servicios.recepcion.recibir_remito(remito)

    bultos_resultado: list[tuple[int, bool]] = []
    for indice, (bulto_id, precinto) in enumerate(bultos):
        es_rechazo = rechazar_ultimo_bulto and indice == len(bultos) - 1
        intacto = not es_rechazo
        motivo = motivo_rechazo if es_rechazo else ""
        servicios.recepcion.verificar_bulto(
            bulto_id, precinto, esta_intacto=intacto, motivo_rechazo=motivo, ubicacion_id=local_id
        )
        bultos_resultado.append((bulto_id, es_rechazo))

    servicios.recepcion.cerrar_remito(remito)
    return bultos_resultado


def _bulto_precintado(
    servicios: Servicios_Logistica, base: Datos_Base, orden_id: int, codigos: list[str], precinto: str
) -> tuple[int, str]:
    items = [{"producto_id": base.productos[c], "cantidad": UNIDADES_POR_PRODUCTO} for c in codigos]
    bulto = servicios.empaquetado.crear_bulto(orden_id, items)
    servicios.empaquetado.registrar_precinto(precinto)
    servicios.empaquetado.precintar_bulto(bulto.id, precinto)
    servicios.empaquetado.aprobar_bulto(bulto.id, actor="Supervisor CD", observacion="Bulto conforme para despacho")
    return bulto.id, precinto


def _ajustar_tiempos_historicos(
    sesion: Session, trayectos: list[tuple[int, datetime, datetime, datetime | None]]
) -> None:
    """Ajusta las marcas de tiempo en el historial para simular tiempos de tránsito reales."""
    for bulto_id, despacho, recepcion, rechazo in trayectos:
        sesion.execute(
            update(Historial_Bulto_Model)
            .where((Historial_Bulto_Model.bulto_id == bulto_id) & (Historial_Bulto_Model.estado_nuevo == "EN_TRANSITO"))
            .values(fecha_hora=despacho)
        )
        sesion.execute(
            update(Historial_Bulto_Model)
            .where((Historial_Bulto_Model.bulto_id == bulto_id) & (Historial_Bulto_Model.estado_nuevo == "RECIBIDO"))
            .values(fecha_hora=recepcion)
        )
        if rechazo is not None:
            sesion.execute(
                update(Historial_Bulto_Model)
                .where((Historial_Bulto_Model.bulto_id == bulto_id) & (Historial_Bulto_Model.estado_nuevo == "RECHAZADO"))
                .values(fecha_hora=rechazo)
            )


Venta_Planificada = tuple[datetime, int, list[tuple[str, int]], Estrategia_Pago]


def _registrar_ventas(base: Datos_Base) -> None:
    """Registra ventas en los 5 locales y 3 períodos, con devoluciones en múltiples medios de pago."""
    ventas = Venta_Service(Stock_Venta_Adapter(), Catalogo_Venta_Adapter())
    registradas = [
        ventas.registrar_venta(local_id, [(base.productos[c], n) for c, n in items], pago, fecha)
        for fecha, local_id, items, pago in _plan_de_ventas(base)
    ]
    _registrar_devoluciones(base, registradas)


def _plan_de_ventas(base: Datos_Base) -> list[Venta_Planificada]:
    ahora = datetime.now().replace(microsecond=0)
    hace_un_mes = ahora.replace(day=1) - timedelta(days=10)
    hace_dos_meses = hace_un_mes.replace(day=1) - timedelta(days=10)
    plan: list[Venta_Planificada] = []

    for mes, fecha in enumerate((hace_dos_meses, hace_un_mes, ahora - timedelta(days=3))):
        for indice, local_id in enumerate(base.locales):
            momento = fecha - timedelta(hours=indice * 2 + mes)
            transferencia = Pago_Transferencia("stocky.pagos.mp", f"TX-M{mes}L{indice}-{local_id}")

            # Venta 1: Productos de alta rotación (Efectivo)
            plan.append((
                momento,
                local_id,
                [("BEB-AGUA", 3 + mes), ("ALM-YERBA", 1 + (mes % 2)), ("LAC-LECHE", 2 + mes)],
                Pago_Efectivo(EFECTIVO_SUFICIENTE),
            ))

            # Venta 2: Bebidas, golosinas y producto en liquidación con margen negativo (Tarjeta 3 cuotas)
            plan.append((
                momento + timedelta(hours=1),
                local_id,
                [("BEB-GAS", 2), ("ALM-FIDEO", 2 + mes), ("GOL-ALFAC", 3 + mes)],
                _tarjeta(3),
            ))

            # Venta 3: Limpieza y perfumería (Transferencia)
            plan.append((
                momento + timedelta(hours=2),
                local_id,
                [("LIM-DETER", 1 + (mes % 2)), ("BEB-CERV", 3), ("PER-SHAMP", 1)],
                transferencia,
            ))

    # Ventas de alto volumen para productos líderes
    plan.append((
        ahora - timedelta(days=1, hours=4),
        base.locales[0],
        [("BEB-AGUA", 6), ("LAC-QUESO", 1), ("GOL-CHOC", 2)],
        Pago_Efectivo(EFECTIVO_SUFICIENTE),
    ))

    # Disparar alertas Observer llevando productos a su nivel mínimo:
    # 1. Lavandina en Local Sur al mínimo (quedaban 30, vendemos 24 -> quedan 6 = mínimo 6)
    plan.append((
        ahora - timedelta(days=1),
        base.locales[2],
        [("LIM-LAVA", 24)],
        Pago_Efectivo(EFECTIVO_SUFICIENTE),
    ))

    # 2. Leche fluida en Local Carlos Paz bajo mínimo (quedaban 30, vendemos 20 -> quedan 10 <= mínimo 12)
    plan.append((
        ahora - timedelta(days=1, hours=2),
        base.locales[3],
        [("LAC-LECHE", 20)],
        Pago_Efectivo(EFECTIVO_SUFICIENTE),
    ))

    # 3. Cerveza en Local Río Cuarto bajo mínimo (quedaban 30, vendemos 20 -> quedan 10 <= mínimo 12)
    plan.append((
        ahora - timedelta(days=1, hours=3),
        base.locales[4],
        [("BEB-CERV", 20)],
        Pago_Efectivo(EFECTIVO_SUFICIENTE),
    ))

    # Ventas finales planificadas para ser devueltas posteriormente
    plan.append((
        ahora - timedelta(days=2),
        base.locales[0],
        [("BEB-JUGO", 2), ("LIM-LAVA", 1)],
        _tarjeta(12),
    ))

    plan.append((
        ahora - timedelta(days=2, hours=1),
        base.locales[1],
        [("PER-SHAMP", 1), ("ALM-ARROZ", 2)],
        Pago_Efectivo(EFECTIVO_SUFICIENTE),
    ))

    plan.append((
        ahora - timedelta(days=2, hours=2),
        base.locales[3],
        [("ALM-FIDEO", 2), ("LAC-MANTE", 1)],
        _tarjeta(6),
    ))

    plan.append((
        ahora - timedelta(days=2, hours=3),
        base.locales[4],
        [("LAC-MANTE", 1), ("GOL-PAPAS", 2)],
        Pago_Transferencia("stocky.pagos.mp", "TX-DEV-RC4"),
    ))

    return plan


def _registrar_devoluciones(base: Datos_Base, registradas: list) -> None:
    devoluciones = Devolucion_Service(Stock_Venta_Adapter())
    v_centro = registradas[-4]
    v_norte = registradas[-3]
    v_carlospaz = registradas[-2]
    v_riocuarto = registradas[-1]

    # Devolución 1 (Local Centro): 2 jugos ($3800)
    devoluciones.registrar_devolucion(
        v_centro.id,
        v_centro.local_id,
        [(base.productos["BEB-JUGO"], 2)],
        "Envases con pérdida por golpe",
        v_centro.fecha_hora + timedelta(hours=4),
    )

    # Devolución 2 (Local Norte): 1 shampoo ($3900)
    devoluciones.registrar_devolucion(
        v_norte.id,
        v_norte.local_id,
        [(base.productos["PER-SHAMP"], 1)],
        "Tapa dosificadora rota",
        v_norte.fecha_hora + timedelta(hours=5),
    )

    # Devolución 3 (Local Carlos Paz): 2 fideos ($2200)
    devoluciones.registrar_devolucion(
        v_carlospaz.id,
        v_carlospaz.local_id,
        [(base.productos["ALM-FIDEO"], 2)],
        "Paquete abierto de fábrica",
        v_carlospaz.fecha_hora + timedelta(hours=3),
    )

    # Devolución 4 (Local Río Cuarto): 1 manteca ($2400)
    devoluciones.registrar_devolucion(
        v_riocuarto.id,
        v_riocuarto.local_id,
        [(base.productos["LAC-MANTE"], 1)],
        "Envase aplastado",
        v_riocuarto.fecha_hora + timedelta(hours=6),
    )


def _tarjeta(cuotas: int) -> Estrategia_Pago:
    return Pago_Tarjeta("4509953566233704", cuotas)


def _cargar_cola_operativa(base: Datos_Base) -> None:
    """Siembra trabajo activo y accionable para cada pestaña del operador móvil y tablero."""
    servicios = Servicios_Logistica()

    # Pool de 30 precintos listos para que el operador móvil precinte bultos físicamente
    for i in range(1, 31):
        servicios.empaquetado.registrar_precinto(f"PREC-OP-{i:03d}")

    # 1. Armado: Orden en PENDIENTE para armar desde el móvil
    _crear_orden(
        servicios,
        base,
        base.locales[3],
        [("LAC-LECHE", 20), ("GOL-ALFAC", 25), ("ALM-ACEIT", 10)],
    )

    # 2. Armado: Orden en preparación con bulto en PREPARADO (listo para precintar en el móvil)
    orden_preparada = _crear_orden(
        servicios, base, base.locales[1], [("BEB-GAS", 15), ("ALM-ARROZ", 12)]
    )
    servicios.empaquetado.crear_bulto(
        orden_preparada.id, [{"producto_id": base.productos["BEB-GAS"], "cantidad": 10}]
    )

    # 3. Armado: Orden con bultos PRECINTADOS listos para aprobación inmutable US4
    orden_empaquetando = _crear_orden(
        servicios, base, base.locales[2], [("BEB-JUGO", 18), ("LIM-LAVA", 10)]
    )
    bulto1 = servicios.empaquetado.crear_bulto(
        orden_empaquetando.id, [{"producto_id": base.productos["BEB-JUGO"], "cantidad": 8}]
    )
    _precintar(servicios, bulto1.id, "PREC-DEMO-EMP-1")

    bulto2 = servicios.empaquetado.crear_bulto(
        orden_empaquetando.id, [{"producto_id": base.productos["LIM-LAVA"], "cantidad": 5}]
    )
    _precintar(servicios, bulto2.id, "PREC-DEMO-EMP-2")

    # 4. Despacho: Orden con bultos aprobados sin remito emitido (lista para generar remito)
    orden_remito = _crear_orden(
        servicios, base, base.locales[4], [("GOL-PAPAS", 15), ("PER-JABON", 12)]
    )
    _bulto_completo_precintado(
        servicios, base, orden_remito.id, [("GOL-PAPAS", 15)], "PREC-DEMO-REM-1", aprobar=True
    )
    _bulto_completo_precintado(
        servicios, base, orden_remito.id, [("PER-JABON", 12)], "PREC-DEMO-REM-2", aprobar=True
    )

    # 5. Despacho: Remito EMITIDO listo para despachar en transporte
    _crear_remito_en_etapa(servicios, base, "REM-DEMO-EMITIDO", base.locales[0], "EMITIDO")

    # 6. Recepción: Remitos DESPACHADOS en tránsito (botón 'Registrar arribo' en la app móvil)
    _crear_remito_en_etapa(servicios, base, "REM-DEMO-TRANSITO", base.locales[0], "DESPACHADO")
    _crear_remito_en_etapa(servicios, base, "REM-DEMO-NTE-TRANS", base.locales[1], "DESPACHADO")

    # 7. Recepción: Remitos RECIBIDOS con bultos pendientes (botón 'Inspeccionar bultos y precintos')
    _crear_remito_en_etapa(servicios, base, "REM-DEMO-RECIBIDO", base.locales[0], "RECIBIDO")
    _crear_remito_en_etapa(servicios, base, "REM-DEMO-SUR-RECIBIDO", base.locales[2], "RECIBIDO")

    # 8. Recepción: Remito en verificación parcial
    _crear_remito_en_etapa(servicios, base, "REM-DEMO-VERIFICACION", base.locales[0], "EN_CONTROL")

    # 9. Recepción: Remito listo para cierre con HoldToConfirm ('Mantener para cerrar e impactar stock')
    _crear_remito_en_etapa(servicios, base, "REM-DEMO-LISTO-CIERRE", base.locales[0], "LISTO_CIERRE")


def _crear_orden(
    servicios: Servicios_Logistica, base: Datos_Base, destino_id: int, items: list[tuple[str, int]]
):
    return servicios.reposicion.crear_orden_manual(
        base.cd_id,
        destino_id,
        [{"producto_id": base.productos[codigo], "cantidad": cantidad} for codigo, cantidad in items],
    )


def _precintar(servicios: Servicios_Logistica, bulto_id: int, codigo: str) -> None:
    servicios.empaquetado.registrar_precinto(codigo)
    servicios.empaquetado.precintar_bulto(bulto_id, codigo)


def _bulto_completo_precintado(
    servicios: Servicios_Logistica,
    base: Datos_Base,
    orden_id: int,
    items: list[tuple[str, int]],
    precinto: str,
    aprobar: bool = True,
) -> tuple[int, str]:
    bulto = servicios.empaquetado.crear_bulto(
        orden_id,
        [{"producto_id": base.productos[codigo], "cantidad": cantidad} for codigo, cantidad in items],
    )
    _precintar(servicios, bulto.id, precinto)
    if aprobar:
        servicios.empaquetado.aprobar_bulto(
            bulto.id, actor="Supervisor CD", observacion="Bulto aprobado para despacho"
        )
    return bulto.id, precinto


def _crear_remito_en_etapa(
    servicios: Servicios_Logistica, base: Datos_Base, numero: str, destino_id: int, etapa: str
) -> None:
    items = [("BEB-AGUA", 6), ("ALM-FIDEO", 4)]
    orden = _crear_orden(servicios, base, destino_id, items)
    primer_bulto = _bulto_completo_precintado(
        servicios, base, orden.id, [("BEB-AGUA", 6)], f"PREC-{numero}-1", aprobar=True
    )
    segundo_bulto = _bulto_completo_precintado(
        servicios, base, orden.id, [("ALM-FIDEO", 4)], f"PREC-{numero}-2", aprobar=True
    )
    servicios.empaquetado.generar_remito(numero, orden.id, [primer_bulto[0], segundo_bulto[0]])

    if etapa == "EMITIDO":
        return
    servicios.despacho.despachar_remito(numero)

    if etapa == "DESPACHADO":
        return
    servicios.recepcion.recibir_remito(numero)

    if etapa == "RECIBIDO":
        return

    if etapa == "EN_CONTROL":
        servicios.recepcion.verificar_bulto(
            primer_bulto[0], primer_bulto[1], esta_intacto=True, ubicacion_id=destino_id
        )
        return

    if etapa == "LISTO_CIERRE":
        servicios.recepcion.verificar_bulto(
            primer_bulto[0], primer_bulto[1], esta_intacto=True, ubicacion_id=destino_id
        )
        servicios.recepcion.verificar_bulto(
            segundo_bulto[0],
            segundo_bulto[1],
            esta_intacto=False,
            motivo_rechazo="Precinto violado y rotura de frascos",
            ubicacion_id=destino_id,
        )
        return


if __name__ == "__main__":
    forzar = "--reset" in sys.argv or "--force" in sys.argv or "-f" in sys.argv
    if cargar_datos_demo(forzar=forzar):
        print("Datos de demostración completos y realistas cargados exitosamente.")
    else:
        print("La base ya tenía los datos de demostración completos.")

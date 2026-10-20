"""Servicios de logistica (P3 a P6, V1, V2) con fake de stock y repositorios ORM reales."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fakes_logistica import Fake_Stock_Logistica
from modules.catalogo.domain.exceptions.catalogo_exceptions import (
    Entidad_No_Encontrada_Exception as Producto_No_Encontrado_Exception,
)
from modules.logistica.application import (
    Despacho_Service,
    Empaquetado_Service,
    Recepcion_Service,
    Reposicion_Service,
    Trazabilidad_Service,
)
from modules.logistica.domain.exceptions import (
    Bulto_Invalido_Exception,
    Bulto_No_Encontrado_Exception,
    Orden_Invalida_Exception,
    Orden_No_Encontrada_Exception,
    Precinto_Duplicado_Exception,
    Precinto_Invalido_Exception,
    Remito_Duplicado_Exception,
    Remito_Incompleto_Exception,
    Remito_No_Encontrado_Exception,
)
from modules.logistica.infrastructure import Precinto_Repository
from modules.ubicaciones_stock.domain.exceptions.stock_exceptions import (
    Entidad_No_Encontrada_Exception as Ubicacion_No_Encontrada_Exception,
    Stock_Insuficiente_Exception,
)
from sqlite_logistica_test_case import CD_ID, LOCAL_ID, PRODUCTO_A, PRODUCTO_B, Sqlite_Test_Case


class TestLogisticaServices(Sqlite_Test_Case):
    """Pruebas de integracion de los casos de uso con SQLAlchemy ORM y stock simulado."""

    def setUp(self) -> None:
        super().setUp()
        self.stock = Fake_Stock_Logistica(
            centros={CD_ID},
            locales={LOCAL_ID},
            productos={PRODUCTO_A, PRODUCTO_B},
            stock_cd={(PRODUCTO_A, CD_ID): 100, (PRODUCTO_B, CD_ID): 100},
        )
        self.reposicion = Reposicion_Service(self.stock)
        self.empaquetado = Empaquetado_Service(self.stock)
        self.despacho = Despacho_Service(self.stock)
        self.recepcion = Recepcion_Service(self.stock)
        self.trazabilidad = Trazabilidad_Service()

    def _orden(self, items: list[tuple[int, int]]):
        return self.reposicion.crear_orden_manual(
            CD_ID, LOCAL_ID, [{"producto_id": p, "cantidad": c} for p, c in items]
        )

    def _bulto_precintado(self, orden_id: int, producto_id: int, cantidad: int, precinto: str):
        bulto = self.empaquetado.crear_bulto(orden_id, [{"producto_id": producto_id, "cantidad": cantidad}])
        self.empaquetado.registrar_precinto(precinto)
        return self.empaquetado.precintar_bulto(bulto.id, precinto)

    def _ops(self, tipo: str) -> list[tuple[str, int, int, int]]:
        return [op for op in self.stock.operaciones if op[0] == tipo]

    def test_flujo_completo_happy_path_y_merma(self) -> None:
        """Prueba de extremo a extremo del flujo logistico (Happy Path P3 a P6 y regla V1)."""
        # P3: necesidades y consolidacion
        self.reposicion.registrar_necesidad(PRODUCTO_A, LOCAL_ID, 10)
        self.reposicion.registrar_necesidad(PRODUCTO_B, LOCAL_ID, 5)
        orden = self.reposicion.consolidar_necesidades_en_orden(LOCAL_ID, CD_ID)
        self.assertEqual(orden.estado, "PENDIENTE")
        self.assertEqual(len(orden.detalles), 2)

        # P4: empaquetar, precintar y emitir remito
        bulto1 = self._bulto_precintado(orden.id, PRODUCTO_A, 10, "PREC-AAA")
        bulto2 = self._bulto_precintado(orden.id, PRODUCTO_B, 5, "PREC-BBB")
        self.assertEqual(len(self._ops("RESERVAR")), 2)
        remito = self.empaquetado.generar_remito("REM-900", orden.id, [bulto1.id, bulto2.id])
        self.assertEqual(remito.estado, "EMITIDO")

        # P5: despacho
        self.assertEqual(self.despacho.despachar_remito("REM-900").estado, "DESPACHADO")
        self.assertEqual(len(self._ops("EN_TRANSITO")), 2)
        self.assertEqual(self.reposicion.obtener_orden(orden.id).estado, "DESPACHADA")

        # P6: recepcion y verificacion
        recibido = self.recepcion.recibir_remito("REM-900")
        self.assertEqual([b.estado.nombre for b in recibido.bultos], ["RECIBIDO", "RECIBIDO"])
        self.assertEqual(self.recepcion.verificar_bulto(bulto1.id, "PREC-AAA", True).estado.nombre, "VERIFICADO")
        self.assertEqual(self.recepcion.verificar_bulto(bulto2.id, "PREC-BBB", False).estado.nombre, "RECHAZADO")

        # V1: cierre con acreditacion y merma
        resumen = self.recepcion.cerrar_remito("REM-900")
        self.assertEqual(
            (resumen["estado"], resumen["unidades_acreditadas"], resumen["unidades_merma"]),
            ("CERRADO", 10, 5),
        )
        self.assertEqual(self._ops("ACREDITAR"), [("ACREDITAR", PRODUCTO_A, LOCAL_ID, 10)])
        self.assertEqual(self._ops("MERMA"), [("MERMA", PRODUCTO_B, LOCAL_ID, 5)])
        self.assertEqual(self.reposicion.obtener_orden(orden.id).estado, "CERRADA")

        # V2: trazabilidad inmutable
        trazabilidad = self.trazabilidad.consultar_resumen_trazabilidad(bulto1.id)
        self.assertEqual(
            [e["estado_nuevo"] for e in trazabilidad["eventos"]],
            ["PREPARADO", "PRECINTADO", "EN_TRANSITO", "RECIBIDO", "VERIFICADO"],
        )

    def test_precinto_roto_queda_registrado(self) -> None:
        orden = self._orden([(PRODUCTO_A, 5)])
        bulto = self._bulto_precintado(orden.id, PRODUCTO_A, 5, "PREC-R")
        self.empaquetado.generar_remito("REM-R", orden.id, [bulto.id])
        self.despacho.despachar_remito("REM-R")
        self.recepcion.recibir_remito("REM-R")

        self.recepcion.verificar_bulto(bulto.id, "PREC-R", esta_intacto=False)

        self.assertFalse(Precinto_Repository().obtener_por_codigo("PREC-R").esta_intacto)

    def test_codigo_distinto_no_marca_como_roto_al_precinto_registrado(self) -> None:
        orden = self._orden([(PRODUCTO_A, 5)])
        bulto = self._bulto_precintado(orden.id, PRODUCTO_A, 5, "PREC-OK")
        self.empaquetado.generar_remito("REM-C", orden.id, [bulto.id])
        self.despacho.despachar_remito("REM-C")
        self.recepcion.recibir_remito("REM-C")

        verificado = self.recepcion.verificar_bulto(bulto.id, "PREC-AJENO", esta_intacto=False)

        self.assertEqual(verificado.estado.nombre, "RECHAZADO")
        self.assertTrue(Precinto_Repository().obtener_por_codigo("PREC-OK").esta_intacto)

    def test_producto_repetido_en_un_bulto(self) -> None:
        orden = self._orden([(PRODUCTO_A, 5)])
        items = [{"producto_id": PRODUCTO_A, "cantidad": 1}, {"producto_id": PRODUCTO_A, "cantidad": 1}]

        with self.assertRaises(Bulto_Invalido_Exception):
            self.empaquetado.crear_bulto(orden.id, items)
        self.assertEqual(self._ops("RESERVAR"), [])

    def test_orden_no_se_despacha_mientras_queden_bultos_o_unidades(self) -> None:
        orden = self._orden([(PRODUCTO_A, 10)])
        b1 = self._bulto_precintado(orden.id, PRODUCTO_A, 4, "PREC-1")
        b2 = self._bulto_precintado(orden.id, PRODUCTO_A, 4, "PREC-2")

        self.empaquetado.generar_remito("REM-1", orden.id, [b1.id])
        self.despacho.despachar_remito("REM-1")
        self.assertEqual(self.reposicion.obtener_orden(orden.id).estado, "EN_PREPARACION")

        b3 = self._bulto_precintado(orden.id, PRODUCTO_A, 2, "PREC-3")
        self.empaquetado.generar_remito("REM-2", orden.id, [b2.id])
        self.despacho.despachar_remito("REM-2")
        self.assertEqual(self.reposicion.obtener_orden(orden.id).estado, "EN_PREPARACION")

        self.empaquetado.generar_remito("REM-3", orden.id, [b3.id])
        self.despacho.despachar_remito("REM-3")
        self.assertEqual(self.reposicion.obtener_orden(orden.id).estado, "DESPACHADA")

    def test_orden_se_cierra_recien_con_todos_sus_remitos_cerrados(self) -> None:
        orden = self._orden([(PRODUCTO_A, 2)])
        b1 = self._bulto_precintado(orden.id, PRODUCTO_A, 1, "PREC-1")
        b2 = self._bulto_precintado(orden.id, PRODUCTO_A, 1, "PREC-2")
        for numero, bulto, precinto in (("REM-1", b1, "PREC-1"), ("REM-2", b2, "PREC-2")):
            self.empaquetado.generar_remito(numero, orden.id, [bulto.id])
            self.despacho.despachar_remito(numero)
            self.recepcion.recibir_remito(numero)
            self.recepcion.verificar_bulto(bulto.id, precinto, True)

        self.recepcion.cerrar_remito("REM-1")
        self.assertEqual(self.reposicion.obtener_orden(orden.id).estado, "DESPACHADA")

        self.recepcion.cerrar_remito("REM-2")
        self.assertEqual(self.reposicion.obtener_orden(orden.id).estado, "CERRADA")

    def test_no_se_puede_cerrar_remito_con_bulto_sin_verificar(self) -> None:
        orden = self._orden([(PRODUCTO_A, 5)])
        bulto = self._bulto_precintado(orden.id, PRODUCTO_A, 5, "PREC-X")
        self.empaquetado.generar_remito("REM-901", orden.id, [bulto.id])
        self.despacho.despachar_remito("REM-901")
        self.recepcion.recibir_remito("REM-901")

        with self.assertRaises(Remito_Incompleto_Exception):
            self.recepcion.cerrar_remito("REM-901")

    def test_no_se_puede_exceder_cantidad_solicitada_en_orden(self) -> None:
        orden = self._orden([(PRODUCTO_A, 5)])
        with self.assertRaises(Orden_Invalida_Exception):
            self.empaquetado.crear_bulto(orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 10}])

    def test_sin_stock_en_el_cd_no_se_arma_el_bulto(self) -> None:
        orden = self._orden([(PRODUCTO_A, 101)])
        with self.assertRaises(Stock_Insuficiente_Exception):
            self.empaquetado.crear_bulto(orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 101}])

    def test_no_se_puede_reutilizar_precinto(self) -> None:
        orden = self._orden([(PRODUCTO_A, 5)])
        bulto1 = self.empaquetado.crear_bulto(orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 2}])
        bulto2 = self.empaquetado.crear_bulto(orden.id, [{"producto_id": PRODUCTO_A, "cantidad": 2}])
        self.empaquetado.registrar_precinto("PREC-UNICO")
        self.empaquetado.precintar_bulto(bulto1.id, "PREC-UNICO")

        with self.assertRaises(Precinto_Invalido_Exception):
            self.empaquetado.precintar_bulto(bulto2.id, "PREC-UNICO")
        with self.assertRaises(Precinto_Duplicado_Exception):
            self.empaquetado.registrar_precinto("PREC-UNICO")

    def test_remito_duplicado_y_bulto_en_dos_remitos(self) -> None:
        orden = self._orden([(PRODUCTO_A, 2)])
        b1 = self._bulto_precintado(orden.id, PRODUCTO_A, 1, "PREC-1")
        b2 = self._bulto_precintado(orden.id, PRODUCTO_A, 1, "PREC-2")
        self.empaquetado.generar_remito("REM-1", orden.id, [b1.id])

        with self.assertRaises(Remito_Duplicado_Exception):
            self.empaquetado.generar_remito("REM-1", orden.id, [b2.id])
        with self.assertRaises(Remito_Incompleto_Exception):
            self.empaquetado.generar_remito("REM-2", orden.id, [b1.id])
        with self.assertRaises(Remito_Incompleto_Exception):
            self.empaquetado.generar_remito("REM-2", orden.id, [b2.id, b2.id])

    def test_ruta_y_productos_validados_contra_integrante_1(self) -> None:
        with self.assertRaises(Ubicacion_No_Encontrada_Exception):
            self.reposicion.crear_orden_manual(LOCAL_ID, LOCAL_ID + 1, [{"producto_id": PRODUCTO_A, "cantidad": 1}])
        with self.assertRaises(Ubicacion_No_Encontrada_Exception):
            self.reposicion.crear_orden_manual(CD_ID, 99, [{"producto_id": PRODUCTO_A, "cantidad": 1}])
        with self.assertRaises(Producto_No_Encontrado_Exception):
            self._orden([(99, 1)])
        with self.assertRaises(Producto_No_Encontrado_Exception):
            self.reposicion.registrar_necesidad(99, LOCAL_ID, 1)

    def test_inexistentes_lanzan_excepciones_de_no_encontrado(self) -> None:
        casos = [
            (Orden_No_Encontrada_Exception, lambda: self.reposicion.obtener_orden(999)),
            (Orden_No_Encontrada_Exception, lambda: self.empaquetado.crear_bulto(999, [{"producto_id": 1, "cantidad": 1}])),
            (Bulto_No_Encontrado_Exception, lambda: self.empaquetado.obtener_bulto(999)),
            (Bulto_No_Encontrado_Exception, lambda: self.recepcion.verificar_bulto(999, "X", True)),
            (Bulto_No_Encontrado_Exception, lambda: self.trazabilidad.consultar_resumen_trazabilidad(999)),
            (Remito_No_Encontrado_Exception, lambda: self.despacho.despachar_remito("NO-EXISTE")),
            (Remito_No_Encontrado_Exception, lambda: self.recepcion.cerrar_remito("NO-EXISTE")),
        ]
        for excepcion, operacion in casos:
            with self.subTest(excepcion=excepcion.__name__), self.assertRaises(excepcion):
                operacion()


if __name__ == "__main__":
    unittest.main()

"""Los cinco reportes por HTTP sobre un escenario armado con la API, con resultados exactos.

Escenario (Local Centro): llegan A (precio 100, costo 60) y B (precio 50, costo 70) verificados
y un bulto de C (costo 10) con el precinto roto. Ventas: A x2 en efectivo, B x3 con tarjeta en
1 cuota, A x1 por transferencia; se devuelve 1 A de la venta en efectivo.
"""

from datetime import date
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from fastapi.testclient import TestClient

from bootstrap.application_factory import Application_Factory
from config.database.database_engine_singleton import Database_Engine_Singleton

HOY = date.today().isoformat()
PERIODO = {"desde": HOY, "hasta": HOY}


class TestReportesAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        cls._temp_dir = tempfile.TemporaryDirectory()
        url = f"sqlite:///{(Path(cls._temp_dir.name) / 'reportes.sqlite3').as_posix()}"
        cls.client = TestClient(Application_Factory.crear_aplicacion(database_url=url))
        cls._armar_escenario()

    @classmethod
    def tearDownClass(cls) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            cls._temp_dir.cleanup()
        except OSError:
            pass

    @classmethod
    def _post(cls, url: str, body: dict | None = None, **params: object) -> dict:
        res = cls.client.post(url, json=body, params=params or None)
        assert res.status_code in (200, 201), f"{url}: {res.text}"
        return res.json()

    @classmethod
    def _armar_escenario(cls) -> None:
        categoria = cls._post("/api/catalogo/categorias", {"nombre": "General"})
        proveedor = cls._post(
            "/api/catalogo/proveedores",
            {"cuit": "20123456789", "razon_social": "Prov SA", "telefono": "1", "email": "p@prov.com"},
        )
        cd = cls._post("/api/ubicaciones/centros-distribucion", {"nombre": "CD", "direccion": "Ruta 9"})
        cls.local = cls._post("/api/ubicaciones/locales", {"nombre": "Local Centro", "direccion": "San Martín 1"})
        cls._post("/api/ubicaciones/locales", {"nombre": "Local Norte", "direccion": "Rivadavia 2"})

        def producto(codigo: str, precio: str, costo: str) -> int:
            return cls._post("/api/catalogo/productos", {
                "codigo": codigo, "nombre": codigo, "precio_venta": precio, "costo_unitario": costo,
                "categoria_id": categoria["id"], "proveedor_id": proveedor["id"], "nivel_minimo_existencia": 2,
            })["id"]

        cls.a, cls.b, cls.c = producto("A", "100.00", "60.00"), producto("B", "50.00", "70.00"), producto("C", "30.00", "10.00")
        for producto_id in (cls.a, cls.b, cls.c):
            cls._post("/api/stock/ingresos", {"producto_id": producto_id, "cd_id": cd["id"], "cantidad": 100})

        orden = cls._post("/api/logistica/ordenes", {
            "origen_id": cd["id"], "destino_id": cls.local["id"],
            "items": [{"producto_id": cls.a, "cantidad": 10}, {"producto_id": cls.b, "cantidad": 10}, {"producto_id": cls.c, "cantidad": 5}],
        })
        bultos = []
        for producto_id, cantidad, precinto in ((cls.a, 10, "P-A"), (cls.b, 10, "P-B"), (cls.c, 5, "P-C")):
            bulto = cls._post(f"/api/logistica/ordenes/{orden['id']}/bultos", {"items": [{"producto_id": producto_id, "cantidad": cantidad}]})
            cls._post("/api/logistica/precintos", {"codigo": precinto})
            cls._post(f"/api/logistica/bultos/{bulto['id']}/precintar", {"codigo_precinto": precinto})
            bultos.append((bulto["id"], precinto))
        cls.bulto_rechazado = bultos[2][0]
        cls._post("/api/logistica/remitos", {"numero": "R-1", "bultos_ids": [b for b, _ in bultos]}, orden_id=orden["id"])
        cls._post("/api/logistica/remitos/R-1/despachar")
        cls._post("/api/logistica/remitos/R-1/recibir")
        for bulto_id, precinto in bultos:
            cls._post(f"/api/logistica/bultos/{bulto_id}/verificar", {"codigo_precinto_recibido": precinto, "esta_intacto": bulto_id != cls.bulto_rechazado})
        cls._post("/api/logistica/remitos/R-1/cerrar")

        def vender(items: list[tuple[int, int]], pago: dict) -> dict:
            return cls._post("/api/ventas", {
                "local_id": cls.local["id"], "items": [{"producto_id": p, "cantidad": c} for p, c in items], "pago": pago,
            })

        efectivo = vender([(cls.a, 2)], {"medio": "EFECTIVO", "monto_recibido": "500"})
        vender([(cls.b, 3)], {"medio": "TARJETA", "numero_tarjeta": "4509953566233704", "cuotas": 1})
        vender([(cls.a, 1)], {"medio": "TRANSFERENCIA", "cbu_o_alias": "mi.alias", "codigo_transaccion": "TX-1"})
        cls._post(f"/api/ventas/{efectivo['id']}/devoluciones", {
            "local_id": cls.local["id"], "motivo": "Fallado", "items": [{"producto_id": cls.a, "cantidad": 1}],
        })

    def _get(self, url: str, **params: object) -> dict:
        res = self.client.get(url, params=params)
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    def test_1_ventas_por_local_y_medio_de_pago(self) -> None:
        reporte = self._get("/api/reportes/ventas", **PERIODO)

        filas = {f["medio_pago"]: (f["cantidad_ventas"], f["total_bruto"], f["total_devoluciones"], f["total_neto"]) for f in reporte["filas"]}
        self.assertEqual(filas, {
            "EFECTIVO": (1, "200.00", "100.00", "100.00"),
            "TARJETA": (1, "150.00", "0.00", "150.00"),
            "TRANSFERENCIA": (1, "100.00", "0.00", "100.00"),
        })
        self.assertEqual(reporte["totales"]["total_neto"], "350.00")
        self.assertEqual(reporte["grafico"]["data"][0]["type"], "bar")

    def test_1_filtrado_por_un_local_sin_ventas(self) -> None:
        norte = [u for u in self._get("/api/ubicaciones", tipo="LOCAL") if u["nombre"] == "Local Norte"][0]

        reporte = self._get("/api/reportes/ventas", local_id=norte["id"], **PERIODO)

        self.assertEqual((reporte["filas"], reporte["totales"]["cantidad_ventas"]), ([], 0))

    def test_2_productos_mas_vendidos_con_margen(self) -> None:
        reporte = self._get("/api/reportes/productos-mas-vendidos", **PERIODO)

        filas = [(f["codigo"], f["unidades_netas"], f["ingresos"], f["costo"], f["margen"], f["margen_porcentaje"], f["margen_negativo"]) for f in reporte["filas"]]
        self.assertEqual(filas, [
            ("B", 3, "150.00", "210.00", "-60.00", "-40.00", True),
            ("A", 2, "200.00", "120.00", "80.00", "40.00", False),
        ])
        self.assertEqual(reporte["totales"]["productos_con_perdida"], 1)
        self.assertEqual(len(self._get("/api/reportes/productos-mas-vendidos", top=1, **PERIODO)["filas"]), 1)

    def test_3_existencias_del_local(self) -> None:
        reporte = self._get("/api/reportes/existencias", ubicacion_id=self.local["id"])

        filas = {f["codigo"]: (f["cantidad_disponible"], f["faltante"], f["en_o_bajo_minimo"], f["valorizacion"]) for f in reporte["filas"]}
        self.assertEqual(filas, {"A": (8, 0, False, "480.00"), "B": (7, 0, False, "490.00"), "C": (0, 2, True, "0.00")})
        self.assertEqual((reporte["totales"]["valorizacion"], reporte["totales"]["productos_en_o_bajo_minimo"]), ("970.00", 1))

    def test_4_mermas_por_precinto_roto(self) -> None:
        reporte = self._get("/api/reportes/mermas", **PERIODO)

        self.assertEqual(
            [(f["bulto_id"], f["remito_numero"], f["unidades_perdidas"], f["valor_perdido"], f["productos"]) for f in reporte["filas"]],
            [(self.bulto_rechazado, "R-1", 5, "50.00", ["C x5"])],
        )

    def test_5_tiempos_de_transito_por_local(self) -> None:
        reporte = self._get("/api/reportes/tiempos-transito", **PERIODO)

        self.assertEqual([(f["local_nombre"], f["cantidad_bultos"]) for f in reporte["filas"]], [("Local Centro", 3)])
        self.assertGreaterEqual(float(reporte["filas"][0]["maximo_horas"]), float(reporte["filas"][0]["minimo_horas"]))

    def test_periodo_sin_datos_y_rango_invertido(self) -> None:
        self.assertEqual(self._get("/api/reportes/mermas", desde="2020-01-01", hasta="2020-01-31")["filas"], [])
        for url in ("ventas", "productos-mas-vendidos", "mermas", "tiempos-transito"):
            with self.subTest(url=url):
                res = self.client.get(f"/api/reportes/{url}", params={"desde": "2026-02-01", "hasta": "2026-01-01"})
                self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()

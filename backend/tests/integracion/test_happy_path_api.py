"""Happy path de evaluación (docs/implementacion.md, sección 6) completo por HTTP.

Todo se carga por la API, sin SQL a mano: catálogo y ubicaciones (Int. 1), ingreso al CD,
abastecimiento del local (Int. 2), ventas que disparan el Observer, segundo ciclo logístico
con un bulto rechazado, cobros con los tres medios (Int. 3), devolución y caja.
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

TRANSFERENCIA = {"medio": "TRANSFERENCIA", "cbu_o_alias": "mi.alias.mp", "codigo_transaccion": "TX-1"}
TARJETA = {"medio": "TARJETA", "numero_tarjeta": "4509953566233704", "cuotas": 3}


class TestHappyPathAPI(unittest.TestCase):
    def setUp(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        self._temp_dir = tempfile.TemporaryDirectory()
        url = f"sqlite:///{(Path(self._temp_dir.name) / 'happy_path.sqlite3').as_posix()}"
        self.client = TestClient(Application_Factory.crear_aplicacion(database_url=url))

    def tearDown(self) -> None:
        Database_Engine_Singleton.reiniciar_para_pruebas()
        try:
            self._temp_dir.cleanup()
        except OSError:
            pass

    # --- helpers HTTP ---

    def _ok(self, metodo: str, url: str, body: dict | None = None, estado: int = 200, **params: object) -> dict | list:
        res = self.client.request(metodo, url, json=body, params=params or None)
        self.assertEqual(res.status_code, estado, f"{metodo} {url}: {res.text}")
        return res.json()

    def _stock(self, producto_id: int, ubicacion_id: int) -> tuple[int, int]:
        s = self._ok("GET", f"/api/stock/{producto_id}/{ubicacion_id}")
        return s["cantidad_disponible"], s["cantidad_en_transito"]

    def _vender(self, local_id: int, items: list[tuple[int, int]], pago: dict, estado: int = 201) -> dict:
        body = {"local_id": local_id, "items": [{"producto_id": p, "cantidad": c} for p, c in items], "pago": pago}
        return self._ok("POST", "/api/ventas", body, estado)

    def _ciclo_logistico(self, orden_id: int, bultos: list[tuple[int, int, str, bool]], remito: str) -> dict:
        """Empaqueta, precinta, emite remito, despacha, recibe, verifica y cierra."""
        ids = []
        for producto_id, cantidad, precinto, _ in bultos:
            bulto = self._ok(
                "POST", f"/api/logistica/ordenes/{orden_id}/bultos",
                {"items": [{"producto_id": producto_id, "cantidad": cantidad}]}, 201,
            )
            self._ok("POST", "/api/logistica/precintos", {"codigo": precinto}, 201)
            precintado = self._ok("POST", f"/api/logistica/bultos/{bulto['id']}/precintar", {"codigo_precinto": precinto})
            self.assertEqual(precintado["estado"], "PRECINTADO")
            ids.append(bulto["id"])
        self._ok("POST", "/api/logistica/remitos", {"numero": remito, "bultos_ids": ids}, 201, orden_id=orden_id)
        self._ok("POST", f"/api/logistica/remitos/{remito}/despachar")
        return {"ids": ids, "bultos": bultos}

    def _recibir_y_cerrar(self, remito: str, ids: list[int], bultos: list[tuple[int, int, str, bool]]) -> dict:
        self._ok("POST", f"/api/logistica/remitos/{remito}/recibir")
        for bulto_id, (_, _, precinto, intacto) in zip(ids, bultos):
            self._ok(
                "POST", f"/api/logistica/bultos/{bulto_id}/verificar",
                {"codigo_precinto_recibido": precinto, "esta_intacto": intacto},
            )
        return self._ok("POST", f"/api/logistica/remitos/{remito}/cerrar")

    def test_happy_path_de_evaluacion(self) -> None:
        # 1. Catálogo y ubicaciones (Int. 1)
        categoria = self._ok("POST", "/api/catalogo/categorias", {"nombre": "Bebidas"}, 201)
        proveedor = self._ok(
            "POST", "/api/catalogo/proveedores",
            {"cuit": "30-71234567-8", "razon_social": "Aguas del Sur SA", "telefono": "11-4000-0000", "email": "ventas@aguas.com"},
            201,
        )
        cd = self._ok("POST", "/api/ubicaciones/centros-distribucion", {"nombre": "CD Central", "direccion": "Ruta 9 km 20"}, 201)
        local = self._ok("POST", "/api/ubicaciones/locales", {"nombre": "Local Centro", "direccion": "San Martín 100"}, 201)

        def producto(codigo: str, precio: str) -> dict:
            return {
                "codigo": codigo, "nombre": f"Producto {codigo}", "precio_venta": precio, "costo_unitario": "50.00",
                "categoria_id": categoria["id"], "proveedor_id": proveedor["id"], "nivel_minimo_existencia": 3,
            }

        agua = self._ok("POST", "/api/catalogo/productos", producto("AGUA-500", "100.00"), 201)
        gaseosa = self._ok("POST", "/api/catalogo/productos", producto("GAS-1500", "250.00"), 201)
        self._ok("POST", "/api/catalogo/productos", producto("AGUA-500", "100.00"), 409)
        self.assertEqual(self._stock(agua["id"], local["id"]), (0, 0), "El alta crea stock en cero en cada ubicación")

        # 2. Ingreso al CD (solo al CD)
        self._ok("POST", "/api/stock/ingresos", {"producto_id": agua["id"], "cd_id": cd["id"], "cantidad": 100}, 201)
        self._ok("POST", "/api/stock/ingresos", {"producto_id": gaseosa["id"], "cd_id": cd["id"], "cantidad": 40}, 201)
        self._ok("POST", "/api/stock/ingresos", {"producto_id": agua["id"], "cd_id": local["id"], "cantidad": 1}, 400)
        self.assertEqual(self._stock(agua["id"], cd["id"]), (100, 0))

        # Abastecimiento inicial del local (P3 a P6)
        orden = self._ok(
            "POST", "/api/logistica/ordenes",
            {"origen_id": cd["id"], "destino_id": local["id"], "items": [
                {"producto_id": agua["id"], "cantidad": 10}, {"producto_id": gaseosa["id"], "cantidad": 10}]},
            201,
        )
        bultos = [(agua["id"], 10, "SEAL-A1", True), (gaseosa["id"], 10, "SEAL-G1", True)]
        ciclo = self._ciclo_logistico(orden["id"], bultos, "REM-0001")
        self._recibir_y_cerrar("REM-0001", ciclo["ids"], bultos)
        self.assertEqual(self._stock(agua["id"], local["id"]), (10, 0))
        self.assertEqual(self._stock(agua["id"], cd["id"]), (90, 0))

        # 3. Ventas hasta el mínimo: el Observer genera alerta y necesidad de reposición
        self._vender(local["id"], [(agua["id"], 7)], TRANSFERENCIA)
        necesidades = self._ok("GET", "/api/logistica/necesidades", local_id=local["id"])
        self.assertEqual([(n["producto_id"], n["cantidad"]) for n in necesidades], [(agua["id"], 3)])
        alertas = self._ok("GET", "/api/stock/alertas", leida=False)
        self.assertEqual([(a["producto_id"], a["ubicacion_id"]) for a in alertas], [(agua["id"], local["id"])])

        # 4. Consolidar la necesidad y empaquetar 2 bultos
        orden2 = self._ok("POST", "/api/logistica/ordenes/consolidar", {"local_destino_id": local["id"], "origen_id": cd["id"]}, 201)
        bultos2 = [(agua["id"], 2, "SEAL-A2", True), (agua["id"], 1, "SEAL-A3", False)]
        ciclo2 = self._ciclo_logistico(orden2["id"], bultos2, "REM-0002")

        # 5. Despachado: en tránsito, no disponible; no se puede vender esa mercadería
        self.assertEqual(self._stock(agua["id"], local["id"]), (3, 3))
        self._vender(local["id"], [(agua["id"], 4)], TRANSFERENCIA, estado=400)

        # 6. Recepción: bulto 1 verificado, bulto 2 con precinto roto
        cierre = self._recibir_y_cerrar("REM-0002", ciclo2["ids"], bultos2)
        self.assertEqual((cierre["unidades_acreditadas"], cierre["unidades_merma"]), (2, 1))
        self.assertEqual(self._stock(agua["id"], local["id"]), (5, 0))
        self._ok("POST", "/api/logistica/remitos/REM-0002/despachar", estado=400)
        traz = self._ok("GET", f"/api/logistica/bultos/{ciclo2['ids'][1]}/trazabilidad")
        self.assertEqual(traz["estado_actual"], "RECHAZADO")

        # 7. Ventas con los tres medios de pago (Strategy)
        efectivo = self._vender(local["id"], [(agua["id"], 1), (gaseosa["id"], 1)], {"medio": "EFECTIVO", "monto_recibido": "400"})
        self._vender(local["id"], [(gaseosa["id"], 2)], TARJETA)
        self._vender(local["id"], [(agua["id"], 1)], TRANSFERENCIA)
        comprobante = self._ok("GET", f"/api/ventas/{efectivo['id']}/comprobante")
        self.assertEqual((comprobante["total"], comprobante["vuelto"]), ("350.00", "50.00"))
        self.assertEqual(self._stock(gaseosa["id"], local["id"]), (7, 0))

        # 8. Devolución parcial y devolución de más
        devolucion = {"local_id": local["id"], "motivo": "Envase dañado", "items": [{"producto_id": gaseosa["id"], "cantidad": 1}]}
        self._ok("POST", f"/api/ventas/{efectivo['id']}/devoluciones", devolucion, 201)
        self._ok("POST", f"/api/ventas/{efectivo['id']}/devoluciones", devolucion, 400)
        self.assertEqual(self._stock(gaseosa["id"], local["id"]), (8, 0))

        # Caja del día: 700 (transf.) + 350 (efectivo) + 550 (tarjeta 3 cuotas) + 100 (transf.) - 250
        hoy = date.today().isoformat()
        caja = self._ok("GET", f"/api/caja/{local['id']}", desde=hoy, hasta=hoy)
        self.assertEqual((caja["cantidad_ventas"], caja["saldo"]), (4, "1450.00"))

        # Las órdenes completas quedaron cerradas
        self.assertEqual(self._ok("GET", f"/api/logistica/ordenes/{orden2['id']}")["estado"], "CERRADA")


if __name__ == "__main__":
    unittest.main()

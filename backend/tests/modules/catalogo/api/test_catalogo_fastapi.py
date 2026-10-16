from pathlib import Path
import sys
import unittest
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from fastapi.testclient import TestClient
from main import app


class CatalogoFastAPITests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_check(self) -> None:
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")

    def test_catalogo_flujo_api_completo(self) -> None:
        uid = uuid.uuid4().hex[:6]
        cuit = f"30{uuid.uuid4().int % 100000000:08d}1"
        cat_nombre = f"Panadería-{uid}"
        prod_codigo = f"PAN-{uid}"

        # 1. Crear categoría
        cat_resp = self.client.post("/api/catalogo/categorias", json={"nombre": cat_nombre})
        self.assertEqual(cat_resp.status_code, 201)
        cat_data = cat_resp.json()
        cat_id = cat_data["id"]
        self.assertEqual(cat_data["nombre"], cat_nombre)

        # Listar categorías
        list_cat = self.client.get("/api/catalogo/categorias")
        self.assertEqual(list_cat.status_code, 200)
        nombres = [c["nombre"] for c in list_cat.json()]
        self.assertIn(cat_nombre, nombres)

        # 2. Crear proveedor
        prov_resp = self.client.post(
            "/api/catalogo/proveedores",
            json={
                "cuit": cuit,
                "razon_social": f"Molino Harinero {uid} SA",
                "telefono": "11334455",
                "email": f"ventas_{uid}@molino.com",
            },
        )
        self.assertEqual(prov_resp.status_code, 201)
        prov_data = prov_resp.json()
        prov_id = prov_data["id"]
        self.assertEqual(prov_data["cuit"], cuit)

        # Obtener proveedor por CUIT
        obt_prov = self.client.get(f"/api/catalogo/proveedores/{cuit}")
        self.assertEqual(obt_prov.status_code, 200)
        self.assertEqual(obt_prov.json()["razon_social"], f"Molino Harinero {uid} SA")

        # 3. Crear producto
        prod_resp = self.client.post(
            "/api/catalogo/productos",
            json={
                "codigo": prod_codigo,
                "nombre": f"Pan Lactal {uid}",
                "precio_venta": 1200.0,
                "costo_unitario": 700.0,
                "categoria_id": cat_id,
                "proveedor_id": prov_id,
                "nivel_minimo": 5,
            },
        )
        self.assertEqual(prod_resp.status_code, 201)
        self.assertEqual(prod_resp.json()["codigo"], prod_codigo)

        # Obtener producto
        obt_prod = self.client.get(f"/api/catalogo/productos/{prod_codigo}")
        self.assertEqual(obt_prod.status_code, 200)
        self.assertEqual(obt_prod.json()["nombre"], f"Pan Lactal {uid}")

        # Actualizar precio
        act_precio = self.client.patch(f"/api/catalogo/productos/{prod_codigo}/precio", json={"precio_venta": 1350.0})
        self.assertEqual(act_precio.status_code, 200)
        self.assertEqual(act_precio.json()["precio_venta"], 1350.0)

        # Dar de baja producto
        baja_prod = self.client.delete(f"/api/catalogo/productos/{prod_codigo}")
        self.assertEqual(baja_prod.status_code, 204)

        # Verificar que solo_activos no lo lista
        listar_prod = self.client.get("/api/catalogo/productos", params={"activos": True})
        codigos_activos = [p["codigo"] for p in listar_prod.json()]
        self.assertNotIn(prod_codigo, codigos_activos)

    def test_catalogo_errores_api(self) -> None:
        # Categoria vacia -> 400
        resp_cat_inv = self.client.post("/api/catalogo/categorias", json={"nombre": "   "})
        self.assertEqual(resp_cat_inv.status_code, 400)

        # Proveedor CUIT invalido -> 400
        resp_prov_inv = self.client.post(
            "/api/catalogo/proveedores",
            json={"cuit": "123", "razon_social": "X", "telefono": "1", "email": "a@b.com"},
        )
        self.assertEqual(resp_prov_inv.status_code, 400)

        # No encontrado -> 404
        resp_404 = self.client.get("/api/catalogo/productos/COD-INEXISTENTE-XYZ")
        self.assertEqual(resp_404.status_code, 404)


if __name__ == "__main__":
    unittest.main()

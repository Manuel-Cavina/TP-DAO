from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "backend" / "src"))

from modules.ubicaciones_stock.domain.alerta_stock import Alerta_Stock
from modules.ubicaciones_stock.domain.observers import (
    Alerta_Stock_Observer,
    Reposicion_Local_Observer,
    Stock_Observer,
)
from modules.ubicaciones_stock.domain.stock import Stock
from modules.ubicaciones_stock.domain.ubicacion import Centro_Distribucion, Local


class Mock_Stock_Observer(Stock_Observer):
    def __init__(self) -> None:
        self.notificaciones: list[Stock] = []

    def notificar_stock_bajo(self, stock: Stock) -> None:
        self.notificaciones.append(stock)


class StockObserverTests(unittest.TestCase):
    def test_descontar_disponible_dispara_observador_cuando_perfora_minimo(self) -> None:
        stock = Stock(
            producto_id=1,
            ubicacion_id=1,
            cantidad_disponible=10,
            nivel_minimo_existencia=5,
        )
        observador = Mock_Stock_Observer()
        stock.agregar_observador(observador)

        # Descuenta y perfora el mínimo (disponible queda en 4 <= 5)
        stock.descontar_disponible(6)
        self.assertEqual(stock.cantidad_disponible, 4)
        self.assertEqual(len(observador.notificaciones), 1)
        self.assertIs(observador.notificaciones[0], stock)

    def test_descontar_disponible_dispara_observador_cuando_iguala_minimo(self) -> None:
        stock = Stock(
            producto_id=1,
            ubicacion_id=1,
            cantidad_disponible=10,
            nivel_minimo_existencia=5,
        )
        observador = Mock_Stock_Observer()
        stock.agregar_observador(observador)

        # Descuenta e iguala el mínimo (disponible queda en 5 <= 5)
        stock.descontar_disponible(5)
        self.assertEqual(stock.cantidad_disponible, 5)
        self.assertEqual(len(observador.notificaciones), 1)

    def test_descontar_disponible_no_dispara_observador_si_queda_por_encima_del_minimo(self) -> None:
        stock = Stock(
            producto_id=1,
            ubicacion_id=1,
            cantidad_disponible=10,
            nivel_minimo_existencia=5,
        )
        observador = Mock_Stock_Observer()
        stock.agregar_observador(observador)

        # Descuenta pero queda por encima (disponible queda en 7 > 5)
        stock.descontar_disponible(3)
        self.assertEqual(stock.cantidad_disponible, 7)
        self.assertEqual(len(observador.notificaciones), 0)

    def test_eliminar_observador_no_recibe_notificacion(self) -> None:
        stock = Stock(
            producto_id=1,
            ubicacion_id=1,
            cantidad_disponible=10,
            nivel_minimo_existencia=5,
        )
        observador = Mock_Stock_Observer()
        stock.agregar_observador(observador)
        stock.eliminar_observador(observador)

        stock.descontar_disponible(6)
        self.assertEqual(len(observador.notificaciones), 0)

    def test_alerta_stock_observer_persiste_alerta(self) -> None:
        stock = Stock(
            id=42,
            producto_id=10,
            ubicacion_id=2,
            cantidad_disponible=3,
            nivel_minimo_existencia=5,
        )
        mock_repo = MagicMock()
        alerta_observer = Alerta_Stock_Observer(stock_repository=mock_repo)

        alerta_observer.notificar_stock_bajo(stock)

        mock_repo.registrar_alerta.assert_called_once()
        alerta_guardada: Alerta_Stock = mock_repo.registrar_alerta.call_args[0][0]
        self.assertIsInstance(alerta_guardada, Alerta_Stock)
        self.assertEqual(alerta_guardada.stock_id, 42)
        self.assertEqual(alerta_guardada.producto_id, 10)
        self.assertEqual(alerta_guardada.ubicacion_id, 2)
        self.assertEqual(alerta_guardada.cantidad_disponible, 3)
        self.assertEqual(alerta_guardada.nivel_minimo, 5)
        self.assertFalse(alerta_guardada.leida)
        self.assertTrue(len(alerta_guardada.fecha_emision) > 0)

    def test_reposicion_local_observer_solicita_reposicion_a_local(self) -> None:
        local = Local(
            id=3,
            nombre="Sucursal Flores",
            direccion="Av. Rivadavia 7000",
            telefono="11223344",
        )
        stock = Stock(
            producto_id=100,
            ubicacion_id=3,
            cantidad_disponible=4,
            nivel_minimo_existencia=10,
            ubicacion=local,
        )
        mock_reposicion_service = MagicMock()
        observer = Reposicion_Local_Observer(reposicion_service=mock_reposicion_service)

        observer.notificar_stock_bajo(stock)

        # Fórmula: (10 * 2) - 4 = 16
        mock_reposicion_service.registrar_necesidad.assert_called_once_with(
            producto_id=100,
            local_id=3,
            cantidad=16,
        )

    def test_reposicion_local_observer_omite_en_centro_distribucion(self) -> None:
        cd = Centro_Distribucion(
            id=1,
            nombre="CD Central",
            direccion="Ruta 9 Km 40",
            telefono="0800-111",
        )
        stock = Stock(
            producto_id=100,
            ubicacion_id=1,
            cantidad_disponible=2,
            nivel_minimo_existencia=10,
            ubicacion=cd,
        )
        mock_reposicion_service = MagicMock()
        observer = Reposicion_Local_Observer(reposicion_service=mock_reposicion_service)

        observer.notificar_stock_bajo(stock)

        mock_reposicion_service.registrar_necesidad.assert_not_called()

    def test_reposicion_local_observer_con_ubicacion_repository(self) -> None:
        local = Local(
            id=5,
            nombre="Sucursal Belgrano",
            direccion="Cabildo 1000",
            telefono="44445555",
        )
        stock = Stock(
            producto_id=200,
            ubicacion_id=5,
            cantidad_disponible=3,
            nivel_minimo_existencia=8,
        )
        mock_reposicion_service = MagicMock()
        mock_ubicacion_repo = MagicMock()
        mock_ubicacion_repo.buscar_por_id.return_value = local

        observer = Reposicion_Local_Observer(
            reposicion_service=mock_reposicion_service,
            ubicacion_repository=mock_ubicacion_repo,
        )

        observer.notificar_stock_bajo(stock)

        # Fórmula: (8 * 2) - 3 = 13
        mock_reposicion_service.registrar_necesidad.assert_called_once_with(
            producto_id=200,
            local_id=5,
            cantidad=13,
        )

    def test_reposicion_repetida_no_crea_otra_necesidad_pendiente(self) -> None:
        class Servicio_Reposicion:
            def __init__(self) -> None:
                self.pendientes: set[tuple[int, int]] = set()
                self.creadas = 0

            def registrar_necesidad(self, producto_id: int, local_id: int, cantidad: int) -> int | None:
                clave = (producto_id, local_id)
                if clave in self.pendientes:
                    return None
                self.pendientes.add(clave)
                self.creadas += 1
                return self.creadas

        local = Local(id=7, nombre="Local", direccion="Dirección", telefono="123")
        stock = Stock(producto_id=1, ubicacion_id=7, cantidad_disponible=1, nivel_minimo_existencia=5, ubicacion=local)
        servicio = Servicio_Reposicion()
        observador = Reposicion_Local_Observer(servicio)

        observador.notificar_stock_bajo(stock)
        observador.notificar_stock_bajo(stock)

        self.assertEqual(servicio.creadas, 1)

    def test_alerta_stock_marcar_como_leida(self) -> None:
        alerta = Alerta_Stock(
            stock_id=1,
            producto_id=2,
            ubicacion_id=3,
            cantidad_disponible=0,
            nivel_minimo=5,
            fecha_emision="2026-10-16T10:00:00",
            leida=False,
        )
        self.assertFalse(alerta.leida)
        alerta.marcar_como_leida()
        self.assertTrue(alerta.leida)


if __name__ == "__main__":
    unittest.main()

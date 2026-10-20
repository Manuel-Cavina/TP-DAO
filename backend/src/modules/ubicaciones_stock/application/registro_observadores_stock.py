from collections.abc import Callable

from modules.ubicaciones_stock.domain import Stock_Observer

Fabrica_Observador = Callable[[], Stock_Observer]


class Registro_Observadores_Stock:
    """Observadores que otros módulos suscriben al stock, configurados por el composition root.

    bootstrap registra aquí, por ejemplo, el observer de reposición de logística: así
    ubicaciones_stock no importa a logística y logística no importa infraestructura ajena.
    """

    _fabricas: tuple[Fabrica_Observador, ...] = ()

    @classmethod
    def configurar(cls, fabricas: list[Fabrica_Observador]) -> None:
        """Reemplaza las suscripciones (idempotente: se llama en cada arranque de la app)."""
        cls._fabricas = tuple(fabricas)

    @classmethod
    def crear_observadores(cls) -> list[Stock_Observer]:
        """Una instancia nueva por servicio: los observers usan la sesión de la petición actual."""
        return [fabrica() for fabrica in cls._fabricas]

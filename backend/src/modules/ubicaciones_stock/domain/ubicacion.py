from abc import ABC, abstractmethod

from modules.ubicaciones_stock.domain.exceptions import Ubicacion_Invalida_Exception


class Ubicacion(ABC):
    """Lugar físico con stock propio. No se elimina: se da de baja lógica."""

    def __init__(
        self,
        nombre: str,
        direccion: str,
        telefono: str | None = None,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        self._id = id
        self._activo = activo
        self.actualizar(nombre, direccion, telefono)

    @property
    @abstractmethod
    def tipo(self) -> str:
        """Código persistido del tipo de ubicación: CD o LOCAL."""
        raise NotImplementedError

    @property
    def es_centro_distribucion(self) -> bool:
        return self.tipo == "CD"

    @property
    def es_local(self) -> bool:
        return self.tipo == "LOCAL"

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Ubicacion_Invalida_Exception("No se puede modificar el id de una ubicación ya asignado.")
        self._id = valor

    @property
    def nombre(self) -> str:
        return self._nombre

    @property
    def direccion(self) -> str:
        return self._direccion

    @property
    def telefono(self) -> str | None:
        return self._telefono

    @property
    def activo(self) -> bool:
        return self._activo

    def actualizar(self, nombre: str, direccion: str, telefono: str | None = None) -> None:
        self._nombre = _texto_obligatorio(nombre, "El nombre")
        self._direccion = _texto_obligatorio(direccion, "La dirección")
        self._telefono = telefono.strip() if isinstance(telefono, str) and telefono.strip() else None

    def desactivar(self) -> None:
        self._activo = False

    def reactivar(self) -> None:
        """Restore operational availability without replacing historical identity."""
        self._activo = True


class Centro_Distribucion(Ubicacion):
    """Centro de Distribución para ingresos de proveedores y despachos a locales."""

    @property
    def tipo(self) -> str:
        return "CD"

class Local(Ubicacion):
    """Local de venta al público; se abastece solo desde el CD por el flujo logístico."""

    @property
    def tipo(self) -> str:
        return "LOCAL"


_TIPOS: dict[str, type[Ubicacion]] = {"CD": Centro_Distribucion, "LOCAL": Local}


def crear_ubicacion(tipo: str, **datos: object) -> Ubicacion:
    """Fábrica para reconstruir la subclase correcta a partir del tipo persistido."""
    clase = _TIPOS.get(tipo)
    if clase is None:
        raise Ubicacion_Invalida_Exception(f"Tipo de ubicación inválido: {tipo}.")
    return clase(**datos)


def _texto_obligatorio(valor: str, campo: str) -> str:
    if not isinstance(valor, str) or not valor.strip():
        raise Ubicacion_Invalida_Exception(f"{campo} de la ubicación es obligatorio.")
    return valor.strip()

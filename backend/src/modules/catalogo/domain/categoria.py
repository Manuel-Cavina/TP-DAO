from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception


class Categoria:
    """Agrupación de productos del catálogo. Se da de baja en forma lógica."""

    def __init__(self, nombre: str, id: int | None = None, activo: bool = True) -> None:
        self._id = id
        self._nombre = _validar_nombre(nombre)
        self._activo = activo

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Datos_Invalidos_Exception("No se puede modificar el id de una categoría ya asignado.")
        self._id = valor

    @property
    def nombre(self) -> str:
        return self._nombre

    @property
    def activo(self) -> bool:
        return self._activo

    def renombrar(self, nombre: str) -> None:
        self._nombre = _validar_nombre(nombre)

    def desactivar(self) -> None:
        self._activo = False


def _validar_nombre(nombre: str) -> str:
    if not isinstance(nombre, str) or not nombre.strip():
        raise Datos_Invalidos_Exception("El nombre de la categoría es obligatorio.")
    if len(nombre.strip()) > 100:
        raise Datos_Invalidos_Exception("El nombre de la categoría admite hasta 100 caracteres.")
    return nombre.strip()

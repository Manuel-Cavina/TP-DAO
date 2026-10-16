from domain.model.catalogo.categoria import Categoria
from domain.model.catalogo.proveedor import Proveedor


class Producto:
    def __init__(self, id: str, nombre: str, precio: float, categoria: Categoria, proveedor: Proveedor):
        self._id = id
        self._nombre = nombre
        self._precio = precio
        self._categoria = categoria
        self._proveedor = proveedor

    @property
    def id(self) -> str:
        return self._id

    @id.setter
    def id(self, value: str) -> None:
        self._id = value

    @property
    def nombre(self) -> str:
        return self._nombre

    @nombre.setter
    def nombre(self, value: str) -> None:
        self._nombre = value

    @property
    def precio(self) -> float:
        return self._precio

    @precio.setter
    def precio(self, value: float) -> None:
        self._precio = value

    @property
    def categoria(self) -> Categoria:
        return self._categoria

    @categoria.setter
    def categoria(self, value: Categoria) -> None:
        self._categoria = value

    @property
    def proveedor(self) -> Proveedor:
        return self._proveedor

    @proveedor.setter
    def proveedor(self, value: Proveedor) -> None:
        self._proveedor = value

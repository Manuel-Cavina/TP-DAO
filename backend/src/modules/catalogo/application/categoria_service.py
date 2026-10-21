from modules.catalogo.domain import Categoria
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception, Entidad_No_Encontrada_Exception
from modules.catalogo.infrastructure.categoria_repository import Categoria_Repository


class Categoria_Service:
    """Alta, modificación, baja lógica y consulta de categorías (P2)."""

    def __init__(self, categoria_repository: Categoria_Repository | None = None) -> None:
        self._repository = categoria_repository if categoria_repository is not None else Categoria_Repository()

    def crear(self, nombre: str) -> Categoria:
        categoria = Categoria(nombre)
        self._validar_nombre_libre(categoria.nombre)
        return self._repository.guardar(categoria)

    def renombrar(self, categoria_id: int, nombre: str) -> Categoria:
        categoria = self.obtener(categoria_id)
        categoria.renombrar(nombre)
        self._validar_nombre_libre(categoria.nombre, excepto_id=categoria_id)
        self._repository.actualizar(categoria)
        return categoria

    def desactivar(self, categoria_id: int) -> Categoria:
        categoria = self.obtener(categoria_id)
        categoria.desactivar()
        self._repository.actualizar(categoria)
        return categoria

    def obtener(self, categoria_id: int) -> Categoria:
        categoria = self._repository.obtener_por_id(categoria_id)
        if categoria is None:
            raise Entidad_No_Encontrada_Exception(f"No existe la categoría {categoria_id}.")
        return categoria

    def listar(self, solo_activas: bool = False, q: str | None = None) -> list[Categoria]:
        return self._repository.listar(solo_activas, q=q)

    def _validar_nombre_libre(self, nombre: str, excepto_id: int | None = None) -> None:
        existente = self._repository.obtener_por_nombre(nombre)
        if existente is not None and existente.id != excepto_id:
            raise Entidad_Duplicada_Exception(f"Ya existe la categoría '{nombre}'.")

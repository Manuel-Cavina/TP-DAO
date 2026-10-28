from modules.catalogo.domain import Proveedor
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception, Entidad_No_Encontrada_Exception
from modules.catalogo.infrastructure.proveedor_repository import Proveedor_Repository


class Proveedor_Service:
    """Alta, modificación, baja lógica y consulta de proveedores (P2, V4)."""

    def __init__(self, proveedor_repository: Proveedor_Repository | None = None) -> None:
        self._repository = proveedor_repository if proveedor_repository is not None else Proveedor_Repository()

    def crear(self, cuit: str, razon_social: str, telefono: str, email: str) -> Proveedor:
        proveedor = Proveedor(cuit, razon_social, telefono, email)
        if self._repository.obtener_por_cuit(proveedor.cuit) is not None:
            raise Entidad_Duplicada_Exception(f"Ya existe un proveedor con CUIT {proveedor.cuit}.")
        return self._repository.guardar(proveedor)

    def actualizar(self, proveedor_id: int, razon_social: str, telefono: str, email: str) -> Proveedor:
        proveedor = self.obtener(proveedor_id)
        proveedor.actualizar_datos(razon_social, telefono, email)
        self._repository.actualizar(proveedor)
        return proveedor

    def desactivar(self, proveedor_id: int) -> Proveedor:
        proveedor = self.obtener(proveedor_id)
        proveedor.desactivar()
        self._repository.actualizar(proveedor)
        return proveedor

    def obtener(self, proveedor_id: int) -> Proveedor:
        proveedor = self._repository.obtener_por_id(proveedor_id)
        if proveedor is None:
            raise Entidad_No_Encontrada_Exception(f"No existe el proveedor {proveedor_id}.")
        return proveedor

    def listar(self, solo_activos: bool = False, q: str | None = None) -> list[Proveedor]:
        return self._repository.listar(solo_activos, q=q)

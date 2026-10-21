from modules.catalogo.application import Catalogo_Consulta_Service
from modules.ubicaciones_stock.domain import NIVEL_MINIMO_INICIAL, Centro_Distribucion, Local, Stock, Ubicacion
from modules.ubicaciones_stock.domain.exceptions import (
    Centro_Distribucion_Duplicado_Exception,
    Entidad_No_Encontrada_Exception,
)
from modules.ubicaciones_stock.infrastructure.stock_repository import Stock_Repository
from modules.ubicaciones_stock.infrastructure.ubicacion_repository import Ubicacion_Repository


class Ubicacion_Service:
    """Administración de locales y del Centro de Distribución (P1).

    No se eliminan ubicaciones: tienen stock, ventas o bultos asociados, así que se dan de baja lógica.
    """

    def __init__(
        self,
        ubicacion_repository: Ubicacion_Repository | None = None,
        stock_repository: Stock_Repository | None = None,
        catalogo: Catalogo_Consulta_Service | None = None,
    ) -> None:
        self._repository = ubicacion_repository if ubicacion_repository is not None else Ubicacion_Repository()
        self._stocks = stock_repository if stock_repository is not None else Stock_Repository()
        self._catalogo = catalogo if catalogo is not None else Catalogo_Consulta_Service()

    def crear_local(self, nombre: str, direccion: str, telefono: str | None = None) -> Ubicacion:
        return self._crear(Local(nombre, direccion, telefono))

    def crear_centro_distribucion(self, nombre: str, direccion: str, telefono: str | None = None) -> Ubicacion:
        if self._repository.listar(tipo="CD"):
            raise Centro_Distribucion_Duplicado_Exception("El sistema admite un único Centro de Distribución.")
        return self._crear(Centro_Distribucion(nombre, direccion, telefono))

    def actualizar(self, ubicacion_id: int, nombre: str, direccion: str, telefono: str | None = None) -> Ubicacion:
        ubicacion = self.obtener(ubicacion_id)
        ubicacion.actualizar(nombre, direccion, telefono)
        self._repository.actualizar(ubicacion)
        return ubicacion

    def desactivar(self, ubicacion_id: int) -> Ubicacion:
        ubicacion = self.obtener(ubicacion_id)
        ubicacion.desactivar()
        self._repository.actualizar(ubicacion)
        return ubicacion

    def obtener(self, ubicacion_id: int) -> Ubicacion:
        ubicacion = self._repository.obtener_por_id(ubicacion_id)
        if ubicacion is None:
            raise Entidad_No_Encontrada_Exception(f"No existe la ubicación {ubicacion_id}.")
        return ubicacion

    def listar(
        self,
        tipo: str | None = None,
        solo_activas: bool = False,
        q: str | None = None,
    ) -> list[Ubicacion]:
        return self._repository.listar(tipo, solo_activas, q=q)

    def validar_local(self, ubicacion_id: int) -> Ubicacion:
        """Devuelve el local activo o falla: ventas y destinos de reposición solo van a locales."""
        return self._validar_activa(ubicacion_id, "LOCAL", "local")

    def validar_centro_distribucion(self, ubicacion_id: int) -> Ubicacion:
        """Devuelve el CD activo o falla: ingresos y despachos solo salen del CD."""
        return self._validar_activa(ubicacion_id, "CD", "Centro de Distribución")

    def _crear(self, ubicacion: Ubicacion) -> Ubicacion:
        """Una ubicación nueva nace con stock en cero de cada producto activo."""
        guardada = self._repository.guardar(ubicacion)
        for producto_id in self._catalogo.listar_ids_productos_activos():
            self._stocks.guardar(
                Stock(
                    producto_id,
                    guardada.id,
                    NIVEL_MINIMO_INICIAL,
                    es_local=guardada.es_local,
                )
            )
        return guardada

    def _validar_activa(self, ubicacion_id: int, tipo: str, descripcion: str) -> Ubicacion:
        ubicacion = self._repository.obtener_por_id(ubicacion_id)
        if ubicacion is None or not ubicacion.activo or ubicacion.tipo != tipo:
            raise Entidad_No_Encontrada_Exception(f"No existe un {descripcion} activo con id {ubicacion_id}.")
        return ubicacion

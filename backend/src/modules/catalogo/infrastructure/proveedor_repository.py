from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.catalogo.domain import Proveedor
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception
from modules.catalogo.infrastructure.models import Proveedor_Model


class Proveedor_Repository:
    """Repositorio ORM de proveedores."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, proveedor: Proveedor) -> Proveedor:
        modelo = Proveedor_Model(cuit=proveedor.cuit)
        self._copiar(proveedor, modelo)
        self._get_session().add(modelo)
        self._flush(proveedor.cuit)
        proveedor.id = modelo.id
        return proveedor

    def actualizar(self, proveedor: Proveedor) -> None:
        modelo = self._get_session().get(Proveedor_Model, proveedor.id)
        self._copiar(proveedor, modelo)
        self._flush(proveedor.cuit)

    def obtener_por_id(self, proveedor_id: int) -> Proveedor | None:
        modelo = self._get_session().get(Proveedor_Model, proveedor_id)
        return self._a_dominio(modelo) if modelo is not None else None

    def obtener_por_cuit(self, cuit: str) -> Proveedor | None:
        stmt = select(Proveedor_Model).where(Proveedor_Model.cuit == cuit)
        modelo = self._get_session().scalars(stmt).first()
        return self._a_dominio(modelo) if modelo is not None else None

    def listar(self, solo_activos: bool = False) -> list[Proveedor]:
        stmt = select(Proveedor_Model).order_by(Proveedor_Model.razon_social)
        if solo_activos:
            stmt = stmt.where(Proveedor_Model.activo.is_(True))
        return [self._a_dominio(m) for m in self._get_session().scalars(stmt)]

    def _flush(self, cuit: str) -> None:
        try:
            self._get_session().flush()
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(f"Ya existe un proveedor con CUIT {cuit}.") from error

    @staticmethod
    def _copiar(proveedor: Proveedor, modelo: Proveedor_Model) -> None:
        modelo.razon_social = proveedor.razon_social
        modelo.telefono = proveedor.telefono
        modelo.email = proveedor.email
        modelo.activo = proveedor.activo

    @staticmethod
    def _a_dominio(modelo: Proveedor_Model) -> Proveedor:
        return Proveedor(
            cuit=modelo.cuit,
            razon_social=modelo.razon_social,
            telefono=modelo.telefono,
            email=modelo.email,
            id=modelo.id,
            activo=modelo.activo,
        )

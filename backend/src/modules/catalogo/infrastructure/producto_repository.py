import re

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.database.request_session_context import Request_Session_Context
from modules.catalogo.domain import Producto
from modules.catalogo.domain.exceptions import Entidad_Duplicada_Exception
from modules.catalogo.infrastructure.models import Numerador_Producto_Model, Producto_Model


class Producto_Repository:
    """Repositorio ORM de productos."""

    def _get_session(self) -> Session:
        return Request_Session_Context.obtener_sesion()

    def guardar(self, producto: Producto) -> Producto:
        modelo = Producto_Model(codigo=producto.codigo)
        self._copiar(producto, modelo)
        self._get_session().add(modelo)
        self._flush(producto.codigo)
        producto.id = modelo.id
        return producto

    def siguiente_codigo(self) -> str:
        """Reserva el próximo SKU dentro de la transacción actual."""
        session = self._get_session()
        numerador = session.get(Numerador_Producto_Model, "SKU")
        if numerador is None:
            existentes = session.scalars(select(Producto_Model.codigo)).all()
            ultimo = max(
                (int(coincidencia.group(1)) for codigo in existentes if (coincidencia := re.fullmatch(r"SKU-(\d+)", codigo))),
                default=0,
            )
            numerador = Numerador_Producto_Model(clave="SKU", ultimo_numero=ultimo)
            session.add(numerador)
            session.flush()
        numerador.ultimo_numero += 1
        session.flush()
        return f"SKU-{numerador.ultimo_numero:06d}"

    def actualizar(self, producto: Producto) -> None:
        modelo = self._get_session().get(Producto_Model, producto.id)
        self._copiar(producto, modelo)
        self._flush(producto.codigo)

    def obtener_por_id(self, producto_id: int) -> Producto | None:
        modelo = self._get_session().get(Producto_Model, producto_id)
        return self._a_dominio(modelo) if modelo is not None else None

    def obtener_por_codigo(self, codigo: str) -> Producto | None:
        stmt = select(Producto_Model).where(Producto_Model.codigo == codigo.strip())
        modelo = self._get_session().scalars(stmt).first()
        return self._a_dominio(modelo) if modelo is not None else None

    def listar(self, solo_activos: bool = False, categoria_id: int | None = None, q: str | None = None) -> list[Producto]:
        stmt = select(Producto_Model).order_by(Producto_Model.codigo)
        if solo_activos:
            stmt = stmt.where(Producto_Model.activo.is_(True))
        if categoria_id is not None:
            stmt = stmt.where(Producto_Model.categoria_id == categoria_id)
        if q and q.strip():
            patron = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Producto_Model.nombre.ilike(patron),
                    Producto_Model.codigo.ilike(patron),
                )
            )
        return [self._a_dominio(m) for m in self._get_session().scalars(stmt)]

    def _flush(self, codigo: str) -> None:
        try:
            self._get_session().flush()
        except IntegrityError as error:
            raise Entidad_Duplicada_Exception(f"Ya existe un producto con código '{codigo}'.") from error

    @staticmethod
    def _copiar(producto: Producto, modelo: Producto_Model) -> None:
        modelo.nombre = producto.nombre
        modelo.precio_venta = producto.precio_venta
        modelo.costo_unitario = producto.costo_unitario
        modelo.categoria_id = producto.categoria_id
        modelo.proveedor_id = producto.proveedor_id
        modelo.activo = producto.activo

    @staticmethod
    def _a_dominio(modelo: Producto_Model) -> Producto:
        return Producto(
            codigo=modelo.codigo,
            nombre=modelo.nombre,
            precio_venta=modelo.precio_venta,
            costo_unitario=modelo.costo_unitario,
            categoria_id=modelo.categoria_id,
            proveedor_id=modelo.proveedor_id,
            id=modelo.id,
            activo=modelo.activo,
        )

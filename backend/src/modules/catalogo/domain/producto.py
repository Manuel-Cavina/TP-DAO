from decimal import Decimal

from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception


class Producto:
    """Producto del catálogo. El código no se repite (V4); el precio cambia sin afectar ventas pasadas."""

    def __init__(
        self,
        codigo: str,
        nombre: str,
        precio_venta: Decimal,
        costo_unitario: Decimal,
        categoria_id: int,
        proveedor_id: int,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        if not isinstance(codigo, str) or not codigo.strip() or len(codigo.strip()) > 50:
            raise Datos_Invalidos_Exception("El código del producto es obligatorio (hasta 50 caracteres).")
        self._id = id
        self._codigo = codigo.strip()
        self._activo = activo
        self.actualizar(nombre, precio_venta, costo_unitario, categoria_id, proveedor_id)

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Datos_Invalidos_Exception("No se puede modificar el id de un producto ya asignado.")
        self._id = valor

    @property
    def codigo(self) -> str:
        return self._codigo

    @property
    def nombre(self) -> str:
        return self._nombre

    @property
    def precio_venta(self) -> Decimal:
        return self._precio_venta

    @property
    def costo_unitario(self) -> Decimal:
        return self._costo_unitario

    @property
    def categoria_id(self) -> int:
        return self._categoria_id

    @property
    def proveedor_id(self) -> int:
        return self._proveedor_id

    @property
    def activo(self) -> bool:
        return self._activo

    def actualizar(
        self,
        nombre: str,
        precio_venta: Decimal,
        costo_unitario: Decimal,
        categoria_id: int,
        proveedor_id: int,
    ) -> None:
        """Modifica el producto; el código no cambia porque lo identifica."""
        if not isinstance(nombre, str) or not nombre.strip():
            raise Datos_Invalidos_Exception("El nombre del producto es obligatorio.")
        self._nombre = nombre.strip()
        self._precio_venta = _importe_positivo(precio_venta, "El precio de venta")
        self._costo_unitario = _importe_positivo(costo_unitario, "El costo unitario")
        self._categoria_id = _id_positivo(categoria_id, "La categoría")
        self._proveedor_id = _id_positivo(proveedor_id, "El proveedor")

    def desactivar(self) -> None:
        self._activo = False

    def activar(self) -> None:
        self._activo = True


def _importe_positivo(valor: Decimal, campo: str) -> Decimal:
    if not isinstance(valor, Decimal) or not valor.is_finite() or valor <= 0:
        raise Datos_Invalidos_Exception(f"{campo} debe ser un Decimal mayor a cero.")
    return valor


def _id_positivo(valor: int, campo: str) -> int:
    if not isinstance(valor, int) or isinstance(valor, bool) or valor <= 0:
        raise Datos_Invalidos_Exception(f"{campo} debe ser un identificador entero positivo.")
    return valor

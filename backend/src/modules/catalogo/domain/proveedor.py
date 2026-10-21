import re

from modules.catalogo.domain.exceptions import Datos_Invalidos_Exception

_CUIT = re.compile(r"[0-9]{11}")
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class Proveedor:
    """Proveedor de mercadería. El CUIT (11 dígitos) lo identifica y no se repite (V4)."""

    def __init__(
        self,
        cuit: str,
        razon_social: str,
        telefono: str,
        email: str,
        id: int | None = None,
        activo: bool = True,
    ) -> None:
        cuit_normalizado = cuit.replace("-", "").strip() if isinstance(cuit, str) else ""
        if not _CUIT.fullmatch(cuit_normalizado):
            raise Datos_Invalidos_Exception("El CUIT debe tener 11 dígitos.")
        self._id = id
        self._cuit = cuit_normalizado
        self._activo = activo
        self.actualizar_datos(razon_social, telefono, email)

    @property
    def id(self) -> int | None:
        return self._id

    @id.setter
    def id(self, valor: int) -> None:
        if self._id is not None:
            raise Datos_Invalidos_Exception("No se puede modificar el id de un proveedor ya asignado.")
        self._id = valor

    @property
    def cuit(self) -> str:
        return self._cuit

    @property
    def razon_social(self) -> str:
        return self._razon_social

    @property
    def telefono(self) -> str:
        return self._telefono

    @property
    def email(self) -> str:
        return self._email

    @property
    def activo(self) -> bool:
        return self._activo

    def actualizar_datos(self, razon_social: str, telefono: str, email: str) -> None:
        """Modifica los datos de contacto; el CUIT no cambia porque identifica al proveedor."""
        self._razon_social = _texto_obligatorio(razon_social, "La razón social")
        self._telefono = _texto_obligatorio(telefono, "El teléfono")
        email_limpio = _texto_obligatorio(email, "El email")
        if not _EMAIL.fullmatch(email_limpio):
            raise Datos_Invalidos_Exception("El email del proveedor no tiene un formato válido.")
        self._email = email_limpio

    def desactivar(self) -> None:
        self._activo = False


def _texto_obligatorio(valor: str, campo: str) -> str:
    if not isinstance(valor, str) or not valor.strip():
        raise Datos_Invalidos_Exception(f"{campo} del proveedor es obligatorio.")
    return valor.strip()

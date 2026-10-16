from modules.logistica.domain.exceptions import Precinto_Invalido_Exception


class Precinto:
    """Representa el precinto de seguridad asignado a un bulto."""

    def __init__(self, codigo: str, esta_intacto: bool = True) -> None:
        if not codigo or not codigo.strip():
            raise Precinto_Invalido_Exception("El codigo de precinto no puede estar vacio.")
        self._codigo: str = codigo.strip()
        self._esta_intacto: bool = esta_intacto

    @property
    def codigo(self) -> str:
        return self._codigo

    @property
    def esta_intacto(self) -> bool:
        return self._esta_intacto

    def romper(self) -> None:
        """Marca el precinto como roto o violado."""
        self._esta_intacto = False

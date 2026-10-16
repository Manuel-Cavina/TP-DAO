class Precinto:
    def __init__(self, codigo: str, esta_intacto: bool = True):
        self._codigo = codigo
        self._esta_intacto = esta_intacto

    @property
    def codigo(self) -> str:
        return self._codigo

    @codigo.setter
    def codigo(self, value: str) -> None:
        self._codigo = value

    @property
    def esta_intacto(self) -> bool:
        return self._esta_intacto

    @esta_intacto.setter
    def esta_intacto(self, value: bool) -> None:
        self._esta_intacto = value

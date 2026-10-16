class Proveedor:
    def __init__(self, cuit: str, razon_social: str):
        self._cuit = cuit
        self._razon_social = razon_social

    @property
    def cuit(self) -> str:
        return self._cuit

    @cuit.setter
    def cuit(self, value: str) -> None:
        self._cuit = value

    @property
    def razon_social(self) -> str:
        return self._razon_social

    @razon_social.setter
    def razon_social(self, value: str) -> None:
        self._razon_social = value

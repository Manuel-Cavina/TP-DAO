from domain.model.ubicaciones.ubicacion import Ubicacion


class Local(Ubicacion):
    def __init__(self, id: str, nombre: str, direccion: str, telefono: str):
        super().__init__(id, nombre, direccion)
        self._telefono = telefono

    @property
    def telefono(self) -> str:
        return self._telefono

    @telefono.setter
    def telefono(self, value: str) -> None:
        self._telefono = value

    def procesar_venta(self) -> None:
        raise NotImplementedError

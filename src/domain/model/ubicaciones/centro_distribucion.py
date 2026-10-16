from domain.model.ubicaciones.ubicacion import Ubicacion


class CentroDistribucion(Ubicacion):
    def __init__(self, id: str, nombre: str, direccion: str):
        super().__init__(id, nombre, direccion)

    def armar_bulto(self) -> None:
        raise NotImplementedError

    def despachar_remito(self) -> None:
        raise NotImplementedError

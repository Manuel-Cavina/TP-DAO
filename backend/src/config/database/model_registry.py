"""Registro explícito de modelos ORM del monolito modular."""


def cargar_modelos() -> None:
    """Importa modelos ORM permitidos antes de ``Base.metadata.create_all``.

    La Fase 1 no registra entidades porque los módulos aún usan persistencia
    legada. Cada migración de módulo agrega aquí su import explícito; no se
    permite descubrimiento dinámico de paquetes.
    """

"""Registro explícito de modelos ORM del monolito modular."""


def cargar_modelos() -> None:
    """Importa modelos ORM permitidos antes de ``Base.metadata.create_all``.

    Cada migración de módulo agrega aquí su import explícito; no se
    permite descubrimiento dinámico de paquetes.
    """
    import modules.logistica.infrastructure.models  # noqa: F401
    import modules.ventas_caja.infrastructure.models  # noqa: F401

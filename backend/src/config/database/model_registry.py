"""Registro explícito de modelos ORM del monolito modular."""


def cargar_modelos() -> None:
    """Importa modelos ORM permitidos antes de ``Base.metadata.create_all``."""
    import modules.catalogo.domain.categoria  # noqa: F401
    import modules.catalogo.domain.proveedor  # noqa: F401
    import modules.catalogo.domain.producto  # noqa: F401
    import modules.ubicaciones_stock.domain.ubicacion  # noqa: F401
    import modules.ubicaciones_stock.domain.stock  # noqa: F401
    import modules.ubicaciones_stock.domain.alerta_stock  # noqa: F401
    import modules.logistica.infrastructure.models  # noqa: F401

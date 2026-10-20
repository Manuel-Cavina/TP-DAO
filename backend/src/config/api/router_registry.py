"""Registro central de routers de los módulos disponibles."""

from fastapi import FastAPI


def registrar_routers(app: FastAPI) -> None:
    """Incluye routers sin trasladar lógica de módulos a bootstrap."""
    try:
        from modules.catalogo.api import catalogo_router

        app.include_router(catalogo_router)
    except (ImportError, AttributeError):
        pass

    try:
        from modules.ubicaciones_stock.api import stock_router

        app.include_router(stock_router)
    except (ImportError, AttributeError):
        pass

    # Import explícito: si el módulo se rompe, el arranque falla en vez de dar 404 silencioso.
    from modules.logistica.api import logistica_router
    from modules.ventas_caja.api import caja_router, ventas_router

    app.include_router(logistica_router)

    app.include_router(ventas_router)
    app.include_router(caja_router)

    @app.get("/", tags=["Health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "app": "ERP Monolito Modular"}

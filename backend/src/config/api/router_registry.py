"""Registro central de routers de los módulos disponibles."""

from fastapi import FastAPI


def registrar_routers(app: FastAPI) -> None:
    """Incluye routers sin trasladar lógica de módulos a bootstrap."""
    from modules.catalogo.api import catalogo_router
    from modules.ubicaciones_stock.api import stock_router

    app.include_router(catalogo_router)
    app.include_router(stock_router)

    @app.get("/", tags=["Health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "app": "ERP Monolito Modular"}

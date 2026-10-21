"""Registro central de routers de los módulos disponibles."""

from fastapi import FastAPI


def registrar_routers(app: FastAPI) -> None:
    """Incluye routers sin trasladar lógica de módulos a bootstrap.

    Imports explícitos: si un módulo se rompe, el arranque falla en vez de dar 404 silencioso.
    """
    from modules.catalogo.api import catalogo_router
    from modules.logistica.api import logistica_router
    from modules.reportes.api import reportes_router
    from modules.ubicaciones_stock.api import stock_router, ubicaciones_router
    from modules.ventas_caja.api import caja_router, ventas_router

    for router in (
        catalogo_router,
        ubicaciones_router,
        stock_router,
        logistica_router,
        ventas_router,
        caja_router,
        reportes_router,
    ):
        app.include_router(router)

    @app.get("/", tags=["Health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "app": "ERP Monolito Modular"}

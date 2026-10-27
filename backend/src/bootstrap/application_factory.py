"""Factory de la aplicación FastAPI y sus componentes globales."""

from os import getenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.api.database_session_middleware import Database_Session_Middleware
from config.api.exception_handlers import registrar_manejadores_excepciones
from config.api.router_registry import registrar_routers
from config.database.base import Base
from config.database.database_engine_singleton import Database_Engine_Singleton
from config.database.model_registry import cargar_modelos
from config.database.schema_migrations import aplicar_migraciones_sqlite
from modules.logistica.application import Registro_Necesidad_Desde_Stock
from modules.ubicaciones_stock.application import Registro_Observadores_Stock, Reposicion_Local_Observer


class Application_Factory:
    """Crea una aplicación configurada, sin lógica de negocio."""

    @staticmethod
    def crear_aplicacion(database_url: str | None = None) -> FastAPI:
        """Inicializa ORM, middleware, handlers y routers en orden determinista."""
        engine = Database_Engine_Singleton.obtener_instancia(database_url)
        cargar_modelos()
        Base.metadata.create_all(engine)
        aplicar_migraciones_sqlite(engine)
        Application_Factory._suscribir_observadores_de_stock()

        app = FastAPI(
            title="ERP Monolito Modular - Distribución y Ventas",
            description="Sistema de Ventas e Inventario (Centro de Distribución a Locales)",
            version="1.0.0",
        )
        app.add_middleware(
            CORSMiddleware,
            allow_origins=Application_Factory._origenes_cors(),
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
        )
        app.add_middleware(Database_Session_Middleware)
        registrar_manejadores_excepciones(app)
        registrar_routers(app)
        return app

    @staticmethod
    def _suscribir_observadores_de_stock() -> None:
        """Composition root del Observer: logística recibe las necesidades de reposición de los locales.

        Se arma aquí para que ubicaciones_stock no dependa de logística.
        """
        Registro_Observadores_Stock.configurar(
            [lambda: Reposicion_Local_Observer(Registro_Necesidad_Desde_Stock())]
        )

    @staticmethod
    def _origenes_cors() -> list[str]:
        """Devuelve orígenes explícitos; no combina credenciales con comodines."""
        valor = getenv("ERP_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        return [origen.strip() for origen in valor.split(",") if origen.strip()]

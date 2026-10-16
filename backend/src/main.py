from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.database import sqlite_connection
from modules.logistica.api import logistica_router
from modules.logistica.infrastructure import crear_tablas_logistica


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializacion de tablas SQLite
    with sqlite_connection() as conn:
        crear_tablas_logistica(conn)
    yield


app = FastAPI(
    title="Sistema de Ventas e Inventario - Centro de Distribucion a Locales",
    description="TP Integrador DAO 2026 - Tema 3. API REST y Servidor Asincrono.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configuracion de CORS para comunicacion con el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers de los modulos
app.include_router(logistica_router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "modulo": "logistica_y_trazabilidad"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

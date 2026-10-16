import sqlite3

DDL_LOGISTICA = """
CREATE TABLE IF NOT EXISTS necesidades_reposicion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id TEXT NOT NULL,
    local_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE',
    orden_id INTEGER,
    fecha_registro TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ordenes_reposicion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origen_id TEXT NOT NULL,
    destino_id TEXT NOT NULL,
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
);

CREATE TABLE IF NOT EXISTS detalles_orden_reposicion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad_solicitada INTEGER NOT NULL,
    cantidad_enviada INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (orden_id) REFERENCES ordenes_reposicion(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS precintos (
    codigo TEXT PRIMARY KEY,
    esta_intacto INTEGER NOT NULL DEFAULT 1,
    utilizado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS remitos (
    numero TEXT PRIMARY KEY,
    origen_id TEXT NOT NULL,
    destino_id TEXT NOT NULL,
    fecha_emision TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'EMITIDO'
);

CREATE TABLE IF NOT EXISTS bultos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    remito_numero TEXT,
    codigo_precinto TEXT,
    estado TEXT NOT NULL DEFAULT 'PREPARADO',
    FOREIGN KEY (orden_id) REFERENCES ordenes_reposicion(id),
    FOREIGN KEY (remito_numero) REFERENCES remitos(numero),
    FOREIGN KEY (codigo_precinto) REFERENCES precintos(codigo)
);

CREATE TABLE IF NOT EXISTS detalles_bulto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bulto_id INTEGER NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    FOREIGN KEY (bulto_id) REFERENCES bultos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS historial_bultos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bulto_id INTEGER NOT NULL,
    estado_anterior TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    fecha_hora TEXT NOT NULL,
    observacion TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (bulto_id) REFERENCES bultos(id)
);
"""


def crear_tablas_logistica(connection: sqlite3.Connection) -> None:
    """Ejecuta la creacion de tablas correspondientes al modulo de logistica."""
    connection.executescript(DDL_LOGISTICA)

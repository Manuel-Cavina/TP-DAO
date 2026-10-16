-- Esquema DDL SQLite del Monolito Modular ERP
PRAGMA foreign_keys = ON;

-- 1. Categorías
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
);

-- 2. Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuit TEXT NOT NULL UNIQUE CHECK (length(cuit) = 11 AND cuit GLOB '[0-9]*'),
    razon_social TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

-- 3. Ubicaciones (Centro de Distribución y Locales)
CREATE TABLE IF NOT EXISTS ubicaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('CD', 'LOCAL')),
    nombre TEXT NOT NULL,
    direccion TEXT NOT NULL,
    telefono TEXT,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

-- 4. Productos
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    precio_venta REAL NOT NULL CHECK (precio_venta > 0),
    costo_unitario REAL NOT NULL CHECK (costo_unitario > 0),
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

-- 5. Stocks (Existencias por producto y ubicación)
CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id),
    cantidad_disponible INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    cantidad_en_transito INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_en_transito >= 0),
    nivel_minimo_existencia INTEGER NOT NULL DEFAULT 1 CHECK (nivel_minimo_existencia > 0),
    CONSTRAINT uq_stock_producto_ubicacion UNIQUE (producto_id, ubicacion_id)
);

-- 6. Alertas de Stock Bajo
CREATE TABLE IF NOT EXISTS alertas_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL REFERENCES stocks(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id),
    cantidad_disponible INTEGER NOT NULL,
    nivel_minimo INTEGER NOT NULL,
    fecha_emision TEXT NOT NULL,
    leida INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0, 1))
);

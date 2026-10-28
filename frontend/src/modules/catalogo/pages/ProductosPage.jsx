import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  FilterToolbar,
  SegmentedControl,
  Select,
  Button,
  Badge,
  StatusBadge,
  ConfirmMorph,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useProductos } from "../hooks/useProductos";
import { useCategorias } from "../hooks/useCategorias";
import { useProveedores } from "../hooks/useProveedores";
import { ProductoDrawer } from "../components/ProductoDrawer";
import { ActualizacionMasivaModal } from "../components/ActualizacionMasivaModal";

export function ProductosPage() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("activos");
  const [selectedCategoria, setSelectedCategoria] = useState("todas");
  const [selectedKeys, setSelectedKeys] = useState([]);

  const {
    productos,
    loading: loadingProd,
    error: errorProd,
    reload: reloadProd,
    crear: crearProd,
    crearPending: pendingProd,
    crearFieldErrors: errorsProd,
    actualizar,
    actualizarPending,
    actualizarMasivo,
    actualizarMasivoPending,
    darDeBaja: darDeBajaProd,
  } = useProductos({ activos: filterEstado !== "inactivos" });

  const { categorias } = useCategorias();
  const { proveedores } = useProveedores({ activos: true });

  const catMap = useMemo(
    () => new Map((categorias || []).map((c) => [c.id, c.nombre])),
    [categorias]
  );
  const provMap = useMemo(
    () => new Map((proveedores || []).map((p) => [p.id, p.razonSocial])),
    [proveedores]
  );

  const prodDrawer = useDisclosure(false);
  const bulkModal = useDisclosure(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const filteredProductos = useMemo(() => {
    let result = productos;

    if (filterEstado === "inactivos") {
      result = result.filter((p) => !p.activo);
    } else if (filterEstado === "activos") {
      result = result.filter((p) => p.activo);
    }

    if (selectedCategoria !== "todas") {
      result = result.filter((p) => String(p.categoriaId) === String(selectedCategoria));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.codigo.toLowerCase().includes(q) ||
          p.nombre.toLowerCase().includes(q)
      );
    }

    return result;
  }, [productos, filterEstado, selectedCategoria, search]);

  const selectedProductsData = useMemo(() => {
    return productos.filter((p) => selectedKeys.includes(p.codigo));
  }, [productos, selectedKeys]);

  const handleBulkConfirm = async (payload) => {
    const res = await actualizarMasivo(payload);
    if (res?.ok !== false) {
      bulkModal.onClose();
    }
    return res;
  };

  const columns = [
    { key: "codigo", header: "Código SKU", mono: true, sortable: true },
    { key: "nombre", header: "Nombre comercial", sortable: true },
    {
      key: "categoriaId",
      header: "Categoría",
      render: (id) => catMap.get(id) || <span className="text-muted">General</span>,
    },
    {
      key: "proveedorId",
      header: "Proveedor",
      render: (id) => provMap.get(id) || <span className="text-muted">Directo</span>,
    },
    {
      key: "precioVenta",
      header: "Precio venta",
      align: "right",
      sortable: true,
      render: (v) => (
        <span className="tabular-nums font-medium">${Number(v).toLocaleString("es-AR")}</span>
      ),
    },
    {
      key: "costoUnitario",
      header: "Costo unitario",
      align: "right",
      render: (v) => (
        <span className="tabular-nums text-muted">${Number(v).toLocaleString("es-AR")}</span>
      ),
    },
    {
      key: "margenPct",
      header: "Margen",
      align: "right",
      render: (v) => (
        <Badge tone={v > 25 ? "success" : v > 0 ? "warning" : "danger"} dot={false}>
          {v}%
        </Badge>
      ),
    },
    {
      key: "nivelMinimo",
      header: "Stock mín.",
      align: "right",
      render: (v) => <span className="tabular-nums font-medium">{v || 1} u.</span>,
    },
    {
      key: "activo",
      header: "Estado",
      render: (v) => <StatusBadge status={v ? "Activo" : "Inactivo"} />,
    },
    {
      key: "acciones",
      header: "Acciones",
      align: "right",
      sortable: false,
      render: (_, row) => (
        <div className="row gap-2 justify-end align-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setSelectedProduct(row); prodDrawer.onOpen(); }}
          >
            Editar
          </Button>
          {row.activo && (
            <ConfirmMorph
              triggerLabel="Desactivar"
              confirmTitle="¿Dar de baja producto?"
              onConfirm={() => darDeBajaProd(row.id || row.codigo)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Catálogo</span>
            <span>·</span>
            <span>Productos</span>
          </div>
          <h1 className="text-xl">Catálogo de Productos</h1>
          <p className="text-sm text-secondary">
            Artículos comercializables, márgenes de utilidad y umbrales mínimos de existencia.
          </p>
        </div>
        <div className="row gap-2 align-center">
          {selectedKeys.length > 0 ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedKeys([])}
              >
                Limpiar selección ({selectedKeys.length})
              </Button>
              <Button
                variant="primary"
                iconLeft="refresh"
                onClick={bulkModal.onOpen}
              >
                Actualización masiva ({selectedKeys.length})
              </Button>
              <Button
                variant="secondary"
                iconLeft="plus"
                onClick={prodDrawer.onOpen}
              >
                Nuevo producto
              </Button>
            </>
          ) : (
            <Button variant="primary" iconLeft="plus" onClick={prodDrawer.onOpen}>
              Nuevo producto
            </Button>
          )}
        </div>
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <div className="row gap-3 wrap align-center">
          <SegmentedControl
            value={filterEstado}
            onChange={setFilterEstado}
            options={[
              { value: "activos", label: "Activos" },
              { value: "todos", label: "Todos" },
              { value: "inactivos", label: "Inactivos" },
            ]}
          />
          {categorias.length > 0 && (
            <div className="w-48">
              <Select
                value={selectedCategoria}
                onChange={setSelectedCategoria}
                options={[
                  { value: "todas", label: "Todas las categorías" },
                  ...categorias.map((c) => ({ value: String(c.id), label: c.nombre })),
                ]}
              />
            </div>
          )}
        </div>

        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por SKU o nombre de producto..."
        />
      </div>

      <SortableDataTable
        columns={columns}
        data={filteredProductos}
        rowKey="codigo"
        selectable={true}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        loading={loadingProd}
        error={errorProd}
        onRetry={reloadProd}
        emptyTitle="Sin productos en catálogo"
        emptyDescription="Registra un nuevo producto con su categoría, proveedor, precio y stock mínimo."
      />

      <ProductoDrawer
        open={prodDrawer.isOpen}
        onClose={() => { setSelectedProduct(null); prodDrawer.onClose(); }}
        onSubmit={(dto) => selectedProduct ? actualizar({ id: selectedProduct.id, dto }) : crearProd(dto)}
        pending={selectedProduct ? actualizarPending : pendingProd}
        fieldErrors={errorsProd}
        categorias={categorias}
        proveedores={proveedores}
        producto={selectedProduct}
      />

      <ActualizacionMasivaModal
        open={bulkModal.isOpen}
        onClose={bulkModal.onClose}
        selectedProducts={selectedProductsData}
        categorias={categorias}
        proveedores={proveedores}
        onConfirm={handleBulkConfirm}
        pending={actualizarMasivoPending}
      />
    </div>
  );
}

export default ProductosPage;

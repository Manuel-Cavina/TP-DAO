import React, { useState, useMemo } from "react";
import {
  SegmentedControl,
  FilterToolbar,
  SortableDataTable,
  Button,
  ConfirmMorph,
  Badge,
  StatusBadge,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useProductos } from "../hooks/useProductos";
import { useProveedores } from "../hooks/useProveedores";
import { useCategorias } from "../hooks/useCategorias";
import { ProductoDrawer } from "../components/ProductoDrawer";
import { PrecioModal } from "../components/PrecioModal";
import { ProveedorModal } from "../components/ProveedorModal";
import { CategoriaModal } from "../components/CategoriaModal";

export function CatalogoPage({ initialView = "productos" }) {
  const [activeTab, setActiveTab] = useState(initialView);
  const [search, setSearch] = useState("");

  const {
    productos,
    loading: loadingProd,
    error: errorProd,
    reload: reloadProd,
    crear: crearProd,
    crearPending: pendingProd,
    crearFieldErrors: errorsProd,
    actualizarPrecio,
    darDeBaja: darDeBajaProd,
  } = useProductos();

  const {
    proveedores,
    loading: loadingProv,
    error: errorProv,
    reload: reloadProv,
    crear: crearProv,
    crearPending: pendingProv,
    crearFieldErrors: errorsProv,
    actualizar: actualizarProv,
    actualizarPending: pendingEditProv,
    darDeBaja: darDeBajaProv,
  } = useProveedores();

  const {
    categorias,
    loading: loadingCat,
    error: errorCat,
    reload: reloadCat,
    crear: crearCat,
    crearPending: pendingCat,
    crearFieldErrors: errorsCat,
  } = useCategorias();

  // Modals / Drawers
  const prodDrawer = useDisclosure(false);
  const provModal = useDisclosure(false);
  const catModal = useDisclosure(false);
  const [selectedProdPrecio, setSelectedProdPrecio] = useState(null);
  const [selectedProveedor, setSelectedProveedor] = useState(null);

  const filteredProductos = useMemo(() => {
    if (!search.trim()) return productos;
    const q = search.toLowerCase();
    return productos.filter(
      (p) => p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
    );
  }, [productos, search]);

  const filteredProveedores = useMemo(() => {
    if (!search.trim()) return proveedores;
    const q = search.toLowerCase();
    return proveedores.filter(
      (p) => p.razonSocial.toLowerCase().includes(q) || p.cuit.includes(q)
    );
  }, [proveedores, search]);

  const filteredCategorias = useMemo(() => {
    if (!search.trim()) return categorias;
    const q = search.toLowerCase();
    return categorias.filter((categoria) => categoria.nombre.toLowerCase().includes(q));
  }, [categorias, search]);

  const prodColumns = [
    { key: "codigo", header: "Código SKU", mono: true, sortable: true },
    { key: "nombre", header: "Nombre comercial", sortable: true },
    {
      key: "precioVenta",
      header: "Precio venta",
      align: "right",
      render: (v) => <span className="tabular-nums font-medium">${Number(v).toLocaleString("es-AR")}</span>,
    },
    {
      key: "costoUnitario",
      header: "Costo unitario",
      align: "right",
      render: (v) => <span className="tabular-nums text-muted">${Number(v).toLocaleString("es-AR")}</span>,
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
            variant="ghost"
            size="sm"
            onClick={() => setSelectedProdPrecio(row)}
          >
            Modificar precio
          </Button>
          <ConfirmMorph
            triggerLabel="Baja"
            confirmTitle="¿Dar de baja producto?"
            onConfirm={() => darDeBajaProd(row.codigo)}
          />
        </div>
      ),
    },
  ];

  const provColumns = [
    { key: "cuit", header: "CUIT", mono: true, sortable: true },
    { key: "razonSocial", header: "Razón social", sortable: true },
    { key: "telefono", header: "Teléfono" },
    { key: "email", header: "Correo electrónico" },
    {
      key: "acciones",
      header: "Acciones",
      align: "right",
      sortable: false,
      render: (_, row) => (
        <div className="row gap-2 justify-end align-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedProveedor(row);
              provModal.onOpen();
            }}
          >
            Editar
          </Button>
          <ConfirmMorph
            triggerLabel="Baja"
            confirmTitle="¿Dar de baja proveedor?"
            onConfirm={() => darDeBajaProv(row.cuit)}
          />
        </div>
      ),
    },
  ];

  const catColumns = [
    { key: "id", header: "ID", mono: true },
    { key: "nombre", header: "Nombre de categoría", sortable: true },
  ];

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Catálogo y abastecimiento</span>
            <span>·</span>
            <span>Artículos comerciales</span>
          </div>
          <h1 className="text-xl">Gestión de Catálogo, Proveedores y Categorías</h1>
        </div>
        <div className="row gap-2">
          {activeTab === "productos" && (
            <Button variant="primary" iconLeft="plus" onClick={prodDrawer.onOpen}>
              Nuevo producto
            </Button>
          )}
          {activeTab === "proveedores" && (
            <Button
              variant="primary"
              iconLeft="plus"
              onClick={() => {
                setSelectedProveedor(null);
                provModal.onOpen();
              }}
            >
              Nuevo proveedor
            </Button>
          )}
          {activeTab === "categorias" && (
            <Button variant="primary" iconLeft="plus" onClick={catModal.onOpen}>
              Nueva categoría
            </Button>
          )}
        </div>
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <SegmentedControl
          value={activeTab}
          onChange={(view) => {
            setActiveTab(view);
            setSearch("");
          }}
          options={[
            { value: "productos", label: "Productos", count: productos.length },
            { value: "proveedores", label: "Proveedores", count: proveedores.length },
            { value: "categorias", label: "Categorías", count: categorias.length },
          ]}
        />
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={
            activeTab === "productos"
              ? "Buscar por SKU o nombre..."
              : activeTab === "proveedores"
              ? "Buscar por CUIT o razón social..."
              : "Filtrar..."
          }
        />
      </div>

      {activeTab === "productos" && (
        <SortableDataTable
          columns={prodColumns}
          data={filteredProductos}
          rowKey="codigo"
          loading={loadingProd}
          error={errorProd}
          onRetry={reloadProd}
          emptyTitle="Sin productos en catálogo"
          emptyDescription="Crea el primer producto para iniciar la red de distribución."
          emptyAction={
            <Button variant="primary" size="sm" onClick={prodDrawer.onOpen}>
              Crear producto
            </Button>
          }
        />
      )}

      {activeTab === "proveedores" && (
        <SortableDataTable
          columns={provColumns}
          data={filteredProveedores}
          rowKey="cuit"
          loading={loadingProv}
          error={errorProv}
          onRetry={reloadProv}
          emptyTitle="Sin proveedores registrados"
          emptyDescription="Registra proveedores para abastecer compras mayoristas en el CD."
          emptyAction={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedProveedor(null);
                provModal.onOpen();
              }}
            >
              Registrar proveedor
            </Button>
          }
        />
      )}

      {activeTab === "categorias" && (
        <SortableDataTable
          columns={catColumns}
          data={filteredCategorias}
          rowKey="id"
          loading={loadingCat}
          error={errorCat}
          onRetry={reloadCat}
          emptyTitle="Sin categorías"
          emptyAction={
            <Button variant="primary" size="sm" onClick={catModal.onOpen}>
              Crear categoría
            </Button>
          }
        />
      )}

      <ProductoDrawer
        open={prodDrawer.open}
        onClose={prodDrawer.onClose}
        categorias={categorias}
        proveedores={proveedores}
        onSubmit={crearProd}
        pending={pendingProd}
        fieldErrors={errorsProd}
      />

      <PrecioModal
        open={Boolean(selectedProdPrecio)}
        onClose={() => setSelectedProdPrecio(null)}
        producto={selectedProdPrecio}
        onSubmit={actualizarPrecio}
      />

      <ProveedorModal
        open={provModal.open}
        onClose={provModal.onClose}
        proveedor={selectedProveedor}
        onSubmit={selectedProveedor ? actualizarProv : crearProv}
        pending={selectedProveedor ? pendingEditProv : pendingProv}
        fieldErrors={errorsProv}
      />

      <CategoriaModal
        open={catModal.open}
        onClose={catModal.onClose}
        onSubmit={crearCat}
        pending={pendingCat}
        fieldErrors={errorsCat}
      />
    </div>
  );
}

export default CatalogoPage;

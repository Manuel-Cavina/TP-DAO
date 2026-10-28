import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  FilterToolbar,
  SegmentedControl,
  Button,
  Badge,
  StatusBadge,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useProductos } from "../hooks/useProductos";
import { PrecioModal } from "../components/PrecioModal";
import { ActualizacionMasivaModal } from "../components/ActualizacionMasivaModal";

export function PreciosPage() {
  const [search, setSearch] = useState("");
  const [filterMargen, setFilterMargen] = useState("todos");
  const [selectedKeys, setSelectedKeys] = useState([]);

  const {
    productos,
    loading: loadingProd,
    error: errorProd,
    reload: reloadProd,
    actualizarPrecio,
    actualizarPrecioPending,
    actualizarMasivo,
    actualizarMasivoPending,
  } = useProductos({ activos: true });

  const bulkModal = useDisclosure(false);
  const [selectedProdPrecio, setSelectedProdPrecio] = useState(null);

  const filteredProductos = useMemo(() => {
    let result = productos;

    if (filterMargen === "alto") {
      result = result.filter((p) => p.margenPct > 25);
    } else if (filterMargen === "bajo") {
      result = result.filter((p) => p.margenPct >= 0 && p.margenPct <= 25);
    } else if (filterMargen === "perdida") {
      result = result.filter((p) => p.margenPct < 0);
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
  }, [productos, filterMargen, search]);

  const selectedProductsData = useMemo(() => {
    return productos.filter((p) => selectedKeys.includes(p.codigo));
  }, [productos, selectedKeys]);

  const handleBulkConfirm = async (payload) => {
    const res = await actualizarMasivo(payload);
    if (res?.ok !== false) {
      setSelectedKeys([]);
      bulkModal.onClose();
    }
    return res;
  };

  const columns = [
    { key: "codigo", header: "Código SKU", mono: true, sortable: true },
    { key: "nombre", header: "Nombre comercial", sortable: true },
    {
      key: "costoUnitario",
      header: "Costo unitario",
      align: "right",
      render: (v) => (
        <span className="tabular-nums text-muted">${Number(v).toLocaleString("es-AR")}</span>
      ),
    },
    {
      key: "precioVenta",
      header: "Precio venta actual",
      align: "right",
      sortable: true,
      render: (v) => (
        <span className="tabular-nums font-medium">${Number(v).toLocaleString("es-AR")}</span>
      ),
    },
    {
      key: "margenPct",
      header: "Margen de ganancia",
      align: "right",
      sortable: true,
      render: (v) => (
        <Badge tone={v > 25 ? "success" : v > 0 ? "warning" : "danger"} dot={false}>
          {v}%
        </Badge>
      ),
    },
    {
      key: "nivelMinimo",
      header: "Stock mínimo",
      align: "right",
      sortable: true,
      render: (v) => <span className="tabular-nums font-medium">{v || 1} unidades</span>,
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
            <span>Precios y Mínimos</span>
          </div>
          <h1 className="text-xl">Precios de Venta y Stocks Mínimos</h1>
          <p className="text-sm text-secondary">
            Administración de listas de precios de venta, análisis de rentabilidad y umbrales de alerta.
          </p>
        </div>
        <div className="row gap-2 align-center">
          {selectedKeys.length > 0 && (
            <Button
              variant="primary"
              iconLeft="refresh"
              onClick={bulkModal.onOpen}
            >
              Actualización masiva ({selectedKeys.length})
            </Button>
          )}
          {selectedKeys.length === 0 && (
            <Button
              variant="secondary"
              iconLeft="check"
              onClick={() => setSelectedKeys(filteredProductos.map((p) => p.codigo))}
              disabled={filteredProductos.length === 0}
            >
              Seleccionar todos
            </Button>
          )}
        </div>
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <SegmentedControl
          value={filterMargen}
          onChange={setFilterMargen}
          options={[
            { value: "todos", label: "Todos los márgenes" },
            { value: "alto", label: "Margen óptimo (>25%)" },
            { value: "bajo", label: "Margen ajustado (0-25%)" },
            { value: "perdida", label: "En pérdida (<0%)" },
          ]}
        />

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
        emptyTitle="Sin productos"
        emptyDescription="No se registran productos para los filtros de precio y margen seleccionados."
      />

      <PrecioModal
        open={Boolean(selectedProdPrecio)}
        onClose={() => setSelectedProdPrecio(null)}
        producto={selectedProdPrecio}
        onSubmit={({ codigo, precio }) => actualizarPrecio({ codigo, precio })}
        pending={actualizarPrecioPending}
      />

      <ActualizacionMasivaModal
        open={bulkModal.isOpen}
        onClose={bulkModal.onClose}
        selectedProducts={selectedProductsData}
        onConfirm={handleBulkConfirm}
        pending={actualizarMasivoPending}
      />
    </div>
  );
}

export default PreciosPage;

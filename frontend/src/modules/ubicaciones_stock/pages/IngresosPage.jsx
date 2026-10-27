import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  SortableDataTable,
  FilterToolbar,
  Button,
  MetricCard,
  Select,
} from "../../../shared";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { useStockMatriz } from "../hooks/useStockMatriz";
import { useProveedores } from "../../catalogo/hooks/useProveedores";
import { useProductos } from "../../catalogo/hooks/useProductos";

/**
 * Vista dedicada de ingreso y recepción de mercadería a CD (/stock/ingresos).
 */
export function IngresosPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { ubicaciones, loading: loadingUbic } = useUbicaciones({ activas: true });
  const { proveedores } = useProveedores({ activos: true });
  const { productos } = useProductos();

  // Obtener únicamente Centros de Distribución activos
  const centrosActivos = useMemo(() => {
    return (ubicaciones || []).filter(
      (u) => (u.tipo === "CD" || u.scope === "CD") && u.activo !== false
    );
  }, [ubicaciones]);

  const [selectedCdId, setSelectedCdId] = useState("");

  const activeCdId = selectedCdId || (centrosActivos[0]?.id ? String(centrosActivos[0].id) : "");

  const activeCd = useMemo(() => {
    return centrosActivos.find((c) => String(c.id) === String(activeCdId));
  }, [centrosActivos, activeCdId]);

  const {
    stocks,
    loading: loadingStock,
    error: errorStock,
    reload: reloadStock,
  } = useStockMatriz({ ubicacionId: activeCdId ? Number(activeCdId) : undefined });

  const stockRows = useMemo(() => {
    const prodMap = new Map((productos || []).map((p) => [p.id, p]));
    return (stocks || []).map((s) => {
      const prod = prodMap.get(s.productoId);
      return {
        id: s.id,
        productoId: s.productoId,
        codigo: prod?.codigo || `SKU-${s.productoId}`,
        nombre: prod?.nombre || "Cargando nombre...",
        categoria: prod?.categoriaNombre || "General",
        disponible: s.disponible,
        enTransito: s.enTransito,
        nivelMinimo: s.nivelMinimo,
      };
    });
  }, [stocks, productos]);

  const filteredStock = useMemo(() => {
    if (!search.trim()) return stockRows;
    const q = search.toLowerCase();
    return stockRows.filter(
      (r) =>
        r.codigo.toLowerCase().includes(q) ||
        r.nombre.toLowerCase().includes(q) ||
        r.categoria.toLowerCase().includes(q)
    );
  }, [stockRows, search]);

  const totalDisponibleCd = useMemo(
    () => stockRows.reduce((acc, r) => acc + r.disponible, 0),
    [stockRows]
  );

  const columns = [
    { key: "codigo", header: "Código SKU", mono: true, sortable: true },
    { key: "nombre", header: "Artículo comercial", sortable: true },
    { key: "categoria", header: "Categoría" },
    {
      key: "disponible",
      header: "Stock en CD",
      align: "right",
      render: (v) => <span className="tabular-nums font-medium text-success">{v} u.</span>,
    },
    {
      key: "nivelMinimo",
      header: "Nivel mínimo",
      align: "right",
      render: (v) => <span className="tabular-nums text-secondary">{v} u.</span>,
    },
  ];

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Inventario</span>
            <span>·</span>
            <span>Ingresos de mercadería</span>
          </div>
          <h1 className="text-xl font-medium">Recepción de Proveedores en CD</h1>
        </div>
        <Button
          variant="primary"
          iconLeft="plus"
          onClick={() => navigate("/logistica/ordenes/nueva")}
          disabled={centrosActivos.length === 0}
        >
          Crear orden formal
        </Button>
      </div>

      <div className="grid-4 gap-3">
        <MetricCard
          label="Centros activos"
          value={centrosActivos.length}
          subtext="Destinos autorizados para compras"
          badgeText="CDs Activos"
          badgeTone="cd"
        />
        <MetricCard
          label="CD en foco"
          value={activeCd?.nombre ? activeCd.nombre.split(" ")[0] : "Sin CD"}
          subtext={activeCd ? `ID #${activeCd.id} · ${activeCd.direccion}` : "No configurado"}
        />
        <MetricCard
          label="Stock disponible en CD"
          value={`${totalDisponibleCd} u.`}
          subtext={`${stockRows.length} artículos en inventario`}
        />
        <MetricCard
          label="Proveedores activos"
          value={(proveedores || []).filter((p) => p.activo !== false).length}
          subtext="Disponibles para compras directas"
        />
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <div className="row align-center gap-2">
          <span className="text-sm text-secondary font-medium">CD receptor:</span>
          <Select
            ariaLabel="Centro de distribución receptor"
            options={centrosActivos.map((cd) => ({ value: String(cd.id), label: cd.nombre }))}
            value={String(activeCdId || "")}
            onChange={setSelectedCdId}
            placeholder="Seleccionar CD"
          />
        </div>

        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar artículos por código SKU o nombre..."
        />
      </div>

      <SortableDataTable
        columns={columns}
        data={filteredStock}
        rowKey="id"
        loading={loadingStock || loadingUbic}
        error={errorStock}
        onRetry={reloadStock}
        emptyTitle="Sin existencias en este Centro de Distribución"
        emptyDescription="Creá una orden formal y completá su recepción para registrar existencias en este centro."
        emptyAction={
          <Button variant="primary" iconLeft="plus" onClick={() => navigate("/logistica/ordenes/nueva")}>
            Crear orden formal
          </Button>
        }
      />

    </div>
  );
}

export default IngresosPage;

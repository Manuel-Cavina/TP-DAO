import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FilterToolbar,
  SortableDataTable,
  Button,
  MetricCard,
  Alert,
  SegmentedControl,
  LiveIndicator,
  Select,
} from "../../../shared";
import { useSede } from "../../../app/providers/SedeProvider";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { useStockMatriz } from "../hooks/useStockMatriz";
import { useAlertasStock } from "../hooks/useAlertasStock";
import { useProductos } from "../../catalogo/hooks/useProductos";

/**
 * Vista de existencias por ubicación y matriz de stock (/stock/stock).
 * Aplica frescura live 15s (FR-028), validación de CD seleccionado y refresco tras mutación.
 */
export function StockPage() {
  const navigate = useNavigate();
  const { sede, sedeId } = useSede();
  const { ubicaciones } = useUbicaciones({ activas: true });
  const [search, setSearch] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [ubicacionFiltro, setUbicacionFiltro] = useState("");
  const activeUbicacionId = ubicacionFiltro || sedeId;
  const activeSede = useMemo(
    () => ubicaciones.find((ubicacion) => String(ubicacion.id) === String(activeUbicacionId)) || sede,
    [ubicaciones, activeUbicacionId, sede]
  );


  const {
    stocks,
    loading: loadingStock,
    error: errorStock,
    reload: reloadStock,
    freshnessSeconds,
    isStale,
  } = useStockMatriz({ ubicacionId: activeUbicacionId });

  const {
    alertas,
    reload: reloadAlertas,
  } = useAlertasStock({ ubicacionId: activeUbicacionId });

  const { productos } = useProductos();

  const isCD = activeSede?.scope === "CD" || activeSede?.tipo === "CD";

  // Enriquecer registros de stock con metadatos del producto
  const stockRows = useMemo(() => {
    const prodMap = new Map((productos || []).map((p) => [p.id, p]));
    return (stocks || []).map((s) => {
      const prod = prodMap.get(s.productoId);
      const isAgotado = s.disponible === 0;
      const isBajoMinimo = s.disponible <= s.nivelMinimo;
      return {
        id: s.id,
        productoId: s.productoId,
        codigo: prod?.codigo || `SKU-${s.productoId}`,
        nombre: prod?.nombre || "Cargando nombre...",
        categoria: prod?.categoriaNombre || "General",
        disponible: s.disponible,
        enTransito: s.enTransito,
        nivelMinimo: s.nivelMinimo,
        isAgotado,
        isBajoMinimo,
        deficit: Math.max(0, s.nivelMinimo - s.disponible),
      };
    });
  }, [stocks, productos]);

  const filteredStock = useMemo(() => {
    let result = stockRows;

    if (filtroNivel === "bajo_minimo") {
      result = result.filter((r) => r.isBajoMinimo);
    } else if (filtroNivel === "agotado") {
      result = result.filter((r) => r.isAgotado);
    } else if (filtroNivel === "normal") {
      result = result.filter((r) => !r.isBajoMinimo);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.codigo.toLowerCase().includes(q) ||
          r.nombre.toLowerCase().includes(q) ||
          r.categoria.toLowerCase().includes(q)
      );
    }

    return result;
  }, [stockRows, filtroNivel, search]);

  const articulosBajoMinimo = useMemo(
    () => stockRows.filter((r) => r.isBajoMinimo).length,
    [stockRows]
  );
  const reorderItems = useMemo(
    () => stockRows.filter((row) => row.isBajoMinimo).map((row) => ({
      productoId: row.productoId,
      cantidad: Math.max(1, row.deficit),
    })),
    [stockRows]
  );
  const totalDisponible = useMemo(
    () => stockRows.reduce((acc, r) => acc + r.disponible, 0),
    [stockRows]
  );
  const totalEnTransito = useMemo(
    () => stockRows.reduce((acc, r) => acc + r.enTransito, 0),
    [stockRows]
  );

  const stockColumns = [
    { key: "codigo", header: "Código SKU", mono: true, sortable: true },
    { key: "nombre", header: "Artículo comercial", sortable: true },
    {
      key: "disponible",
      header: "Stock disponible",
      align: "right",
      render: (v, r) => (
        <span
          className={`tabular-nums font-medium ${
            r.isAgotado ? "text-danger" : r.isBajoMinimo ? "text-warning" : "text-success"
          }`}
        >
          {v} u.
        </span>
      ),
    },
    {
      key: "enTransito",
      header: "En tránsito",
      align: "right",
      render: (v) => <span className="tabular-nums text-muted">{v} u.</span>,
    },
    {
      key: "nivelMinimo",
      header: "Nivel mínimo",
      align: "right",
      render: (v) => <span className="tabular-nums text-secondary">{v} u.</span>,
    },
    {
      key: "acciones",
      header: "Acción",
      align: "right",
      render: (_, r) => {
        if (r.isBajoMinimo) {
          return (
            <Button
              variant="ghost"
              size="sm"
              iconRight="arrow-right"
              onClick={() => navigate(`/stock/alertas?productoId=${r.productoId}&ubicacionId=${activeUbicacionId}`)}
            >
              Ver alerta
            </Button>
          );
        }
        return (
          <span className="text-xs text-muted">Normal</span>
        );
      },
    },
  ];

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Control de existencias</span>
            <span>·</span>
            <span>{activeSede?.label || activeSede?.nombre || "Sede activa"}</span>
          </div>
          <div className="row align-center gap-3 wrap">
            <h1 className="text-xl font-medium">Matriz de Stock por Ubicación</h1>
            <LiveIndicator
              freshnessSeconds={freshnessSeconds}
              isStale={isStale}
              onRefresh={reloadStock}
            />
          </div>
        </div>
        <div className="row gap-2 align-center">
          <Button
            variant="primary"
            iconLeft="plus"
            onClick={() => navigate("/logistica/ordenes/nueva")}
          >
            Crear orden formal
          </Button>
        </div>
      </div>

      <div className="grid-4 gap-3">
        <MetricCard
          label="Sede en foco"
          value={(activeSede?.label || activeSede?.nombre || "Sede").split(" ")[0]}
          subtext={isCD ? "Ámbito mayorista CD" : "Ámbito minorista Local"}
          badgeText={isCD ? "CD Central" : "Sucursal"}
          badgeTone={isCD ? "cd" : "local"}
        />
        <MetricCard
          label="Existencias disponibles"
          value={`${totalDisponible} u.`}
          subtext={`${stockRows.length} artículos catalogados`}
        />
        <MetricCard
          label="Unidades en tránsito"
          value={`${totalEnTransito} u.`}
          subtext="Remitidos pendientes de recepción"
        />
        <MetricCard
          label="Bajo nivel mínimo"
          value={articulosBajoMinimo}
          subtext={articulosBajoMinimo > 0 ? "Disparan alertas activas" : "Existencias equilibradas"}
          badgeTone={articulosBajoMinimo > 0 ? "danger" : "success"}
        />
      </div>

      {!isCD && alertas.length > 0 && (
        <Alert
          tone="warning"
          title={`${alertas.length} alerta${alertas.length === 1 ? "" : "s"} de reposición`}
          description="Hay productos por debajo de su nivel mínimo en esta sede."
          action={
            <Button
              variant="primary"
              size="sm"
              iconRight="arrow-right"
              onClick={() => navigate(`/logistica/ordenes/nueva?destinoId=${activeUbicacionId}`, {
                state: { destinoId: String(activeUbicacionId), preselectedItems: reorderItems },
              })}
            >
              Generar pedido
            </Button>
          }
        />
      )}

      <div className="stock-filter-row">
        <SegmentedControl
          value={filtroNivel}
          onChange={(v) => {
            setFiltroNivel(v);
            setSearch("");
          }}
          options={[
            { value: "todos", label: "Todos", count: stockRows.length },
            { value: "bajo_minimo", label: "Bajo mínimo", count: articulosBajoMinimo },
            { value: "normal", label: "Stock normal" },
          ]}
        />
        <Select
          ariaLabel="Filtrar por sede"
          options={ubicaciones.map((ubicacion) => ({ value: String(ubicacion.id), label: ubicacion.nombre }))}
          value={String(activeUbicacionId || "")}
          onChange={setUbicacionFiltro}
          placeholder="Seleccionar sede"
        />
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por código SKU, artículo o categoría..."
        />
      </div>

      <SortableDataTable
        columns={stockColumns}
        data={filteredStock}
        rowKey="id"
        loading={loadingStock}
        error={errorStock}
        onRetry={reloadStock}
        emptyTitle="Sin existencias registradas en esta sede"
        emptyDescription="Creá una orden formal y completá su recepción para registrar existencias."
      />

    </div>
  );
}

export default StockPage;

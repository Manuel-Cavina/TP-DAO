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
  Badge,
} from "../../../shared";
import { useSede } from "../../../app/providers/SedeProvider";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { useStockMatriz } from "../hooks/useStockMatriz";
import { useAlertasStock } from "../hooks/useAlertasStock";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { useNecesidades } from "../../logistica/hooks/useNecesidades";
import { RestockCdDrawer } from "../components/RestockCdDrawer";
import "../stock-craft.css";

/**
 * Vista de existencias por ubicación y matriz de stock (/stock/stock).
 * Visibilidad multinivel: stock por sede, demanda diferida y restock de Casa Central.
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
    () =>
      ubicaciones.find(
        (ubicacion) => String(ubicacion.id) === String(activeUbicacionId)
      ) || sede,
    [ubicaciones, activeUbicacionId, sede]
  );

  const isCD = activeSede?.scope === "CD" || activeSede?.tipo === "CD";

  const {
    stocks,
    loading: loadingStock,
    error: errorStock,
    reload: reloadStock,
    freshnessSeconds,
    isStale,
  } = useStockMatriz({ ubicacionId: activeUbicacionId });

  const { alertas } = useAlertasStock({ ubicacionId: activeUbicacionId });
  const { productos } = useProductos();
  const { necesidades = [] } = useNecesidades();

  // Drawer de restock a Casa Central
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTargetProduct, setDrawerTargetProduct] = useState(null);

  const handleOpenRestock = (productRow = null) => {
    setDrawerTargetProduct(productRow);
    setDrawerOpen(true);
  };

  // Demanda acumulada de sedes minoristas
  const demandaPorProducto = useMemo(() => {
    const map = new Map();
    for (const n of necesidades) {
      if (n.estado === "PENDIENTE") {
        const prodId = Number(n.productoId);
        map.set(prodId, (map.get(prodId) || 0) + (Number(n.cantidad) || 0));
      }
    }
    return map;
  }, [necesidades]);

  const totalDemandaSedes = useMemo(() => {
    let sum = 0;
    for (const val of demandaPorProducto.values()) {
      sum += val;
    }
    return sum;
  }, [demandaPorProducto]);

  // Enriquecer registros de stock con metadatos del producto y demanda de sedes
  const stockRows = useMemo(() => {
    const prodMap = new Map((productos || []).map((p) => [p.id, p]));
    return (stocks || []).map((s) => {
      const prod = prodMap.get(s.productoId);
      const isAgotado = s.disponible === 0;
      const isBajoMinimo = s.disponible <= s.nivelMinimo;
      const demandaSedes = demandaPorProducto.get(s.productoId) || 0;
      const deficitCD = isCD && demandaSedes > s.disponible;

      return {
        id: s.id,
        productoId: s.productoId,
        codigo: prod?.codigo || `SKU-${s.productoId}`,
        nombre: prod?.nombre || "Cargando nombre...",
        categoria: prod?.categoriaNombre || "General",
        disponible: s.disponible,
        enTransito: s.enTransito,
        nivelMinimo: s.nivelMinimo,
        demandaSedes,
        deficitCD,
        isAgotado,
        isBajoMinimo,
        deficit: Math.max(0, s.nivelMinimo - s.disponible),
      };
    });
  }, [stocks, productos, demandaPorProducto, isCD]);

  const filteredStock = useMemo(() => {
    let result = stockRows;

    if (filtroNivel === "bajo_minimo") {
      result = result.filter((r) => r.isBajoMinimo);
    } else if (filtroNivel === "demanda_sedes") {
      result = result.filter((r) => r.demandaSedes > 0);
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
  const totalDisponible = useMemo(
    () => stockRows.reduce((acc, r) => acc + r.disponible, 0),
    [stockRows]
  );
  const totalEnTransito = useMemo(
    () => stockRows.reduce((acc, r) => acc + r.enTransito, 0),
    [stockRows]
  );

  const stockColumns = useMemo(() => {
    const cols = [
      { key: "codigo", header: "Código SKU", mono: true, sortable: true },
      { key: "nombre", header: "Artículo comercial", sortable: true },
      {
        key: "disponible",
        header: isCD ? "Stock en CD" : "Stock disponible",
        align: "right",
        render: (v, r) => (
          <span
            className={`tabular-nums font-medium ${
              r.isAgotado
                ? "text-danger"
                : r.isBajoMinimo
                ? "text-warning"
                : "text-foreground"
            }`}
          >
            {v} u.
          </span>
        ),
      },
    ];

    if (isCD) {
      cols.push({
        key: "demandaSedes",
        header: "Demanda sedes",
        align: "right",
        render: (v, r) => {
          if (!v) return <span className="text-muted tabular-nums">0 u.</span>;
          return (
            <Badge tone={r.deficitCD ? "warning" : "neutral"} className="tabular-nums">
              {v} u. {r.deficitCD ? "(déficit)" : ""}
            </Badge>
          );
        },
      });
    } else {
      cols.push({
        key: "enTransito",
        header: "En tránsito",
        align: "right",
        render: (v) => <span className="tabular-nums text-muted">{v} u.</span>,
      });
    }

    cols.push({
      key: "nivelMinimo",
      header: "Nivel mínimo",
      align: "right",
      render: (v) => <span className="tabular-nums text-secondary">{v} u.</span>,
    });

    cols.push({
      key: "acciones",
      header: "Acción",
      align: "right",
      render: (_, r) => {
        if (isCD) {
          return (
            <Button
              variant={r.isBajoMinimo || r.deficitCD ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleOpenRestock(r)}
            >
              Registrar ingreso
            </Button>
          );
        }

        if (r.isBajoMinimo) {
          return (
            <Button
              variant="ghost"
              size="sm"
              iconRight="arrow-right"
              onClick={() =>
                navigate(
                  `/stock/alertas?productoId=${r.productoId}&ubicacionId=${activeUbicacionId}`
                )
              }
            >
              Ver alerta
            </Button>
          );
        }
        return <span className="text-xs text-muted">Equilibrado</span>;
      },
    });

    return cols;
  }, [isCD, activeUbicacionId, navigate]);

  return (
    <div className="stock-flow-wrap">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Control de existencias</span>
            <span>·</span>
            <span>{activeSede?.label || activeSede?.nombre || "Sede activa"}</span>
          </div>
          <div className="row align-center gap-3 wrap">
            <h1 className="text-xl font-medium">Stock por ubicación</h1>
            <LiveIndicator
              freshnessSeconds={freshnessSeconds}
              isStale={isStale}
              onRefresh={reloadStock}
            />
          </div>
        </div>

        {/* Acciones principales de la cabecera */}
        <div className="row gap-2 align-center">
          {isCD ? (
            <Button
              variant="primary"
              iconLeft="plus"
              onClick={() => handleOpenRestock(null)}
            >
              Registrar ingreso al CD
            </Button>
          ) : (
            <Button
              variant="primary"
              iconLeft="truck"
              onClick={() =>
                navigate(`/logistica/ordenes/nueva?destinoId=${activeUbicacionId}`)
              }
            >
              Preparar reposición
            </Button>
          )}
        </div>
      </div>

      <dl className="stock-summary" aria-label="Resumen de existencias de la ubicación">
        <div><dt>Ubicación consultada</dt><dd>{activeSede?.label || activeSede?.nombre || "Sede"}</dd></div>
        <div><dt>Disponible · {stockRows.length} artículos</dt><dd className="tabular-nums">{totalDisponible} u.</dd></div>
        <div><dt>{isCD ? "Demanda pendiente de sucursales" : "En tránsito a esta sede"}</dt><dd className="tabular-nums">{isCD ? totalDemandaSedes : totalEnTransito} u.</dd></div>
        <div><dt>Artículos bajo mínimo</dt><dd className={`tabular-nums ${articulosBajoMinimo > 0 ? "text-warning" : ""}`}>{articulosBajoMinimo}</dd></div>
      </dl>

      {!isCD && alertas.length > 0 && (
        <Alert
          tone="warning"
          title={`${alertas.length} alerta${alertas.length === 1 ? "" : "s"} de reposición`}
          description="Hay productos por debajo de su nivel mínimo en esta sede."
          action={
            <Button
              variant="secondary"
              size="sm"
              iconRight="arrow-right"
              onClick={() =>
                navigate(
                  `/logistica/ordenes/nueva?destinoId=${activeUbicacionId}`
                )
              }
            >
              Preparar reposición
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
            {
              value: "bajo_minimo",
              label: "Bajo mínimo",
              count: articulosBajoMinimo,
            },
            ...(isCD
              ? [
                  {
                    value: "demanda_sedes",
                    label: "Con demanda de sedes",
                    count: stockRows.filter((r) => r.demandaSedes > 0).length,
                  },
                ]
              : [{ value: "normal", label: "Stock normal" }]),
          ]}
        />
        <Select
          ariaLabel="Filtrar por sede"
          options={ubicaciones.map((ubicacion) => ({
            value: String(ubicacion.id),
            label: ubicacion.nombre,
          }))}
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
        emptyDescription={isCD ? "Registra un ingreso de mercadería en este centro de distribución." : "Prepara una reposición. El stock del local se acredita al cerrar la recepción verificada."}
      />

      {/* Drawer de Restock de Casa Central */}
      <RestockCdDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerTargetProduct(null);
        }}
        cdId={activeSede?.id}
        initialProductoId={drawerTargetProduct?.productoId || ""}
        initialCantidad={
          drawerTargetProduct
            ? Math.max(1, drawerTargetProduct.demandaSedes || drawerTargetProduct.deficit || 100)
            : 100
        }
        stockPorProducto={new Map(stockRows.map((row) => [row.productoId, row]))}
        stockLoading={loadingStock}
        stockError={errorStock}
        stockStale={isStale}
        onRetryStock={reloadStock}
        onSuccess={reloadStock}
      />
    </div>
  );
}

export default StockPage;

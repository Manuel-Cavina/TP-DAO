import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  FilterToolbar,
  Button,
  Badge,
  StockSplitBar,
  MetricCard,
  Alert,
  Icon,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { useStockMatriz } from "../hooks/useStockMatriz";
import { useProveedores } from "../../catalogo/hooks/useProveedores";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { IngresoCdModal } from "../components/IngresoCdModal";

/**
 * Vista dedicada de ingreso y recepción de mercadería a CD (/stock/ingresos).
 */
export function IngresosPage() {
  const ingresoModal = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [lastMovementSummary, setLastMovementSummary] = useState(null);

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
    {
      key: "balance",
      header: "Balance en nodo",
      render: (_, r) => (
        <StockSplitBar
          disponible={r.disponible}
          enTransito={r.enTransito}
          nivelMinimo={r.nivelMinimo}
        />
      ),
    },
  ];

  const handleIngresoSuccess = (impact) => {
    setLastMovementSummary(impact);
    reloadStock();
  };

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
          onClick={ingresoModal.onOpen}
          disabled={centrosActivos.length === 0}
        >
          Registrar nuevo ingreso
        </Button>
      </div>

      <Alert
        tone="info"
        title="Regla operativa de abastecimiento"
        description="Las compras y recepciones a proveedores externos ingresan exclusivamente a un Centro de Distribución (CD activo). Tras la confirmación del comprobante, el stock se incrementa inmediatamente para su posterior distribución y remisión a sucursales."
      />

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

      {lastMovementSummary && (
        <div className="erp-table-card p-4 stack gap-3 bg-muted border-accent">
          <div className="row justify-between align-center">
            <div className="row align-center gap-2 text-success">
              <Icon name="shield-check" size={18} />
              <span className="font-medium text-sm">
                Último movimiento de stock registrado en esta sesión
              </span>
            </div>
            <span className="text-xs text-muted">
              Registrado a las {lastMovementSummary.fecha}
            </span>
          </div>

          <div className="grid-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted block">Centro impactado:</span>
              <span className="font-medium">{lastMovementSummary.cdNombre}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Proveedor de origen:</span>
              <span className="font-medium">{lastMovementSummary.proveedorNombre}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Artículo ingresado:</span>
              <span className="font-medium">
                {lastMovementSummary.productoCodigo} · {lastMovementSummary.productoNombre}
              </span>
            </div>
          </div>

          <div className="row justify-between align-center border-t pt-2 text-sm">
            <span className="text-muted">
              Comprobante: <strong className="font-mono">{lastMovementSummary.comprobante}</strong>
            </span>
            <div className="row gap-3 tabular-nums">
              <span>Saldo previo: <strong>{lastMovementSummary.saldoAnterior} u.</strong></span>
              <span className="text-success font-medium">Ingresado: <strong>+{lastMovementSummary.cantidadIngresada} u.</strong></span>
              <span>Nuevo saldo: <strong className="text-success">{lastMovementSummary.nuevoSaldo} u.</strong></span>
            </div>
          </div>
        </div>
      )}

      <div className="row justify-between align-center wrap gap-3">
        <div className="row align-center gap-2">
          <span className="text-sm text-secondary font-medium">CD receptor:</span>
          {centrosActivos.map((cd) => (
            <Button
              key={cd.id}
              variant={String(cd.id) === String(activeCdId) ? "primary" : "secondary"}
              size="sm"
              onClick={() => setSelectedCdId(String(cd.id))}
            >
              {cd.nombre}
            </Button>
          ))}
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
        emptyDescription="Haz clic en 'Registrar nuevo ingreso' para incorporar mercadería de proveedor a este centro."
        emptyAction={
          <Button variant="primary" iconLeft="plus" onClick={ingresoModal.onOpen}>
            Registrar ingreso ahora
          </Button>
        }
      />

      <IngresoCdModal
        open={ingresoModal.open}
        onClose={ingresoModal.onClose}
        defaultCdId={activeCdId}
        onSuccess={handleIngresoSuccess}
      />
    </div>
  );
}

export default IngresosPage;

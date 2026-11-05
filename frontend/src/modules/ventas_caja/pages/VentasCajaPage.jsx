import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  SegmentedControl,
  SortableDataTable,
  Button,
  MetricCard,
  Badge,
  Alert,
  Select,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useSede } from "../../../app/providers/SedeProvider";
import { useVentasCaja } from "../hooks/useVentasCaja";
import { useProductos } from "../../catalogo";
import { useStockMatriz } from "../../ubicaciones_stock";
import { PosTerminal } from "../components/PosTerminal";
import { FacturaModal } from "../components/FacturaModal";
import { DevolucionModal } from "../components/DevolucionModal";
import { AnimatedCounter } from "../../../components/arc/animated-counter/animated-counter";
import "../ventas-pos.css";

export function VentasCajaPage() {
  const { sede, sedeId, sedes, setSedeId } = useSede();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    urlTab === "facturas" || urlTab === "devoluciones" ? urlTab : "pos"
  );

  useEffect(() => {
    setActiveTab(urlTab === "facturas" || urlTab === "devoluciones" ? urlTab : "pos");
  }, [urlTab]);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [facturaParaDevolver, setFacturaParaDevolver] = useState(null);
  const devModal = useDisclosure(false);

  const localOptions = useMemo(
    () =>
      sedes
        .filter((item) => item.tipo === "LOCAL")
        .map((item) => ({ value: String(item.value), label: item.label })),
    [sedes]
  );

  const [localId, setLocalId] = useState(() => {
    if (sede?.tipo === "LOCAL") return String(sedeId);
    const firstLocal = sedes.find((item) => item.tipo === "LOCAL");
    return firstLocal ? String(firstLocal.value) : "";
  });

  // Sincronización reactiva bidireccional con el selector superior de Sede
  useEffect(() => {
    if (sede?.tipo === "LOCAL" && String(sede.value) !== String(localId)) {
      setLocalId(String(sede.value));
    } else if (!localId && localOptions.length > 0) {
      setLocalId(String(localOptions[0].value));
    }
  }, [sede, localId, localOptions]);

  const handleSelectLocal = (newLocalId) => {
    const strId = String(newLocalId);
    setLocalId(strId);
    setSedeId(Number(strId) || strId);
  };

  const localSeleccionado = useMemo(
    () => sedes.find((item) => String(item.value) === String(localId)),
    [sedes, localId]
  );

  // Períodos de tiempo: "hoy", "ayer" (último día) y "mes" (este mes)
  const [periodoPreset, setPeriodoPreset] = useState("hoy");

  const { desde, hasta, periodoLabel } = useMemo(() => {
    const today = new Date();
    const formatYMD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (periodoPreset === "ayer") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const iso = formatYMD(yesterday);
      return { desde: iso, hasta: iso, periodoLabel: "Último día" };
    }

    if (periodoPreset === "mes") {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        desde: formatYMD(firstOfMonth),
        hasta: formatYMD(today),
        periodoLabel: "Este mes",
      };
    }

    // Default "hoy"
    const isoToday = formatYMD(today);
    return { desde: isoToday, hasta: isoToday, periodoLabel: "Hoy" };
  }, [periodoPreset]);

  const {
    ventas,
    devoluciones,
    ventasParaDevolver,
    devolucionesPrevias,
    caja,
    periodo,
    loading,
    hasData,
    error,
    reload,
    procesarVenta,
    ventaPending,
    registrarDevolucion,
    devPending,
    devError,
    obtenerComprobante,
    comprobantePending,
  } = useVentasCaja({
    localId,
    desde,
    hasta,
    enabled: Boolean(localSeleccionado),
  });

  const {
    productos,
    loading: productosLoading,
    error: productosError,
  } = useProductos();

  const {
    stocks,
    loading: stockLoading,
    error: stockError,
    reload: reloadStock,
  } = useStockMatriz({ ubicacionId: localId });

  const productById = useMemo(
    () => new Map(productos.map((product) => [Number(product.id), product])),
    [productos]
  );

  const enrichInvoice = (invoice) => ({
    ...invoice,
    detalles: (invoice?.detalles || []).map((item) => {
      const product = productById.get(Number(item.productoId));
      return product
        ? { ...item, codigo: product.codigo, nombre: product.nombre }
        : item;
    }),
  });

  const visibleVentas = useMemo(
    () => ventas.map(enrichInvoice),
    [ventas, productById]
  );
  const facturasDevolvibles = useMemo(
    () => ventasParaDevolver.map(enrichInvoice),
    [ventasParaDevolver, productById]
  );

  const handleCheckout = async (form) => {
    const result = await procesarVenta(form);
    if (result?.ok) {
      setLastInvoice(enrichInvoice(result.data));
      reloadStock();
    }
    return result;
  };

  const handleReturn = async (form) => {
    const result = await registrarDevolucion(form);
    if (result?.ok) reloadStock();
    return result;
  };

  const handleViewInvoice = async (ventaId) => {
    const result = await obtenerComprobante(ventaId);
    if (result?.ok) setLastInvoice(enrichInvoice(result.data));
  };

  const openDevolucion = (factura = null) => {
    setFacturaParaDevolver(factura);
    devModal.onOpen();
  };

  const closeDevolucion = () => {
    setFacturaParaDevolver(null);
    devModal.onClose();
  };

  const ventasColumns = [
    { key: "numero", header: "Comprobante", mono: true, sortable: true },
    {
      key: "fecha",
      header: "Fecha",
      render: (value) => new Date(value).toLocaleString("es-AR"),
    },
    {
      key: "medioPago",
      header: "Medio de pago",
      render: (value) => <Badge tone="info">{value}</Badge>,
    },
    {
      key: "total",
      header: "Total cobrado",
      align: "right",
      render: (value) => (
        <span className="tabular-nums font-medium text-success">
          ${Number(value).toLocaleString("es-AR")}
        </span>
      ),
    },
    {
      key: "acciones",
      header: "Acciones",
      align: "right",
      render: (_, row) => (
        <div className="row justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={comprobantePending}
            onClick={() => handleViewInvoice(row.id)}
          >
            Ver comprobante
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openDevolucion(row)}>
            Devolver
          </Button>
        </div>
      ),
    },
  ];

  const devolucionesColumns = [
    { key: "numero", header: "Devolución", mono: true, sortable: true },
    { key: "facturaNumero", header: "Comprobante original", mono: true },
    { key: "motivo", header: "Motivo" },
    {
      key: "medioReintegro",
      header: "Medio original",
      render: (value) => <Badge tone="neutral">{value}</Badge>,
    },
    {
      key: "totalReintegro",
      header: "Ajuste registrado",
      align: "right",
      render: (value) => (
        <span className="tabular-nums font-medium text-danger">
          -${Number(value).toLocaleString("es-AR")}
        </span>
      ),
    },
  ];

  return (
    <div className={`sales-workbench stack gap-4 sales-workbench--${activeTab}`}>
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Ventas y caja</span>
            <span>·</span>
            <span>{localSeleccionado?.label || "Seleccioná un local"}</span>
          </div>
          <h1 className="text-xl">{activeTab === "facturas" ? "Comprobantes y caja" : activeTab === "devoluciones" ? "Devoluciones" : "Punto de venta"}</h1>
        </div>
        <div className="row align-center gap-2">
          {localOptions.length > 0 && (
            <div className="row align-center gap-2">
              <span className="text-xs text-secondary font-medium">Punto de venta:</span>
              <Select
                ariaLabel="Punto de venta activo"
                options={localOptions}
                value={String(localId)}
                onChange={handleSelectLocal}
                placeholder="Seleccionar local"
              />
            </div>
          )}
          {localSeleccionado && activeTab !== "pos" && (
            <Button
              variant="secondary"
              iconLeft="refresh"
              disabled={facturasDevolvibles.length === 0 || loading}
              onClick={() => openDevolucion(null)}
            >
              Registrar devolución
            </Button>
          )}
        </div>
      </div>

      {!localSeleccionado ? (
        <div className="erp-section-card stack gap-3">
          <div>
            <h2 className="erp-card-title">Local comercial de esta operación</h2>
            <p className="text-sm text-secondary">
              La sede de lectura no cambia una venta. Elegí el local al que se imputarán caja, comprobantes y stock.
            </p>
          </div>
          <Select
            ariaLabel="Local comercial para esta venta"
            options={localOptions}
            value={localId}
            onChange={handleSelectLocal}
            placeholder="Seleccionar local"
          />
          {!localOptions.length && (
            <Alert
              tone="warning"
              title="No hay locales comerciales disponibles"
              description="No se puede operar ventas hasta que el backend informe un local activo."
            />
          )}
        </div>
      ) : (
        <>
          {error && (
            <Alert
              tone="danger"
              title="No se pudo cargar ventas y caja"
              description={error.message}
              action={
                <Button variant="secondary" size="sm" onClick={reload}>
                  Reintentar
                </Button>
              }
            />
          )}

          {activeTab !== "pos" && <>
          {/* The cash period filters movements, never the sellable catalog. */}
          <div className="pos-period-bar row justify-between align-center wrap gap-2 p-2.5 rounded">
            <div className="row align-center gap-2">
              <span className="text-xs text-secondary font-medium">Período de caja:</span>
              <SegmentedControl
                value={periodoPreset}
                onChange={setPeriodoPreset}
                options={[
                  { value: "hoy", label: "Hoy" },
                  { value: "ayer", label: "Último día" },
                  { value: "mes", label: "Este mes" },
                ]}
              />
            </div>
            <div className="row align-center gap-3">
              <span className="text-xs text-muted tabular-nums">
                Período: <strong>{desde}</strong> al <strong>{hasta}</strong>
              </span>
              <Badge tone="success" dot={true}>
                {localSeleccionado.label}
              </Badge>
            </div>
          </div>

          {activeTab === "facturas" && (!hasData ? (
            <div className="erp-section-card text-sm text-muted" aria-live="polite">
              {loading ? "Cargando caja del local y período seleccionados..." : "Los datos de caja del período no están disponibles."}
            </div>
          ) : (
            <div className="sales-cash-summary grid-3 gap-3">
              <MetricCard
                label="Saldo neto de caja"
                value={<AnimatedCounter value={Number(caja.saldo) || 0} prefix="$ " locale="es-AR" />}
                subtext={`${periodoLabel} · ventas menos devoluciones`}
                badgeText="Datos persistidos"
                badgeTone={caja.saldo >= 0 ? "success" : "danger"}
              />
              <MetricCard
                label="Ventas cobradas"
                value={<AnimatedCounter value={Number(caja.totalVentas) || 0} prefix="$ " locale="es-AR" />}
                subtext={`${caja.cantidadVentas} comprobantes en el período`}
                badgeTone="info"
              />
              <MetricCard
                label="Devoluciones"
                value={<AnimatedCounter value={Number(caja.totalDevoluciones) || 0} prefix="$ " locale="es-AR" />}
                subtext={`${caja.cantidadDevoluciones} ajustes en el período`}
                badgeTone="warning"
              />
            </div>
          ))}
          </>}

          {activeTab === "devoluciones" && (
            <p className="text-sm text-secondary">
              Movimientos del período seleccionado. Para registrar una devolución se consulta el comprobante original y sus cantidades pendientes, independientemente de este período.
            </p>
          )}

          {activeTab === "pos" && (
            <PosTerminal
              productos={productos}
              stocks={stocks}
              localId={localId}
              localNombre={localSeleccionado?.label || "Punto de venta"}
              onCheckout={handleCheckout}
              pending={ventaPending}
              loading={productosLoading || stockLoading}
              loadError={productosError || stockError}
            />
          )}

          {activeTab === "facturas" && (
            <SortableDataTable
              columns={ventasColumns}
              data={visibleVentas}
              rowKey="id"
              loading={loading}
              emptyTitle="Sin ventas registradas en el período"
            />
          )}

          {activeTab === "devoluciones" && (
            <SortableDataTable
              columns={devolucionesColumns}
              data={devoluciones}
              rowKey="id"
              loading={loading}
              emptyTitle="Sin devoluciones registradas en el período"
            />
          )}
        </>
      )}

      <FacturaModal
        open={Boolean(lastInvoice)}
        onClose={() => setLastInvoice(null)}
        factura={lastInvoice}
        onIniciarDevolucion={(factura) => openDevolucion(factura)}
      />

      <DevolucionModal
        open={devModal.open}
        onClose={closeDevolucion}
        localId={localId}
        facturas={facturasDevolvibles}
        devoluciones={devolucionesPrevias}
        facturaInicial={facturaParaDevolver}
        onSubmit={handleReturn}
        pending={devPending}
        error={devError}
      />
    </div>
  );
}

export default VentasCajaPage;

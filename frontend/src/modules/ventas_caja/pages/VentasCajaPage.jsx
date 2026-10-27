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

export function VentasCajaPage() {
  const { sede, sedeId, sedes } = useSede();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    urlTab === "facturas" || urlTab === "devoluciones" ? urlTab : "pos"
  );

  useEffect(() => {
    if (urlTab === "facturas" || urlTab === "devoluciones" || urlTab === "pos") {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams(newTab === "pos" ? {} : { tab: newTab });
  };
  const [lastInvoice, setLastInvoice] = useState(null);
  const [facturaParaDevolver, setFacturaParaDevolver] = useState(null);
  const devModal = useDisclosure(false);
  const [localId, setLocalId] = useState("");
  const localOptions = useMemo(() => sedes.filter((item) => item.tipo === "LOCAL").map((item) => ({ value: item.value, label: item.label })), [sedes]);
  useEffect(() => {
    if (!localId && sede?.tipo === "LOCAL") setLocalId(sedeId);
  }, [localId, sede, sedeId]);
  const localSeleccionado = sedes.find((item) => String(item.value) === String(localId));

  const {
    ventas,
    devoluciones,
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
  } = useVentasCaja({ localId, enabled: Boolean(localSeleccionado) });
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
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Ventas y caja</span>
            <span>·</span>
            <span>{localSeleccionado?.label || "Seleccioná un local"}</span>
          </div>
          <h1 className="text-xl">Punto de venta</h1>
        </div>
        {localSeleccionado && (
          <Button
            variant="secondary"
            iconLeft="refresh"
            disabled={visibleVentas.length === 0}
            onClick={() => openDevolucion(null)}
          >
            Registrar devolución
          </Button>
        )}
      </div>

      {!localSeleccionado ? (
        <div className="erp-section-card stack gap-3">
          <div><h2 className="erp-card-title">Local comercial de esta operación</h2><p className="text-sm text-secondary">La sede de lectura no cambia una venta. Elegí el local al que se imputarán caja, comprobantes y stock.</p></div>
          <Select ariaLabel="Local comercial para esta venta" options={localOptions} value={localId} onChange={setLocalId} placeholder="Seleccionar local" />
          {!localOptions.length && <Alert tone="warning" title="No hay locales comerciales disponibles" description="No se puede operar ventas hasta que el backend informe un local activo." />}
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

          {loading && !hasData ? (
            <div className="erp-section-card text-sm text-muted" aria-live="polite">
              Cargando caja del local seleccionado...
            </div>
          ) : (
          <div className="grid-3 gap-3">
            <MetricCard
              label="Saldo neto de caja"
              value={`$${caja.saldo.toLocaleString("es-AR")}`}
              subtext={`${periodo.desde} · ventas menos devoluciones`}
              badgeText="Datos persistidos"
              badgeTone={caja.saldo >= 0 ? "success" : "danger"}
            />
            <MetricCard
              label="Ventas cobradas"
              value={`$${caja.totalVentas.toLocaleString("es-AR")}`}
              subtext={`${caja.cantidadVentas} comprobantes en el período`}
              badgeTone="info"
            />
            <MetricCard
              label="Devoluciones"
              value={`$${caja.totalDevoluciones.toLocaleString("es-AR")}`}
              subtext={`${caja.cantidadDevoluciones} ajustes en el período`}
              badgeTone="warning"
            />
          </div>
          )}

          <SegmentedControl
            value={activeTab}
            onChange={handleTabChange}
            options={[
              { value: "pos", label: "Terminal POS" },
              { value: "facturas", label: "Comprobantes y caja", count: visibleVentas.length },
              { value: "devoluciones", label: "Devoluciones", count: devoluciones.length },
            ]}
          />

          {activeTab === "pos" && (
            <PosTerminal
              productos={productos}
              stocks={stocks}
              localId={localId}
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
        facturas={visibleVentas}
        devoluciones={devoluciones}
        facturaInicial={facturaParaDevolver}
        onSubmit={handleReturn}
        pending={devPending}
        error={devError}
      />
    </div>
  );
}

export default VentasCajaPage;

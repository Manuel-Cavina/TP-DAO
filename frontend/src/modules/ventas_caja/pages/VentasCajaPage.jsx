import React, { useMemo, useState } from "react";
import {
  SegmentedControl,
  SortableDataTable,
  Button,
  MetricCard,
  Badge,
  Alert,
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
  const { sede, sedeId } = useSede();
  const [activeTab, setActiveTab] = useState("pos");
  const [lastInvoice, setLastInvoice] = useState(null);
  const [facturaParaDevolver, setFacturaParaDevolver] = useState(null);
  const devModal = useDisclosure(false);
  const isCD = sede?.scope === "CD" || sede?.tipo === "CD";

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
  } = useVentasCaja({ localId: sedeId, enabled: !isCD });
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
  } = useStockMatriz({ ubicacionId: !isCD ? sedeId : undefined });

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
            <span>{sede?.label || "Sucursal"}</span>
          </div>
          <h1 className="text-xl">Punto de venta</h1>
        </div>
        {!isCD && (
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

      {isCD ? (
        <Alert
          tone="warning"
          title="Ventas no disponibles en el Centro de Distribución"
          description="Selecciona un local comercial para cobrar ventas, consultar su caja o registrar devoluciones."
        />
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
            onChange={setActiveTab}
            options={[
              { value: "pos", label: "Terminal POS" },
              { value: "facturas", label: "Comprobantes", count: visibleVentas.length },
              { value: "devoluciones", label: "Devoluciones", count: devoluciones.length },
            ]}
          />

          {activeTab === "pos" && (
            <PosTerminal
              productos={productos}
              stocks={stocks}
              localId={sedeId}
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
        localId={sedeId}
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

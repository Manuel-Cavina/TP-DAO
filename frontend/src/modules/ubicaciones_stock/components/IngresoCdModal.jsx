import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { FormField, NumberInput, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { Alert } from "../../../shared/components/Feedback";
import { Badge } from "../../../shared/components/Badge";
import { Icon } from "../../../shared/components/Icon";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { useProveedores } from "../../catalogo/hooks/useProveedores";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { stockService } from "../services";

/**
 * Modal para el ingreso de mercadería a Centro de Distribución.
 * Cumple US2: Selección explícita de CD activo, proveedor activo, producto,
 * y resumen de impacto del movimiento antes y después de confirmar.
 */
export function IngresoCdModal({
  open,
  onClose,
  defaultCdId,
  onSuccess,
}) {
  const { ubicaciones, loading: loadingUbic } = useUbicaciones({ activas: true });
  const { proveedores, loading: loadingProv } = useProveedores({ activos: true });
  const { productos, loading: loadingProd } = useProductos();

  // Filtrar exclusivamente Centros de Distribución activos
  const centrosDistribucion = useMemo(() => {
    return (ubicaciones || []).filter(
      (u) => (u.tipo === "CD" || u.scope === "CD") && u.activo !== false
    );
  }, [ubicaciones]);

  const [cdId, setCdId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [comprobante, setComprobante] = useState("");

  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  // Estados del flujo: "form" -> "confirm" -> "success"
  const [step, setStep] = useState("form");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmedMovement, setConfirmedMovement] = useState(null);

  // Inicializar o preseleccionar valores cuando se abre el modal
  useEffect(() => {
    if (open) {
      setStep("form");
      setErrorMessage("");
      setConfirmedMovement(null);
      setCantidad("");
      setComprobante("");

      if (centrosDistribucion.length > 0) {
        const found = centrosDistribucion.find((c) => String(c.id) === String(defaultCdId));
        setCdId(found ? String(found.id) : String(centrosDistribucion[0].id));
      } else {
        setCdId("");
      }

      if (proveedores.length > 0 && !proveedorId) {
        setProveedorId(String(proveedores[0].id));
      }
      if (productos.length > 0 && !productoId) {
        setProductoId(String(productos[0].id));
      }
    }
  }, [open, centrosDistribucion, proveedores, productos, defaultCdId]);

  // Actualizar consulta de saldo anterior al cambiar CD o Producto
  const fetchSaldo = useCallback(async (currentCdId, currentProdId) => {
    if (!currentCdId || !currentProdId) {
      setSaldoAnterior(0);
      return;
    }
    setLoadingSaldo(true);
    try {
      const resp = await stockService.consultarDisponible({
        ubicacionId: Number(currentCdId),
        productoId: Number(currentProdId),
      });
      const data = resp?.data || resp;
      setSaldoAnterior(Number(data?.cantidad_disponible) || 0);
    } catch {
      setSaldoAnterior(0);
    } finally {
      setLoadingSaldo(false);
    }
  }, []);

  useEffect(() => {
    if (open && cdId && productoId) {
      fetchSaldo(cdId, productoId);
    }
  }, [open, cdId, productoId, fetchSaldo]);

  const cdOptions = useMemo(() => {
    return centrosDistribucion.map((c) => ({
      value: String(c.id),
      label: `${c.nombre} (CD Activo #${c.id})`,
    }));
  }, [centrosDistribucion]);

  const provOptions = useMemo(() => {
    return (proveedores || [])
      .filter((p) => p.activo !== false)
      .map((p) => ({
        value: String(p.id),
        label: `${p.razonSocial || p.cuit} · CUIT ${p.cuit}`,
      }));
  }, [proveedores]);

  const prodOptions = useMemo(() => {
    return (productos || []).map((p) => ({
      value: String(p.id),
      label: `${p.codigo} · ${p.nombre}`,
    }));
  }, [productos]);

  const selectedCd = useMemo(() => {
    return centrosDistribucion.find((c) => String(c.id) === String(cdId));
  }, [centrosDistribucion, cdId]);

  const selectedProv = useMemo(() => {
    return proveedores.find((p) => String(p.id) === String(proveedorId));
  }, [proveedores, proveedorId]);

  const selectedProd = useMemo(() => {
    return productos.find((p) => String(p.id) === String(productoId));
  }, [productos, productoId]);

  const cantNum = Math.max(0, parseInt(cantidad, 10) || 0);
  const nuevoSaldoProyectado = saldoAnterior + cantNum;

  const handleGoToReview = (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!cdId) {
      setErrorMessage("Debe seleccionar un Centro de Distribución activo.");
      return;
    }
    if (!proveedorId) {
      setErrorMessage("Debe seleccionar un proveedor activo.");
      return;
    }
    if (!productoId) {
      setErrorMessage("Debe seleccionar un producto.");
      return;
    }
    if (cantNum <= 0) {
      setErrorMessage("La cantidad a ingresar debe ser mayor a cero.");
      return;
    }
    setStep("confirm");
  };

  const handleConfirmSubmit = async () => {
    setPendingSubmit(true);
    setErrorMessage("");
    try {
      const dto = {
        cd_id: Number(cdId),
        producto_id: Number(productoId),
        cantidad: cantNum,
        comprobante: comprobante.trim() || undefined,
      };

      await stockService.ingresoCD(dto);

      const impactResult = {
        cdNombre: selectedCd?.nombre || `CD #${cdId}`,
        proveedorNombre: selectedProv?.razonSocial || "Proveedor activo",
        productoCodigo: selectedProd?.codigo || `ID-${productoId}`,
        productoNombre: selectedProd?.nombre || "Producto",
        saldoAnterior,
        cantidadIngresada: cantNum,
        nuevoSaldo: nuevoSaldoProyectado,
        comprobante: comprobante.trim() || "S/C",
        fecha: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setConfirmedMovement(impactResult);
      setStep("success");
      if (onSuccess) {
        onSuccess(impactResult);
      }
    } catch (err) {
      const msg = err?.data?.detail || err?.message || "No se pudo registrar el ingreso de mercadería.";
      setErrorMessage(msg);
    } finally {
      setPendingSubmit(false);
    }
  };

  const handleResetForm = () => {
    setStep("form");
    setCantidad("");
    setComprobante("");
    setConfirmedMovement(null);
    if (cdId && productoId) {
      fetchSaldo(cdId, productoId);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ingreso de mercadería a Centro de Distribución"
      subtitle="Recepción central de productos desde proveedor. El stock queda disponible para distribución."
      footer={
        step === "form" ? (
          <div className="row justify-between w-full align-center">
            <Button variant="ghost" onClick={onClose} disabled={pendingSubmit}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={handleGoToReview}
              disabled={centrosDistribucion.length === 0 || loadingUbic || cantNum <= 0}
            >
              Revisar impacto
            </Button>
          </div>
        ) : step === "confirm" ? (
          <div className="row justify-between w-full align-center">
            <Button
              variant="secondary"
              iconLeft="arrow-left"
              onClick={() => setStep("form")}
              disabled={pendingSubmit}
            >
              Volver a editar
            </Button>
            <Button
              variant="primary"
              iconLeft="check"
              onClick={handleConfirmSubmit}
              loading={pendingSubmit}
              loadingLabel="Confirmando movimiento..."
            >
              Confirmar ingreso de stock
            </Button>
          </div>
        ) : (
          <div className="row justify-between w-full align-center">
            <Button variant="secondary" iconLeft="plus" onClick={handleResetForm}>
              Registrar otro ingreso
            </Button>
            <Button variant="primary" iconLeft="check" onClick={onClose}>
              Finalizar y cerrar
            </Button>
          </div>
        )
      }
    >
      <div className="stack gap-4">
        {errorMessage && (
          <Alert tone="danger" title="Error en la operación" description={errorMessage} />
        )}

        {centrosDistribucion.length === 0 && !loadingUbic && (
          <Alert
            tone="warning"
            title="Sin Centros de Distribución activos"
            description="No se detectó ningún CD activo registrado en la red logística. Crea o reactiva un CD antes de registrar ingresos."
          />
        )}

        {step === "form" && (
          <form onSubmit={handleGoToReview} className="stack gap-4">
            <FormField label="Centro de Distribución de destino (CD activo)" required>
              <Select
                options={cdOptions}
                value={cdId}
                onChange={setCdId}
                placeholder={loadingUbic ? "Cargando centros de distribución..." : "Seleccionar CD activo"}
                disabled={centrosDistribucion.length === 0}
              />
            </FormField>

            <FormField label="Proveedor activo de origen" required>
              <Select
                options={provOptions}
                value={proveedorId}
                onChange={setProveedorId}
                placeholder={loadingProv ? "Cargando proveedores..." : "Seleccionar proveedor"}
              />
            </FormField>

            <div className="erp-form-grid">
              <FormField label="Producto comercial" required>
                <Select
                  options={prodOptions}
                  value={productoId}
                  onChange={setProductoId}
                  placeholder={loadingProd ? "Cargando catálogo..." : "Seleccionar artículo"}
                />
              </FormField>

              <NumberInput
                label="Cantidad positiva de unidades"
                required
                min="1"
                step="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="p. ej. 100"
              />
            </div>

            <TextInput
              label="Comprobante o remito de proveedor"
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              placeholder="p. ej. REM-PROV-998812"
            />

            {cantNum > 0 && selectedCd && selectedProd && (
              <div className="erp-table-card p-3 stack gap-2 bg-muted">
                <div className="row justify-between align-center">
                  <span className="text-xs text-secondary font-medium">
                    Proyección de movimiento en {selectedCd.nombre}
                  </span>
                  <Badge tone="cd">CD Destino</Badge>
                </div>
                <div className="row justify-between align-center text-sm">
                  <span className="text-muted">Saldo disponible actual:</span>
                  <span className="tabular-nums font-medium">
                    {loadingSaldo ? "Consultando..." : `${saldoAnterior} u.`}
                  </span>
                </div>
                <div className="row justify-between align-center text-sm text-success">
                  <span>Cantidad a ingresar:</span>
                  <span className="tabular-nums font-medium">+{cantNum} u.</span>
                </div>
                <div className="row justify-between align-center text-sm font-medium border-t pt-1">
                  <span>Nuevo saldo proyectado:</span>
                  <span className="tabular-nums">{nuevoSaldoProyectado} u.</span>
                </div>
              </div>
            )}
          </form>
        )}

        {step === "confirm" && (
          <div className="stack gap-3">
            <Alert
              tone="info"
              title="Revisión de impacto antes de confirmar"
              description="Verifica los datos del comprobante y el saldo proyectado antes de registrar el alta de inventario."
            />

            <div className="erp-table-card p-4 stack gap-3">
              <div className="row justify-between align-center border-b pb-2">
                <span className="text-secondary text-sm">Centro de Distribución</span>
                <span className="font-medium text-sm">{selectedCd?.nombre}</span>
              </div>
              <div className="row justify-between align-center border-b pb-2">
                <span className="text-secondary text-sm">Proveedor</span>
                <span className="font-medium text-sm">
                  {selectedProv?.razonSocial || "Proveedor activo"} (CUIT {selectedProv?.cuit})
                </span>
              </div>
              <div className="row justify-between align-center border-b pb-2">
                <span className="text-secondary text-sm">Artículo</span>
                <span className="font-medium text-sm">
                  {selectedProd?.codigo} · {selectedProd?.nombre}
                </span>
              </div>
              <div className="row justify-between align-center border-b pb-2">
                <span className="text-secondary text-sm">Comprobante</span>
                <span className="font-mono text-sm">{comprobante.trim() || "Sin comprobante"}</span>
              </div>

              <div className="grid-3 gap-2 pt-2 text-center">
                <div className="p-2 border rounded bg-surface">
                  <span className="text-xs text-muted block">Saldo previo</span>
                  <span className="tabular-nums text-lg font-medium">{saldoAnterior} u.</span>
                </div>
                <div className="p-2 border rounded bg-surface text-success">
                  <span className="text-xs text-success block">Ingreso (+)</span>
                  <span className="tabular-nums text-lg font-medium">+{cantNum} u.</span>
                </div>
                <div className="p-2 border rounded bg-surface">
                  <span className="text-xs text-muted block">Nuevo saldo</span>
                  <span className="tabular-nums text-lg font-medium">{nuevoSaldoProyectado} u.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "success" && confirmedMovement && (
          <div className="stack gap-3">
            <div className="row align-center gap-2 text-success">
              <Icon name="shield-check" size={24} />
              <h2 className="text-lg font-medium">Ingreso registrado con éxito</h2>
            </div>

            <p className="text-sm text-secondary">
              Se acreditaron correctamente las existencias en el Centro de Distribución. El saldo queda inmediatamente disponible para operaciones de despacho y reposición.
            </p>

            <div className="erp-table-card p-4 stack gap-2 bg-muted">
              <div className="row justify-between text-sm">
                <span className="text-muted">Centro impactado:</span>
                <span className="font-medium">{confirmedMovement.cdNombre}</span>
              </div>
              <div className="row justify-between text-sm">
                <span className="text-muted">Producto:</span>
                <span className="font-medium">{confirmedMovement.productoCodigo} · {confirmedMovement.productoNombre}</span>
              </div>
              <div className="row justify-between text-sm">
                <span className="text-muted">Comprobante:</span>
                <span className="font-mono">{confirmedMovement.comprobante}</span>
              </div>
              <div className="row justify-between text-sm">
                <span className="text-muted">Saldo anterior:</span>
                <span className="tabular-nums">{confirmedMovement.saldoAnterior} u.</span>
              </div>
              <div className="row justify-between text-sm text-success font-medium">
                <span>Cantidad ingresada:</span>
                <span className="tabular-nums">+{confirmedMovement.cantidadIngresada} u.</span>
              </div>
              <div className="row justify-between text-sm font-medium border-t pt-1">
                <span>Nuevo saldo disponible:</span>
                <span className="tabular-nums text-success">{confirmedMovement.nuevoSaldo} u.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default IngresoCdModal;

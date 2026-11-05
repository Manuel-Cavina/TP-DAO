import React, { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent } from "../../../components/arc/drawer/drawer";
import { Button } from "../../../shared/components/Button";
import { Select } from "../../../shared/components/Select";
import { NumberInput } from "../../../shared/components/FormControls";
import { Badge } from "../../../shared/components/Badge";
import { Alert } from "../../../shared/components/Feedback";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { stockService } from "../services";
import "../stock-craft.css";

export function RestockCdDrawer({
  open,
  onClose,
  cdId,
  initialProductoId = "",
  initialCantidad = 100,
  stockPorProducto = new Map(),
  stockLoading = false,
  stockError = null,
  stockStale = false,
  onRetryStock,
  onSuccess,
}) {
  const { productos = [] } = useProductos({ activos: true });
  const { ubicaciones = [] } = useUbicaciones({ activas: true });

  const [selectedProductoId, setSelectedProductoId] = useState("");
  const [cantidad, setCantidad] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const cdsActivos = useMemo(() => {
    return ubicaciones.filter(
      (u) => (u.tipo === "CD" || u.scope === "CD") && u.activo !== false
    );
  }, [ubicaciones]);

  const targetCd = useMemo(() => {
    return cdsActivos.find((c) => String(c.id) === String(cdId));
  }, [cdsActivos, cdId]);

  // Inicializar formulario al abrir
  useEffect(() => {
    if (open) {
      setErrorMsg("");
      setSuccessMsg("");
      setCantidad(String(Math.max(1, initialCantidad)));

      if (initialProductoId) {
        setSelectedProductoId(String(initialProductoId));
      } else if (productos.length > 0) {
        setSelectedProductoId(String(productos[0].id));
      }

    }
  }, [open, initialProductoId, initialCantidad, productos]);

  const selectedProduct = useMemo(() => {
    return productos.find((p) => String(p.id) === String(selectedProductoId));
  }, [productos, selectedProductoId]);

  const cantNum = Number(cantidad);
  const cantidadValida = Number.isSafeInteger(cantNum) && cantNum > 0;
  // La proyección pertenece al artículo elegido, no a la fila que abrió el drawer.
  const selectedStock = stockPorProducto.get(Number(selectedProductoId));
  const stockActual = selectedStock?.disponible;
  const demandaSedes = selectedStock?.demandaSedes || 0;
  const stockDisponible = !stockLoading && !stockError && !stockStale && Boolean(selectedStock);
  const nuevoStockProyectado = stockDisponible && cantidadValida ? stockActual + cantNum : null;
  const coberturaDemanda = demandaSedes > 0 && nuevoStockProyectado >= demandaSedes;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!targetCd?.id) {
      setErrorMsg("No hay un Centro de Distribución destino seleccionado.");
      return;
    }
    if (!selectedProduct) {
      setErrorMsg("Seleccioná un artículo comercial.");
      return;
    }
    if (!cantidadValida) {
      setErrorMsg("La cantidad recibida debe ser un entero positivo válido.");
      return;
    }
    if (!stockDisponible || submitting || successMsg) {
      setErrorMsg("Actualiza el stock del artículo antes de confirmar el ingreso.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      await stockService.ingresoCD({
        producto_id: Number(selectedProductoId),
        cd_id: Number(targetCd.id),
        cantidad: cantNum,
      });

      setSuccessMsg(
        `Ingreso registrado: ${cantNum} u. de ${selectedProduct.nombre} acreditadas en ${targetCd.nombre}.`
      );
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || "Error al registrar el ingreso a Casa Central.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent
        title="Registrar ingreso al CD"
        description={`Destino: ${targetCd?.nombre || "Centro de distribución"}`}
        side="right"
      >
        <div className="restock-drawer-panel">
          {errorMsg && (
            <Alert tone="danger" title="No se pudo registrar el ingreso" description={errorMsg} />
          )}
          {successMsg && (
            <Alert tone="success" title="Operación exitosa" description={successMsg} />
          )}

          <p className="text-sm text-secondary">
            Este registro aumenta las existencias del CD seleccionado. No registra una compra ni un comprobante de proveedor. Las transferencias entre centros no están disponibles.
          </p>

          {/* Selección de artículo y cantidad */}
          <div className="stack gap-3 border-t pt-3">
            <span className="text-xs font-medium text-foreground">
              Artículo y cantidad recibida
            </span>

            <Select
              ariaLabel="Artículo del ingreso"
              label="Artículo comercial"
              options={productos.map((p) => ({
                value: String(p.id),
                label: `${p.codigo} · ${p.nombre}`,
              }))}
              value={selectedProductoId}
              onChange={setSelectedProductoId}
              placeholder="Seleccionar artículo"
            />

            <NumberInput
              label="Cantidad de unidades ingresadas"
              required
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej. 100"
            />
          </div>

          {/* Tarjeta de impacto proyectado */}
          {!stockDisponible && (
            <Alert
              tone={stockError ? "danger" : "info"}
              title={stockLoading ? "Cargando stock del artículo" : "Stock actual no disponible"}
              description={stockError?.message || "Actualiza las existencias para consultar la proyección y confirmar el ingreso."}
              action={onRetryStock && <Button variant="secondary" size="sm" onClick={onRetryStock}>Actualizar stock</Button>}
            />
          )}
          {stockDisponible && (
          <div className="restock-impact-card stack gap-2">
            <span className="text-xs font-medium text-secondary">
              Impacto proyectado en Casa Central:
            </span>
            <div className="row justify-between text-xs">
              <span className="text-muted">Stock físico actual:</span>
              <span className="tabular-nums font-medium">{stockActual} u.</span>
            </div>
            {demandaSedes > 0 && (
              <div className="row justify-between text-xs">
                <span className="text-warning">Demanda acumulada de sedes:</span>
                <span className="tabular-nums font-medium text-warning">
                  {demandaSedes} u.
                </span>
              </div>
            )}
            <div className="row justify-between text-xs font-medium border-t pt-1.5 mt-1">
              <span className="text-foreground">Nuevo stock en Casa Central:</span>
              <span className="tabular-nums text-success font-medium">
                {nuevoStockProyectado == null ? "Ingresa una cantidad entera positiva" : `${nuevoStockProyectado} u. (+${cantNum})`}
              </span>
            </div>
            {demandaSedes > 0 && (
              <div className="mt-1">
                <Badge tone={coberturaDemanda ? "success" : "warning"}>
                  {coberturaDemanda
                    ? "Cubre 100% de la demanda de sedes"
                    : `Cubre parcialmente (quedan ${demandaSedes - nuevoStockProyectado} u. de déficit)`}
                </Badge>
              </div>
            )}
          </div>
          )}

          {/* Botones de acción */}
          <div className="restock-footer-actions">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || !cantidadValida || !stockDisponible || !targetCd || !selectedProduct || Boolean(successMsg)}
            >
              Confirmar ingreso al CD
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default RestockCdDrawer;

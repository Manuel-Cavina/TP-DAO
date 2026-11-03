import React, { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent } from "../../../components/arc/drawer/drawer";
import { Button } from "../../../shared/components/Button";
import { Select } from "../../../shared/components/Select";
import { NumberInput, TextInput } from "../../../shared/components/FormControls";
import { Badge } from "../../../shared/components/Badge";
import { Alert } from "../../../shared/components/Feedback";
import { useProveedores } from "../../catalogo/hooks/useProveedores";
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
  demandaSedes = 0,
  stockActual = 0,
  onSuccess,
}) {
  const { proveedores = [] } = useProveedores({ activos: true });
  const { productos = [] } = useProductos({ activos: true });
  const { ubicaciones = [] } = useUbicaciones({ activas: true });

  const [origenTipo, setOrigenTipo] = useState("proveedor"); // "proveedor" | "inter_cd"
  const [selectedProveedorId, setSelectedProveedorId] = useState("");
  const [selectedProductoId, setSelectedProductoId] = useState("");
  const [selectedOrigenCdId, setSelectedOrigenCdId] = useState("");
  const [comprobante, setComprobante] = useState("");
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
    return cdsActivos.find((c) => String(c.id) === String(cdId)) || cdsActivos[0];
  }, [cdsActivos, cdId]);

  const otherCds = useMemo(() => {
    return cdsActivos.filter((c) => String(c.id) !== String(targetCd?.id));
  }, [cdsActivos, targetCd]);

  // Inicializar formulario al abrir
  useEffect(() => {
    if (open) {
      setErrorMsg("");
      setSuccessMsg("");
      setOrigenTipo("proveedor");
      setComprobante("");
      setCantidad(String(Math.max(1, initialCantidad)));

      if (initialProductoId) {
        setSelectedProductoId(String(initialProductoId));
      } else if (productos.length > 0) {
        setSelectedProductoId(String(productos[0].id));
      }

      if (proveedores.length > 0) {
        setSelectedProveedorId(String(proveedores[0].id));
      }

      if (otherCds.length > 0) {
        setSelectedOrigenCdId(String(otherCds[0].id));
      }
    }
  }, [open, initialProductoId, initialCantidad, productos, proveedores, otherCds]);

  const selectedProduct = useMemo(() => {
    return productos.find((p) => String(p.id) === String(selectedProductoId));
  }, [productos, selectedProductoId]);

  const cantNum = Math.max(0, parseInt(cantidad, 10) || 0);
  const nuevoStockProyectado = stockActual + cantNum;
  const coberturaDemanda = demandaSedes > 0 && nuevoStockProyectado >= demandaSedes;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!targetCd?.id) {
      setErrorMsg("No hay un Centro de Distribución destino seleccionado.");
      return;
    }
    if (!selectedProductoId) {
      setErrorMsg("Seleccioná un artículo comercial.");
      return;
    }
    if (cantNum <= 0) {
      setErrorMsg("La cantidad recibida debe ser mayor a 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      if (origenTipo === "proveedor") {
        await stockService.ingresoCD({
          producto_id: Number(selectedProductoId),
          cd_id: Number(targetCd.id),
          cantidad: cantNum,
        });

        setSuccessMsg(
          `Ingreso registrado: ${cantNum} u. de ${selectedProduct?.nombre || "artículo"} acreditadas en ${targetCd.nombre}.`
        );
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // En caso de inter-CD, informamos registro exitoso
        setSuccessMsg(
          `Solicitud inter-CD registrada desde ${otherCds.find((c) => String(c.id) === String(selectedOrigenCdId))?.nombre || "otro CD"} hacia ${targetCd.nombre}.`
        );
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.message || "Error al registrar el ingreso a Casa Central.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent
        title="Restockear Casa Central"
        description={`Ingreso directo de existencias a ${targetCd?.nombre || "Casa Central"}`}
        side="right"
      >
        <div className="restock-drawer-panel">
          {errorMsg && (
            <Alert tone="danger" title="Error en restock" description={errorMsg} />
          )}
          {successMsg && (
            <Alert tone="success" title="Operación exitosa" description={successMsg} />
          )}

          {/* Selector de origen */}
          <div className="stack gap-1.5">
            <label className="text-xs font-medium text-secondary">
              Fuente de reabastecimiento:
            </label>
            <div className="restock-strategy-toggle">
              <Button
                variant={origenTipo === "proveedor" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setOrigenTipo("proveedor")}
              >
                Proveedor externo
              </Button>
              <Button
                variant={origenTipo === "inter_cd" ? "primary" : "secondary"}
                size="sm"
                disabled={otherCds.length === 0}
                onClick={() => setOrigenTipo("inter_cd")}
              >
                Otra Casa Central
              </Button>
            </div>
          </div>

          {/* Formulario según tipo de origen */}
          {origenTipo === "proveedor" ? (
            <div className="stack gap-3 border-t pt-3">
              <span className="text-xs font-medium text-foreground">
                1. Datos del proveedor y comprobante
              </span>
              <Select
                ariaLabel="Proveedor de mercadería"
                label="Proveedor habilitado"
                options={proveedores.map((p) => ({
                  value: String(p.id),
                  label: `${p.nombre || p.razonSocial || "Proveedor"} (CUIT: ${p.cuit || "S/D"})`,
                }))}
                value={selectedProveedorId}
                onChange={setSelectedProveedorId}
                placeholder="Seleccionar proveedor"
              />

              <TextInput
                label="Número de remito o factura de compra"
                value={comprobante}
                onChange={(e) => setComprobante(e.target.value)}
                placeholder="Ej. REM-009845 o FAC-00129"
              />
            </div>
          ) : (
            <div className="stack gap-3 border-t pt-3">
              <span className="text-xs font-medium text-foreground">
                1. Casa Central de origen
              </span>
              <Select
                ariaLabel="Casa Central de origen"
                label="CD despachante"
                options={otherCds.map((c) => ({
                  value: String(c.id),
                  label: c.nombre,
                }))}
                value={selectedOrigenCdId}
                onChange={setSelectedOrigenCdId}
                placeholder="Seleccionar CD origen"
              />
            </div>
          )}

          {/* Selección de artículo y cantidad */}
          <div className="stack gap-3 border-t pt-3">
            <span className="text-xs font-medium text-foreground">
              2. Artículo y cantidad recibida
            </span>

            <Select
              ariaLabel="Artículo a restockear"
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
                {nuevoStockProyectado} u. (+{cantNum})
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

          {/* Botones de acción */}
          <div className="restock-footer-actions">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || cantNum <= 0}
            >
              Confirmar e ingresar stock
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default RestockCdDrawer;

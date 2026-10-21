import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput, NumberInput } from "../../../shared/components/FormControls";
import { Badge } from "../../../shared/components/Badge";
import { Alert } from "../../../shared/components/Feedback";

export function ActualizacionMasivaModal({
  open,
  onClose,
  selectedProducts = [],
  onConfirm,
  pending = false,
}) {
  // Estado local para cada producto seleccionado: codigo, precioPropuesto, minimoPropuesto
  const [items, setItems] = useState([]);
  const [pctAdjustment, setPctAdjustment] = useState("");
  const [bulkMinimo, setBulkMinimo] = useState("");

  useEffect(() => {
    if (selectedProducts && selectedProducts.length > 0) {
      setItems(
        selectedProducts.map((p) => ({
          codigo: p.codigo,
          nombre: p.nombre,
          costoUnitario: Number(p.costoUnitario) || 0,
          precioPrevio: Number(p.precioVenta) || 0,
          precioPropuesto: String(Number(p.precioVenta) || 0),
          minimoPrevio: Number(p.nivelMinimo) || 1,
          minimoPropuesto: String(Number(p.nivelMinimo) || 1),
        }))
      );
      setPctAdjustment("");
      setBulkMinimo("");
    } else {
      setItems([]);
    }
  }, [selectedProducts, open]);

  // Aplicar ajuste porcentual global a todos los precios propuestos
  const handleApplyPct = () => {
    const pct = Number(pctAdjustment);
    if (isNaN(pct) || pct === 0) return;
    setItems((prev) =>
      prev.map((item) => {
        const nuevo = Math.round(item.precioPrevio * (1 + pct / 100) * 100) / 100;
        return { ...item, precioPropuesto: String(nuevo > 0 ? nuevo : item.precioPropuesto) };
      })
    );
  };

  // Aplicar stock mínimo global a todos los propuestos
  const handleApplyBulkMinimo = () => {
    const minVal = parseInt(bulkMinimo, 10);
    if (isNaN(minVal) || minVal <= 0) return;
    setItems((prev) =>
      prev.map((item) => ({ ...item, minimoPropuesto: String(minVal) }))
    );
  };

  const handlePriceChange = (codigo, val) => {
    setItems((prev) =>
      prev.map((it) => (it.codigo === codigo ? { ...it, precioPropuesto: val } : it))
    );
  };

  const handleMinimoChange = (codigo, val) => {
    setItems((prev) =>
      prev.map((it) => (it.codigo === codigo ? { ...it, minimoPropuesto: val } : it))
    );
  };

  // Validación fila por fila y global
  const validatedItems = useMemo(() => {
    return items.map((it) => {
      const precioNum = Number(it.precioPropuesto);
      const minimoNum = Number(it.minimoPropuesto);
      const errors = [];
      const warnings = [];

      if (isNaN(precioNum) || precioNum <= 0) {
        errors.push("Precio debe ser mayor a 0");
      } else if (precioNum < it.costoUnitario) {
        warnings.push("Precio menor a costo");
      }

      if (isNaN(minimoNum) || minimoNum <= 0 || !Number.isInteger(minimoNum)) {
        errors.push("Stock mínimo debe ser entero mayor a 0");
      }

      const margen =
        precioNum > 0
          ? Math.round(((precioNum - it.costoUnitario) / precioNum) * 100)
          : 0;

      return {
        ...it,
        precioNum,
        minimoNum,
        margen,
        errors,
        warnings,
        isValid: errors.length === 0,
      };
    });
  }, [items]);

  const hasErrors = validatedItems.some((it) => !it.isValid);
  const totalCount = validatedItems.length;
  const invalidCount = validatedItems.filter((it) => !it.isValid).length;

  const handleConfirm = async () => {
    if (hasErrors || totalCount === 0) return;

    const payload = validatedItems.map((it) => ({
      codigo: it.codigo,
      precio_venta: it.precioNum,
      nivel_minimo: it.minimoNum,
    }));

    const res = await onConfirm(payload);
    if (res?.ok !== false) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actualización masiva de precios y stocks mínimos"
      subtitle="Revisión de valores previos, valores propuestos y validación estricta antes de aplicar."
      footer={
        <div className="row justify-between w-full align-center">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <div className="row gap-2 align-center">
            {hasErrors && (
              <span className="text-xs text-danger font-medium">
                {invalidCount} {invalidCount === 1 ? "registro inválido" : "registros inválidos"}
              </span>
            )}
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={hasErrors || totalCount === 0 || pending}
              loading={pending}
              loadingLabel="Aplicando cambios..."
            >
              Confirmar actualización ({totalCount})
            </Button>
          </div>
        </div>
      }
    >
      <div className="stack gap-4">
        <div className="row justify-between align-center wrap gap-2">
          <Badge tone="neutral">
            {totalCount} {totalCount === 1 ? "producto seleccionado" : "productos seleccionados"}
          </Badge>
          <span className="text-xs text-secondary">
            Ningún producto se modificará si existen registros con errores.
          </span>
        </div>

        {hasErrors && (
          <Alert
            tone="danger"
            title="Existen errores de validación en la propuesta"
            description="Corrige los valores destacados en rojo antes de continuar. Todos los precios y stocks mínimos deben ser números válidos mayores a cero."
          />
        )}

        <div className="p-3 bg-subtle rounded-md border stack gap-3">
          <span className="text-xs font-medium text-secondary">
            Acciones rápidas sobre la selección:
          </span>
          <div className="row gap-3 wrap align-end">
            <div className="row gap-2 align-end">
              <NumberInput
                label="Ajuste porcentual (%)"
                placeholder="+10 o -5"
                value={pctAdjustment}
                onChange={(e) => setPctAdjustment(e.target.value)}
              />
              <Button variant="secondary" size="sm" onClick={handleApplyPct}>
                Aplicar %
              </Button>
            </div>
            <div className="row gap-2 align-end">
              <NumberInput
                label="Fijar stock mínimo a todos"
                placeholder="p. ej. 10"
                min="1"
                step="1"
                value={bulkMinimo}
                onChange={(e) => setBulkMinimo(e.target.value)}
              />
              <Button variant="secondary" size="sm" onClick={handleApplyBulkMinimo}>
                Fijar mínimo
              </Button>
            </div>
          </div>
        </div>

        <div className="erp-table-scroll border rounded-md">
          <table className="erp-table erp-table--compact w-full">
            <thead>
              <tr>
                <th>Código SKU</th>
                <th>Nombre comercial</th>
                <th className="align-right">Precio previo</th>
                <th className="align-right">Precio propuesto ($)</th>
                <th className="align-right">Mínimo previo</th>
                <th className="align-right">Mínimo propuesto</th>
                <th className="align-right">Margen</th>
                <th>Validación</th>
              </tr>
            </thead>
            <tbody>
              {validatedItems.map((item) => (
                <tr key={item.codigo} className={!item.isValid ? "bg-danger-subtle" : ""}>
                  <td className="font-mono text-xs font-medium">{item.codigo}</td>
                  <td className="text-xs">{item.nombre}</td>
                  <td className="align-right text-xs tabular-nums text-muted">
                    ${item.precioPrevio.toLocaleString("es-AR")}
                  </td>
                  <td className="align-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.precioPropuesto}
                      onChange={(e) => handlePriceChange(item.codigo, e.target.value)}
                      className={`erp-input erp-input--sm tabular-nums text-right ${
                        item.errors.some((e) => e.includes("Precio")) ? "is-invalid" : ""
                      }`}
                      aria-label={`Precio propuesto para ${item.codigo}`}
                    />
                  </td>
                  <td className="align-right text-xs tabular-nums text-muted">
                    {item.minimoPrevio} u.
                  </td>
                  <td className="align-right">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={item.minimoPropuesto}
                      onChange={(e) => handleMinimoChange(item.codigo, e.target.value)}
                      className={`erp-input erp-input--sm tabular-nums text-right ${
                        item.errors.some((e) => e.includes("mínimo")) ? "is-invalid" : ""
                      }`}
                      aria-label={`Mínimo propuesto para ${item.codigo}`}
                    />
                  </td>
                  <td className="align-right text-xs tabular-nums">
                    <Badge tone={item.margen > 25 ? "success" : item.margen > 0 ? "warning" : "danger"}>
                      {item.margen}%
                    </Badge>
                  </td>
                  <td>
                    {item.errors.length > 0 ? (
                      <span className="text-xs text-danger font-medium">
                        {item.errors.join(", ")}
                      </span>
                    ) : item.warnings.length > 0 ? (
                      <span className="text-xs text-warning font-medium">
                        {item.warnings.join(", ")}
                      </span>
                    ) : (
                      <Badge tone="success">Válido</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default ActualizacionMasivaModal;

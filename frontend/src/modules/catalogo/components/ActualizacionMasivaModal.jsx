import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput, NumberInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Badge } from "../../../shared/components/Badge";
import { Alert } from "../../../shared/components/Feedback";

const REGLAS = [
  { value: "PRECIO_FIJO", label: "Precio de venta fijo" },
  { value: "PRECIO_PORCENTAJE", label: "Ajuste porcentual de precio (+/- %)" },
  { value: "STOCK_MINIMO_FIJO", label: "Stock mínimo fijo" },
  { value: "CATEGORIA_FIJA", label: "Categoría fija" },
  { value: "PROVEEDOR_FIJO", label: "Proveedor fijo" },
  { value: "ESTADO_ACTIVO", label: "Estado (Activo / Inactivo)" },
];

export function ActualizacionMasivaModal({
  open,
  onClose,
  selectedProducts = [],
  categorias = [],
  proveedores = [],
  onConfirm,
  pending = false,
}) {
  const [regla, setRegla] = useState("PRECIO_PORCENTAJE");
  const [precioFijo, setPrecioFijo] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [selectedCategoriaId, setSelectedCategoriaId] = useState("");
  const [selectedProveedorId, setSelectedProveedorId] = useState("");
  const [estadoActivo, setEstadoActivo] = useState(true);

  // Inicializar o resetear al abrir
  useEffect(() => {
    if (open) {
      setPrecioFijo("");
      setPorcentaje("");
      setStockMinimo("");
      setSelectedCategoriaId(categorias[0]?.id ? String(categorias[0].id) : "");
      setSelectedProveedorId(proveedores[0]?.id ? String(proveedores[0].id) : "");
      setEstadoActivo(true);
    }
  }, [open, categorias, proveedores]);

  const catMap = useMemo(
    () => new Map((categorias || []).map((c) => [c.id, c.nombre])),
    [categorias]
  );
  const provMap = useMemo(
    () => new Map((proveedores || []).map((p) => [p.id, p.razonSocial])),
    [proveedores]
  );

  const catOptions = useMemo(
    () => (categorias || []).map((c) => ({ value: String(c.id), label: c.nombre })),
    [categorias]
  );
  const provOptions = useMemo(
    () => (proveedores || []).map((p) => ({ value: String(p.id), label: `${p.razonSocial} (${p.cuit})` })),
    [proveedores]
  );

  // Validación y cálculo fila por fila para la vista previa
  const validatedItems = useMemo(() => {
    return selectedProducts.map((p) => {
      const precioPrevio = Number(p.precioVenta) || 0;
      const costoUnitario = Number(p.costoUnitario) || 0;
      const minimoPrevio = Number(p.nivelMinimo) || 1;
      const categoriaIdPrevio = p.categoriaId;
      const proveedorIdPrevio = p.proveedorId;
      const activoPrevio = Boolean(p.activo);

      let valorPrevio = "";
      let reglaTexto = "";
      let deltaTexto = "";
      let valorPropuesto = "";
      let isValid = false;
      let error = null;
      let warning = null;
      let proposedValue = null;

      if (regla === "PRECIO_FIJO") {
        valorPrevio = `$${precioPrevio.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        reglaTexto = "Precio fijo";
        if (!precioFijo.trim()) {
          deltaTexto = "Pendiente";
          valorPropuesto = "No definido";
          error = "Ingrese un precio";
        } else {
          const num = Number(precioFijo);
          if (isNaN(num) || num <= 0) {
            deltaTexto = "Invalido";
            valorPropuesto = "$0.00";
            error = "Precio debe ser mayor a 0";
          } else {
            const diff = num - precioPrevio;
            deltaTexto = `${diff >= 0 ? "+" : ""}$${diff.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            valorPropuesto = `$${num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            isValid = true;
            proposedValue = num;
            if (num < costoUnitario) {
              warning = `Menor al costo ($${costoUnitario})`;
            }
          }
        }
      } else if (regla === "PRECIO_PORCENTAJE") {
        valorPrevio = `$${precioPrevio.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (!porcentaje.trim()) {
          reglaTexto = "Ajuste %";
          deltaTexto = "Pendiente";
          valorPropuesto = "No definido";
          error = "Ingrese un porcentaje";
        } else {
          const pct = Number(porcentaje);
          reglaTexto = `Ajuste ${pct >= 0 ? "+" : ""}${pct}%`;
          if (isNaN(pct) || pct === 0) {
            deltaTexto = "Invalido";
            valorPropuesto = "No definido";
            error = "Porcentaje debe ser distinto de 0";
          } else {
            const proposed = Math.round(precioPrevio * (1 + pct / 100) * 100) / 100;
            if (proposed <= 0) {
              deltaTexto = "Invalido";
              valorPropuesto = "$0.00";
              error = "Precio resultante debe ser mayor a 0";
            } else {
              const diff = proposed - precioPrevio;
              deltaTexto = `${diff >= 0 ? "+" : ""}$${diff.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              valorPropuesto = `$${proposed.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              isValid = true;
              proposedValue = proposed;
              if (proposed < costoUnitario) {
                warning = `Menor al costo ($${costoUnitario})`;
              }
            }
          }
        }
      } else if (regla === "STOCK_MINIMO_FIJO") {
        valorPrevio = `${minimoPrevio} u.`;
        reglaTexto = "Stock min. fijo";
        if (!stockMinimo.trim()) {
          deltaTexto = "Pendiente";
          valorPropuesto = "No definido";
          error = "Ingrese stock minimo";
        } else {
          const minVal = Number(stockMinimo);
          if (isNaN(minVal) || minVal <= 0 || !Number.isInteger(minVal)) {
            deltaTexto = "Invalido";
            valorPropuesto = "No definido";
            error = "Debe ser un entero mayor a 0";
          } else {
            const diff = minVal - minimoPrevio;
            deltaTexto = `${diff >= 0 ? "+" : ""}${diff} u.`;
            valorPropuesto = `${minVal} u.`;
            isValid = true;
            proposedValue = minVal;
          }
        }
      } else if (regla === "CATEGORIA_FIJA") {
        valorPrevio = catMap.get(categoriaIdPrevio) || "Sin categoria";
        reglaTexto = "Categoria fija";
        if (!selectedCategoriaId) {
          deltaTexto = "Pendiente";
          valorPropuesto = "No seleccionada";
          error = "Seleccione una categoria";
        } else {
          const newName = catMap.get(Number(selectedCategoriaId)) || "Seleccionada";
          deltaTexto = categoriaIdPrevio === Number(selectedCategoriaId)
            ? "Sin cambio"
            : `${catMap.get(categoriaIdPrevio) || "Actual"} -> ${newName}`;
          valorPropuesto = newName;
          isValid = true;
          proposedValue = Number(selectedCategoriaId);
        }
      } else if (regla === "PROVEEDOR_FIJO") {
        valorPrevio = provMap.get(proveedorIdPrevio) || "Sin proveedor";
        reglaTexto = "Proveedor fijo";
        if (!selectedProveedorId) {
          deltaTexto = "Pendiente";
          valorPropuesto = "No seleccionado";
          error = "Seleccione un proveedor";
        } else {
          const newName = provMap.get(Number(selectedProveedorId)) || "Seleccionado";
          deltaTexto = proveedorIdPrevio === Number(selectedProveedorId)
            ? "Sin cambio"
            : `${provMap.get(proveedorIdPrevio) || "Actual"} -> ${newName}`;
          valorPropuesto = newName;
          isValid = true;
          proposedValue = Number(selectedProveedorId);
        }
      } else if (regla === "ESTADO_ACTIVO") {
        valorPrevio = activoPrevio ? "Activo" : "Inactivo";
        reglaTexto = `Fijar ${estadoActivo ? "Activo" : "Inactivo"}`;
        deltaTexto = activoPrevio === estadoActivo
          ? "Sin cambio"
          : `${activoPrevio ? "Activo" : "Inactivo"} -> ${estadoActivo ? "Activo" : "Inactivo"}`;
        valorPropuesto = estadoActivo ? "Activo" : "Inactivo";
        isValid = true;
        proposedValue = estadoActivo;
      }

      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        valorPrevio,
        reglaTexto,
        deltaTexto,
        valorPropuesto,
        isValid,
        error,
        warning,
        proposedValue,
      };
    });
  }, [
    selectedProducts,
    regla,
    precioFijo,
    porcentaje,
    stockMinimo,
    selectedCategoriaId,
    selectedProveedorId,
    estadoActivo,
    catMap,
    provMap,
  ]);

  const totalCount = validatedItems.length;
  const invalidCount = validatedItems.filter((it) => !it.isValid).length;
  const hasErrors = invalidCount > 0;

  const handleConfirm = async () => {
    if (hasErrors || totalCount === 0 || pending) return;

    const actualizaciones = validatedItems.map((it) => {
      const itemPayload = {
        codigo: it.codigo,
        producto_id: it.id,
        id: it.id,
      };

      if (regla === "PRECIO_FIJO" || regla === "PRECIO_PORCENTAJE") {
        itemPayload.precio_venta = it.proposedValue;
      } else if (regla === "STOCK_MINIMO_FIJO") {
        itemPayload.nivel_minimo = it.proposedValue;
      } else if (regla === "CATEGORIA_FIJA") {
        itemPayload.categoria_id = Number(selectedCategoriaId);
      } else if (regla === "PROVEEDOR_FIJO") {
        itemPayload.proveedor_id = Number(selectedProveedorId);
      } else if (regla === "ESTADO_ACTIVO") {
        itemPayload.activo = Boolean(estadoActivo);
      }

      return itemPayload;
    });

    const res = await onConfirm(actualizaciones);
    if (res?.ok !== false) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actualización masiva de productos"
      subtitle="Definición de regla operacional, vista previa con deltas y validación fila por fila."
      footer={
        <div className="row justify-between w-full align-center">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <div className="row gap-2 align-center">
            {hasErrors && (
              <span className="text-xs text-danger font-medium">
                {invalidCount} {invalidCount === 1 ? "fila inválida" : "filas inválidas"}
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
            Ningún producto se modificará si alguna fila resulta inválida.
          </span>
        </div>

        {hasErrors && (
          <Alert
            tone="danger"
            title="Validación pendiente de corrección"
            description="La confirmación está bloqueada porque existen errores en los valores propuestos. Ajusta los parámetros de la regla hasta que todas las filas resulten válidas."
          />
        )}

        <div className="p-3 bg-subtle rounded-md border stack gap-3">
          <FormField label="Regla a aplicar a la selección" required>
            <Select
              options={REGLAS}
              value={regla}
              onChange={(val) => setRegla(val)}
            />
          </FormField>

          {regla === "PRECIO_FIJO" && (
            <NumberInput
              label="Nuevo precio de venta fijo ($)"
              required
              min="0.01"
              step="0.01"
              value={precioFijo}
              onChange={(e) => setPrecioFijo(e.target.value)}
              placeholder="p. ej. 1500.00"
              hint="Se fijará este valor exacto como nuevo precio de venta a todos los artículos seleccionados."
            />
          )}

          {regla === "PRECIO_PORCENTAJE" && (
            <NumberInput
              label="Porcentaje de ajuste (+/- %)"
              required
              step="0.1"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              placeholder="p. ej. +15 o -10"
              hint="Ingrese valores positivos para incrementos (p. ej. 10) o negativos para descuentos (p. ej. -5)."
            />
          )}

          {regla === "STOCK_MINIMO_FIJO" && (
            <NumberInput
              label="Nuevo stock mínimo fijo (unidades)"
              required
              min="1"
              step="1"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              placeholder="p. ej. 15"
              hint="Umbral de alerta para reposición y alertas Observer del sistema."
            />
          )}

          {regla === "CATEGORIA_FIJA" && (
            <FormField label="Nueva categoría para todos los seleccionados" required>
              <Select
                options={catOptions}
                value={selectedCategoriaId}
                onChange={(val) => setSelectedCategoriaId(val)}
                placeholder="Seleccionar categoría"
              />
            </FormField>
          )}

          {regla === "PROVEEDOR_FIJO" && (
            <FormField label="Nuevo proveedor para todos los seleccionados" required>
              <Select
                options={provOptions}
                value={selectedProveedorId}
                onChange={(val) => setSelectedProveedorId(val)}
                placeholder="Seleccionar proveedor"
              />
            </FormField>
          )}

          {regla === "ESTADO_ACTIVO" && (
            <FormField label="Estado operativo de los productos seleccionados">
              <SegmentedControl
                value={estadoActivo ? "true" : "false"}
                onChange={(val) => setEstadoActivo(val === "true")}
                options={[
                  { value: "true", label: "Activo (comercializable)" },
                  { value: "false", label: "Inactivo (baja lógica)" },
                ]}
              />
            </FormField>
          )}
        </div>

        <div className="erp-table-scroll border rounded-md">
          <table className="erp-table erp-table--compact w-full">
            <thead>
              <tr>
                <th>Código SKU</th>
                <th>Nombre comercial</th>
                <th className="align-right">Valor previo</th>
                <th>Regla</th>
                <th className="align-right">Delta / Diferencia</th>
                <th className="align-right">Valor propuesto</th>
                <th>Validación</th>
              </tr>
            </thead>
            <tbody>
              {validatedItems.map((item) => (
                <tr key={item.codigo} className={!item.isValid ? "bg-danger-subtle" : ""}>
                  <td className="font-mono text-xs font-medium">{item.codigo}</td>
                  <td className="text-xs">{item.nombre}</td>
                  <td className="align-right text-xs tabular-nums text-muted">
                    {item.valorPrevio}
                  </td>
                  <td className="text-xs text-secondary">{item.reglaTexto}</td>
                  <td className="align-right text-xs tabular-nums font-medium">
                    {item.deltaTexto}
                  </td>
                  <td className="align-right text-xs tabular-nums font-medium text-primary">
                    {item.valorPropuesto}
                  </td>
                  <td>
                    {!item.isValid ? (
                      <span className="text-xs text-danger font-medium">
                        {item.error}
                      </span>
                    ) : item.warning ? (
                      <span className="text-xs text-warning font-medium">
                        {item.warning}
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

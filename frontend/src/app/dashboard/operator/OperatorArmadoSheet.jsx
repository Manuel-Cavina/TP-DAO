import React, { useState, useEffect } from "react";
import { useToast } from "../../../shared/feedback/ToastContext";
import { BottomSheet } from "../../../components/arc/bottom-sheet/bottom-sheet";
import { Input } from "../../../components/arc/input/input";
import { Button } from "../../../components/arc/button/button";
import styles from "../OperatorDashboardPage.module.css";

export function OperatorArmadoSheet({
  open,
  onOpenChange,
  targetOrden,
  productoMap,
  onSubmitBulto,
}) {
  const [cantidades, setCantidades] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notifyWarning } = useToast();

  useEffect(() => {
    if (open && targetOrden?.items) {
      const initial = {};
      for (const item of targetOrden.items) {
        if (item.restante > 0) {
          initial[item.productoId] = item.restante;
        }
      }
      setCantidades(initial);
    }
  }, [open, targetOrden]);

  const handleSubmit = async () => {
    const items = Object.entries(cantidades)
      .map(([productoId, cant]) => ({
        producto_id: Number(productoId),
        cantidad: Number(cant) || 0,
      }))
      .filter((item) => item.cantidad > 0);

    if (items.length === 0) {
      notifyWarning("Falta cantidad", "Ingresá al menos una cantidad mayor a cero para embalar.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitBulto(targetOrden.id, items);
      onOpenChange(false);
    } catch (err) {
      // el toast del hook ya informó el motivo
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeItems = (targetOrden?.items || []).filter((it) => it.restante > 0);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={targetOrden ? `Armar bulto para orden #${targetOrden.id}` : "Armar bulto"}
      description="Define las cantidades de productos a incluir en este bulto físico"
    >
      <div className={styles.sheetContent}>
        {activeItems.map((item) => {
          const prod = productoMap.get(item.productoId);
          return (
            <div key={item.id} className={styles.fieldContainer}>
              <Input
                type="number"
                label={prod?.nombre || `Producto #${item.productoId}`}
                description={`Restante por embalar: ${item.restante} u (solicitado: ${item.solicitado} u, embalado previo: ${item.embalado} u)`}
                value={cantidades[item.productoId] ?? 0}
                onChange={(e) =>
                  setCantidades((prev) => ({
                    ...prev,
                    [item.productoId]: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                min={0}
              />
            </div>
          );
        })}

        <div className={styles.sheetActions}>
          <Button
            size="md"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            Crear bulto
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

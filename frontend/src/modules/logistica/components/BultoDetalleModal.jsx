import React from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";

/**
 * BultoDetalleModal:
 * Inspección detallada del contenido de un bulto y su precinto sin edición inline.
 */
export function BultoDetalleModal({
  open,
  onClose,
  bulto,
  ordenId,
  isAprobado,
  aprobando = false,
  onAprobar,
}) {
  if (!bulto) return null;

  const totalUnidades = (bulto.detalles || []).reduce(
    (acc, det) => acc + (det.cantidad || 0),
    0
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Detalle del bulto #${bulto.id}`}
      subtitle={`Orden de reposición #${ordenId || ""} · Manifiesto de contenido y seguridad`}
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {bulto.estado === "PRECINTADO" && !isAprobado && onAprobar && (
            <Button
              variant="primary"
              iconLeft="check"
              loading={aprobando}
              onClick={async () => {
                await onAprobar?.(bulto.id);
                onClose();
              }}
            >
              Aprobar este bulto
            </Button>
          )}
        </div>
      }
    >
      <div className="stack gap-4">
        <div className="p-3 rounded bg-surface-muted row justify-between align-center wrap gap-2">
          <div>
            <span className="text-xs text-muted block">Estado operativo</span>
            <StatusBadge status={bulto.estado} />
          </div>
          <div>
            <span className="text-xs text-muted block">Precinto de seguridad</span>
            <span className="font-mono text-sm font-medium">
              {bulto.codigoPrecinto || "Sin precinto asignado"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted block">Aprobación (US4)</span>
            {isAprobado ? (
              <span className="badge badge--success text-xs">Aprobado</span>
            ) : (
              <span className="badge text-xs">Pendiente</span>
            )}
          </div>
        </div>

        <div className="stack gap-2">
          <span className="text-xs text-secondary font-medium">Artículos contenidos en este bulto:</span>
          <div className="stack gap-2 border rounded p-2">
            {(bulto.detalles || []).map((det) => (
              <div
                key={det.productoId}
                className="row justify-between align-center p-2 rounded bg-surface-muted text-sm"
              >
                <span className="font-mono">Producto #{det.productoId}</span>
                <span className="font-mono font-medium">{det.cantidad} u.</span>
              </div>
            ))}
            <div className="row justify-between align-center pt-2 border-t px-2 text-sm font-medium">
              <span>Total contenido:</span>
              <span className="font-mono">{totalUnidades} u.</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default BultoDetalleModal;

import React from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";

/**
 * AprobacionRevisionModal (T045 / FR-041 / US4):
 * Dialogo de revision para aprobacion de bultos precintados en lote o individual,
 * mostrando explicitamente los bultos elegibles y los motivos de bultos bloqueados.
 */
export function AprobacionRevisionModal({
  open,
  onClose,
  orden,
  bultos = [],
  aprobadosSet = new Set(),
  onConfirmarAprobacion,
  pending = false,
  serverOutcome = null,
}) {
  // Clasificar bultos en elegibles vs bloqueados
  const { elegibles, bloqueados } = React.useMemo(() => {
    const el = [];
    const bl = [];

    bultos.forEach((b) => {
      const yaAprobado = aprobadosSet.has(b.id) || b.aprobado;
      const tieneItems = (b.detalles?.length || 0) > 0;
      const estaPrecintado = b.estado === "PRECINTADO" && Boolean(b.codigoPrecinto);

      if (yaAprobado) {
        bl.push({
          bulto: b,
          motivo: "El bulto ya cuenta con evidencia de aprobación registrada.",
          tipo: "aprobado",
        });
      } else if (!estaPrecintado) {
        bl.push({
          bulto: b,
          motivo: "Bulto sin precinto de seguridad asignado (requiere estado PRECINTADO).",
          tipo: "sin_precinto",
        });
      } else if (!tieneItems) {
        bl.push({
          bulto: b,
          motivo: "El bulto no contiene artículos o unidades asignadas.",
          tipo: "sin_items",
        });
      } else {
        el.push(b);
      }
    });

    return { elegibles: el, bloqueados: bl };
  }, [bultos, aprobadosSet]);

  const handleConfirmar = async () => {
    if (elegibles.length === 0) return;
    const ids = elegibles.map((b) => b.id);
    await onConfirmarAprobacion(ids);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revisión de aprobación de bultos"
      subtitle={`Orden #${orden?.id || ""} · Validación formal de precintos y contenido (FR-041)`}
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmar}
            loading={pending}
            loadingLabel="Aprobando bultos..."
            disabled={elegibles.length === 0}
          >
            Confirmar aprobación ({elegibles.length} bulto{elegibles.length !== 1 ? "s" : ""})
          </Button>
        </div>
      }
    >
      <div className="stack gap-4">
        {serverOutcome && <div role="status" className="erp-callout">El servidor aprobó {serverOutcome.approved.length} bulto(s).{serverOutcome.blocked.length > 0 && <ul>{serverOutcome.blocked.map((item) => <li key={item.id}>Bulto #{item.id}: {item.motivo}</li>)}</ul>}</div>}
        <div className="erp-callout">
          <span className="text-sm text-secondary">
            Regla FR-041: La aprobación verifica que cada bulto esté completamente
            sellado con un precinto único y no modifica el estado del ciclo de vida del
            bulto. Cada bulto aprobado recibe evidencia individual inmutable de auditoría.
          </span>
        </div>

        {/* Bultos elegibles */}
        <div className="stack gap-2">
          <div className="row justify-between align-center">
            <span className="text-xs text-muted font-medium">
              BULTOS ELEGIBLES PARA APROBACIÓN ({elegibles.length})
            </span>
          </div>

          {elegibles.length === 0 ? (
            <div className="p-3 rounded bg-surface-muted text-center text-sm text-secondary">
              No hay bultos pendientes que cumplan las condiciones para aprobación.
            </div>
          ) : (
            <div className="stack gap-2 max-h-48 overflow-y-auto">
              {elegibles.map((b) => {
                const totalUnits = (b.detalles || []).reduce(
                  (sum, d) => sum + (d.cantidad || 0),
                  0
                );
                return (
                  <div
                    key={b.id}
                    className="row justify-between align-center p-3 rounded bg-surface-muted border border-border-subtle text-sm"
                  >
                    <div className="stack gap-1">
                      <div className="row gap-2 align-center">
                        <span className="font-mono font-medium">Bulto #{b.id}</span>
                        <span className="font-mono text-xs text-secondary">
                          Precinto: <strong>{b.codigoPrecinto}</strong>
                        </span>
                      </div>
                      <span className="text-xs text-secondary">
                        {totalUnits} unidades en {b.detalles?.length || 0} artículo(s)
                      </span>
                    </div>
                    <span className="text-xs text-success font-medium">
                      Listo para aprobar
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bultos bloqueados con motivos explicitos */}
        {bloqueados.length > 0 && (
          <div className="stack gap-2 pt-2 border-t">
            <div className="row justify-between align-center">
              <span className="text-xs text-muted font-medium">
                BULTOS EXCLUIDOS O BLOQUEADOS ({bloqueados.length})
              </span>
            </div>

            <div className="stack gap-2 max-h-40 overflow-y-auto">
              {bloqueados.map(({ bulto, motivo, tipo }) => (
                <div
                  key={bulto.id}
                  className="row justify-between align-center p-2 rounded bg-surface-muted text-xs"
                >
                  <div className="row gap-2 align-center">
                    <span className="font-mono font-medium">Bulto #{bulto.id}</span>
                    <span className="text-secondary">{motivo}</span>
                  </div>
                  <StatusBadge
                    status={tipo === "aprobado" ? "VERIFICADO" : "PENDIENTE"}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default AprobacionRevisionModal;

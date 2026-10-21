import React from "react";
import { Drawer } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { BultoStepper } from "../../../shared/components/DomainWidgets";
import { Badge } from "../../../shared/components/Badge";
import { useBultoTrazabilidad } from "../hooks/useBultoTrazabilidad";

export function TrazabilidadDrawer({ open, onClose, bultoId, bultoEstado, precintoCodigo }) {
  const { trazabilidad, loading } = useBultoTrazabilidad(bultoId);

  const historial = trazabilidad?.historial || [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Trazabilidad de bulto #${bultoId || ""}`}
      subtitle="Auditoría inmutable de estados (Patrón State / Regla V2)"
      badge={<Badge tone="cd">{bultoEstado || "State"}</Badge>}
      footer={
        <Button variant="primary" onClick={onClose}>
          Cerrar trazabilidad
        </Button>
      }
    >
      <div className="stack gap-5">
        <BultoStepper
          currentState={bultoEstado || "En_Transito"}
          precintoCode={precintoCodigo || "PRC-2026-0001"}
        />

        <div className="erp-section-card stack gap-3">
          <h3 className="text-md font-medium">Línea de tiempo auditada</h3>
          {loading && <p className="text-xs text-muted">Cargando bitácora de eventos...</p>}
          {!loading && historial.length === 0 && (
            <p className="text-xs text-muted">No se registraron transiciones previas.</p>
          )}
          <div className="stack gap-2">
            {historial.map((h, i) => (
              <div key={i} className="erp-callout row justify-between align-center">
                <div className="stack gap-1">
                  <span className="font-medium text-xs">
                    {h.estado_anterior} → {h.estado_nuevo}
                  </span>
                  <span className="text-xs text-secondary">{h.observacion}</span>
                </div>
                <span className="tabular-nums font-mono text-xs text-muted">
                  {h.fecha_hora ? new Date(h.fecha_hora).toLocaleTimeString("es-AR") : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

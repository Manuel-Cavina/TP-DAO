import React from "react";
import { Button, StatusBadge } from "../../../shared";

export function OrdenDespachoTab({
  remito,
  origenNombre,
  destinoNombre,
  estaCompletamenteEmpaquetada,
  bultosTodosPrecintados,
  despachando,
  onEmitirRemitoClick,
  onDespacharClick,
  onIrAEmpaque,
  onIrARecepcion,
}) {
  if (!estaCompletamenteEmpaquetada || !bultosTodosPrecintados) {
    return (
      <div className="card p-4 stack gap-3">
        <div>
          <h3 className="text-md font-medium">Despacho todavía no disponible</h3>
          <p className="text-sm text-secondary">
            Completá el empaque y asigná un precinto a cada bulto antes de emitir el remito.
          </p>
        </div>
        <div>
          <Button variant="primary" onClick={onIrAEmpaque}>
            Completar empaque y precintos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack gap-3">
      <div className="grid-2 gap-3">
        {/* Remito único asociado */}
        <div className="card p-4 stack gap-3">
          <div className="row justify-between align-center">
            <h3 className="text-md font-medium">Remito formal asociado</h3>
            {remito && <StatusBadge status={remito.estado} />}
          </div>

          {remito ? (
            <div className="stack gap-2">
              <div className="row justify-between align-center p-3 rounded bg-surface-muted wrap gap-2">
                <div>
                  <span className="text-xs text-muted">Número formal</span>
                  <div className="font-mono text-sm font-medium">{remito.numero}</div>
                </div>
                <div>
                  <span className="text-xs text-muted">Emisión</span>
                  <div className="text-sm">
                    {remito.fechaEmision ? new Date(remito.fechaEmision).toLocaleDateString("es-AR") : "-"}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={despachando}
                  onClick={remito.estado === "EMITIDO" ? onDespacharClick : onIrARecepcion}
                >
                  {remito.estado === "EMITIDO" ? "Despachar traslado" : "Gestionar recepción"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded bg-surface-muted text-xs text-secondary">
              Aún no se ha emitido el remito formal de despacho para esta orden. Requiere empaquetar la totalidad de unidades y precintar cada bulto (FR-021).
            </div>
          )}
        </div>

        {/* Impacto operativo y en stock */}
        <div className="card p-4 stack gap-2">
          <h3 className="text-md font-medium">Impacto operativo y en stock</h3>
          <div className="stack gap-1 text-xs text-secondary">
            <p>
              · <strong>En CD Origen ({origenNombre}):</strong> El stock queda reservado durante la preparación y se descuenta al despachar el remito.
            </p>
            <p>
              · <strong>En tránsito:</strong> La mercadería permanece en custodia legal bajo el amparo de remito y precintos numerados.
            </p>
            <p>
              · <strong>En Destino ({destinoNombre}):</strong> La mercadería <strong>NO</strong> suma al stock disponible hasta que los bultos sean verificados con precinto intacto (Regla V1).
            </p>
          </div>
        </div>
      </div>

      {!remito && (
        <div className="card p-4 row justify-between align-center wrap gap-3">
          <span className="text-sm text-secondary">
            Los bultos están listos. Emití el remito formal de despacho para iniciar el traslado.
          </span>
          <Button variant="primary" onClick={onEmitirRemitoClick}>
            Emitir remito formal
          </Button>
        </div>
      )}
    </div>
  );
}

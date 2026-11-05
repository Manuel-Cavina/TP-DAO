import React from "react";
import { Warehouse, Store, ArrowRight, ArrowLeft, Check, ShieldCheck, Clock, FileCheck, Package } from "lucide-react";
import { Button } from "../../../components/arc/button/button";
import { Badge } from "../../../components/arc/badge/badge";

export function CrearOrdenPaso2({
  effectiveDestinoId,
  effectiveOrigenId,
  ubicMap,
  ubicaciones = [],
  productoMap,
  consolidatedItems = [],
  totalUnidades = 0,
  stockDestinoMap,
  stockOrigenMap,
  submitting = false,
  onConfirmOrder,
  onBack,
}) {
  const cdObj = ubicaciones.find((u) => String(u.id) === String(effectiveOrigenId));
  const localObj = ubicaciones.find((u) => String(u.id) === String(effectiveDestinoId));


  return (
    <div className="card p-6 stack gap-5">
      <div>
        <h2 className="text-lg font-medium">Paso 2: Revisión operativa y emisión de la orden</h2>
        <p className="text-sm text-secondary">
          Verifique el itinerario logístico, el balance de existencias proyectado y las reglas de despacho antes de emitir la orden formal.
        </p>
      </div>

      <div className="p-4 rounded-xl border bg-surface-muted stack gap-3">
        <span className="text-xs font-medium text-secondary">Itinerario logístico de abastecimiento</span>
        <div className="grid-3 align-center gap-4">
          <div className="p-3 rounded-lg border bg-surface stack gap-1">
            <div className="row justify-between align-center">
              <span className="text-xs text-muted">Origen (Casa central)</span>
              <Badge tone="success" size="sm" dot>Operativo</Badge>
            </div>
            <div className="row gap-2 align-center">
              <Warehouse width={18} height={18} className="text-secondary" aria-hidden="true" />
              <span className="text-sm font-medium">{cdObj?.nombre || `CD #${effectiveOrigenId}`}</span>
            </div>
            <span className="text-xs text-secondary">{cdObj?.direccion || "Centro de Distribución emisor"}</span>
          </div>

          <div className="stack align-center justify-center gap-1 text-center">
            <div className="row align-center gap-2 text-secondary">
              <div className="erp-divider-line" />
              <Package width={18} height={18} className="text-secondary" aria-hidden="true" />
              <ArrowRight width={16} height={16} className="text-secondary" aria-hidden="true" />
              <div className="erp-divider-line" />
            </div>
            <span className="text-xs font-medium text-secondary">Transferencia directa</span>
            <Badge tone="neutral" size="sm" pill>Bultos precintados</Badge>
          </div>

          <div className="p-3 rounded-lg border bg-surface stack gap-1">
            <div className="row justify-between align-center">
              <span className="text-xs text-muted">Destino (Sucursal única)</span>
              <Badge tone="info" size="sm" dot>Local comercial</Badge>
            </div>
            <div className="row gap-2 align-center">
              <Store width={18} height={18} className="text-secondary" aria-hidden="true" />
              <span className="text-sm font-medium">{localObj?.nombre || `Local #${effectiveDestinoId}`}</span>
            </div>
            <span className="text-xs text-secondary">{localObj?.direccion || "Sucursal receptora exclusiva"}</span>
          </div>
        </div>
      </div>

      <div className="grid-2 gap-3">
        <div className="p-4 rounded-xl border bg-surface stack gap-1">
          <span className="text-xs text-muted">Renglones únicos</span>
          <span className="text-2xl font-medium tabular-nums">{consolidatedItems.length}</span>
          <span className="text-xs text-secondary">Artículos distintos</span>
        </div>
        <div className="p-4 rounded-xl border bg-surface stack gap-1">
          <span className="text-xs text-muted">Unidades a transferir</span>
          <span className="text-2xl font-medium tabular-nums">{totalUnidades}</span>
          <span className="text-xs text-secondary">Total consolidado</span>
        </div>

      </div>

      <div className="stack gap-3">
        <div className="row justify-between align-center">
          <span className="text-sm font-medium">Detalle de renglones y proyección de existencias</span>
          <span className="text-xs text-secondary">{consolidatedItems.length} producto(s) en orden</span>
        </div>

        <div className="logistics-review-table rounded-xl border">
          <table className="w-full text-sm border-collapse text-left">
            <thead>
              <tr className="bg-surface-muted text-xs text-secondary border-b">
                <th className="p-3 font-medium">Artículo</th>
                <th className="p-3 font-medium">Motivo / Origen</th>
                <th className="p-3 font-medium text-right">Stock CD (Origen)</th>
                <th className="p-3 font-medium text-right">Stock Local (Destino)</th>
                <th className="p-3 font-medium text-right">Cantidad a enviar</th>
              </tr>
            </thead>
            <tbody>
              {consolidatedItems.map((it) => {
                const prod = productoMap.get(it.productoId);
                const cdStock = stockOrigenMap.get(it.productoId)?.disponible || 0;
                const cdRestante = cdStock - it.cantidad;
                const localStock = stockDestinoMap.get(it.productoId)?.disponible || 0;
                const localProyectado = localStock + it.cantidad;

                return (
                  <tr key={it.productoId} className="border-b last:border-0 hover:bg-surface-muted/50 transition-colors">
                    <td className="p-3">
                      <div className="font-mono text-xs text-secondary">{prod?.codigo || `SKU-${it.productoId}`}</div>
                      <div className="font-medium text-foreground">{prod?.nombre || `Producto #${it.productoId}`}</div>
                    </td>
                    <td className="p-3">
                      {it.origenNec?.length > 0 ? (
                        <Badge tone="info" size="sm">
                          Necesidad #{it.origenNec.join(", #")}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          Carga manual
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs">
                      <div>Disponible: <span className="font-medium">{cdStock} un.</span></div>
                      <div className="text-secondary">Después del despacho (proyección): <span className="font-medium">{cdRestante} un.</span></div>
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs">
                      <div>Actual: <span className="font-medium">{localStock} un.</span></div>
                      <div className="text-secondary">Tras verificar y cerrar (proyección): <span className="font-medium text-success">{localProyectado} un.</span></div>
                    </td>
                    <td className="p-3 text-right font-medium tabular-nums text-base">
                      {it.cantidad} un.
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-3 gap-3">
        <div className="p-4 rounded-xl border bg-surface stack gap-2">
          <div className="row gap-2 align-center text-foreground font-medium text-sm">
            <ShieldCheck width={18} height={18} className="text-secondary" aria-hidden="true" />
            <span>Precintos de seguridad (FR-020)</span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Cada bulto físico generado en CD debe contar con precinto numerado único intransferible antes de autorizar el despacho.
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-surface stack gap-2">
          <div className="row gap-2 align-center text-foreground font-medium text-sm">
            <Clock width={18} height={18} className="text-secondary" aria-hidden="true" />
            <span>No duplicidad de stock</span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Crear la orden no acredita stock en destino. El despacho descuenta el origen; el cierre acredita únicamente las unidades de bultos verificados.
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-surface stack gap-2">
          <div className="row gap-2 align-center text-foreground font-medium text-sm">
            <FileCheck width={18} height={18} className="text-secondary" aria-hidden="true" />
            <span>Trazabilidad de necesidades</span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Las necesidades de reposición vinculadas quedarán formalmente liquidadas y cambiarán su estado a atendidas por esta orden.
          </p>
        </div>
      </div>

      <div className="row justify-between pt-4 border-t align-center">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft width={16} height={16} aria-hidden="true" />
          <span>Modificar artículos y ruta</span>
        </Button>
        <Button
          variant="primary"
          onClick={onConfirmOrder}
          loading={submitting}
        >
          <Check width={16} height={16} aria-hidden="true" />
          <span>Confirmar y emitir orden de reposición</span>
        </Button>
      </div>
    </div>
  );
}

export default CrearOrdenPaso2;

import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { Icon } from "../../../shared/components/Icon";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { stockService } from "../../ubicaciones_stock/services/stockService";

export function RecepcionPreCierreModal({
  open,
  onClose,
  activeRemito,
  destinoNombre = "",
  cerrando = false,
  onConfirm,
  unidadesVerificadas = 0,
  unidadesMerma = 0,
}) {
  const { productos } = useProductos({ activos: false });
  const [stockDestino, setStockDestino] = useState(new Map());

  const prodMap = useMemo(() => {
    const map = new Map();
    for (const p of productos || []) {
      map.set(p.id, p);
    }
    return map;
  }, [productos]);

  useEffect(() => {
    if (!open || !activeRemito?.destinoId) return;
    let active = true;

    stockService
      .consultarPorUbicacion(activeRemito.destinoId)
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res) ? res : res?.data || [];
        const map = new Map();
        for (const item of items) {
          map.set(item.producto_id, Number(item.cantidad_disponible) || 0);
        }
        setStockDestino(map);
      })
      .catch(() => {
        // Fallback silencioso si falla la consulta
      });

    return () => {
      active = false;
    };
  }, [open, activeRemito?.destinoId]);

  const { itemsVerificados, itemsRechazados } = useMemo(() => {
    const verifMap = new Map();
    const rechMap = new Map();

    for (const b of activeRemito?.bultosResumen || []) {
      const isVerif = b.estado === "VERIFICADO";
      const isRech = b.estado === "RECHAZADO";
      if (!isVerif && !isRech) continue;

      const motivo =
        b.historial
          ?.slice()
          .reverse()
          .find((h) => h.estado_nuevo === "RECHAZADO")?.observacion ||
        b.motivoRechazo ||
        "";

      for (const d of b.detalles || []) {
        const pid = d.producto_id;
        const cant = Number(d.cantidad) || 0;
        if (cant <= 0) continue;

        const targetMap = isVerif ? verifMap : rechMap;
        if (!targetMap.has(pid)) {
          targetMap.set(pid, {
            productoId: pid,
            cantidad: 0,
            bultos: [],
          });
        }
        const entry = targetMap.get(pid);
        entry.cantidad += cant;
        entry.bultos.push({
          bultoId: b.id,
          codigo: b.codigo || `BLT-${String(b.id).padStart(4, "0")}`,
          cantidad: cant,
          motivo,
        });
      }
    }

    return {
      itemsVerificados: Array.from(verifMap.values()),
      itemsRechazados: Array.from(rechMap.values()),
    };
  }, [activeRemito?.bultosResumen]);

  const localDisplay = destinoNombre || `Sede #${activeRemito?.destinoId || ""}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Confirmación de cierre e impacto de stock"
      subtitle={`Remito ${activeRemito?.numero || ""} · Destino: ${localDisplay}`}
      footer={
        <div className="row justify-between w-full align-center">
          <Button variant="ghost" onClick={onClose} disabled={cerrando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={cerrando}
            loadingLabel="Confirmando cierre..."
          >
            Confirmar cierre e impacto
          </Button>
        </div>
      }
    >
      <div className="stack gap-4">
        <div className="card p-3 bg-surface-muted border stack gap-1">
          <div className="row align-center gap-2">
            <Icon name="store" size={16} className="text-accent" />
            <span className="text-xs font-medium text-secondary">
              Sucursal destino de acreditación:
            </span>
            <span className="text-sm font-medium">{localDisplay}</span>
          </div>
          <p className="text-xs text-secondary">
            Revise el impacto del cierre formal en el inventario comercial de {localDisplay}.
            Las unidades verificadas se acreditarán inmediatamente al stock disponible vendible.
            Los bultos rechazados no aumentarán la existencia y se asentarán en el registro formal de merma.
          </p>
        </div>

        <div className="grid-2 gap-3">
          <div className="card p-3 bg-success-subtle border-success stack gap-1">
            <div className="row align-center gap-1.5 text-success">
              <Icon name="check-circle" size={15} />
              <span className="text-xs font-medium">Acreditación a stock vendible</span>
            </div>
            <span className="text-xl font-medium text-success">
              {activeRemito?.bultosVerificados || 0} bulto{activeRemito?.bultosVerificados === 1 ? "" : "s"} · {unidadesVerificadas} u.
            </span>
            <span className="text-xs text-secondary">
              Aumentará el stock disponible en {localDisplay}
            </span>
          </div>

          <div className="card p-3 bg-danger-subtle border-danger stack gap-1">
            <div className="row align-center gap-1.5 text-danger">
              <Icon name="alert-triangle" size={15} />
              <span className="text-xs font-medium">Registro formal de merma</span>
            </div>
            <span className="text-xl font-medium text-danger">
              {activeRemito?.bultosRechazados || 0} bulto{activeRemito?.bultosRechazados === 1 ? "" : "s"} · {unidadesMerma} u.
            </span>
            <span className="text-xs text-secondary">
              NO aumentará el stock vendible (precinto no conforme)
            </span>
          </div>
        </div>

        <div className="stack gap-2">
          <div className="row justify-between align-center">
            <div className="row align-center gap-2">
              <Icon name="check" size={15} className="text-success" />
              <h3 className="text-sm font-medium">
                Productos que aumentarán el stock en {localDisplay}
              </h3>
            </div>
            <span className="text-xs text-secondary font-mono">
              {itemsVerificados.length} producto{itemsVerificados.length === 1 ? "" : "s"} · +{unidadesVerificadas} u.
            </span>
          </div>

          {itemsVerificados.length > 0 ? (
            <div className="stack gap-2">
              {itemsVerificados.map((item) => {
                const prod = prodMap.get(item.productoId);
                const actual = stockDestino.get(item.productoId);
                const tieneActual = actual !== undefined;
                const proyectado = tieneActual ? actual + item.cantidad : null;

                return (
                  <div key={item.productoId} className="erp-impact-item erp-impact-item--success">
                    <div className="stack gap-0.5">
                      <div className="row align-center gap-2">
                        <span className="font-mono text-xs text-secondary">
                          {prod?.codigo || `SKU #${item.productoId}`}
                        </span>
                        <span className="text-sm font-medium">
                          {prod?.nombre || `Producto #${item.productoId}`}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        Bulto(s) conforme(s):{" "}
                        {item.bultos.map((b) => `${b.codigo} (${b.cantidad} u.)`).join(", ")}
                      </span>
                    </div>

                    <div className="stack gap-0.5 align-end">
                      <span className="erp-impact-badge erp-impact-badge--success tabular-nums">
                        <Icon name="check" size={12} />
                        +{item.cantidad} u. vendibles
                      </span>
                      <div className="erp-impact-stock-shift tabular-nums font-mono">
                        {tieneActual ? (
                          <>
                            <span>Stock actual: {actual} u.</span>
                            <Icon name="arrow-right" size={11} />
                            <span className="font-medium text-success">Proyectado: {proyectado} u.</span>
                          </>
                        ) : (
                          <span>Aumenta +{item.cantidad} u. en {localDisplay}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded bg-surface-muted text-xs text-secondary">
              No hay unidades conformes en este remito para sumar al stock vendible de {localDisplay}.
            </div>
          )}
        </div>

        <div className="stack gap-2">
          <div className="row justify-between align-center">
            <div className="row align-center gap-2">
              <Icon name="shield-off" size={15} className="text-danger" />
              <h3 className="text-sm font-medium">
                Mercadería no acreditada · Bultos no aprobados (Merma formal)
              </h3>
            </div>
            <span className="text-xs text-secondary font-mono">
              {itemsRechazados.length} producto{itemsRechazados.length === 1 ? "" : "s"} · {unidadesMerma} u.
            </span>
          </div>

          {itemsRechazados.length > 0 ? (
            <div className="stack gap-2">
              {itemsRechazados.map((item) => {
                const prod = prodMap.get(item.productoId);
                const actual = stockDestino.get(item.productoId);
                const tieneActual = actual !== undefined;

                return (
                  <div key={item.productoId} className="erp-impact-item erp-impact-item--danger">
                    <div className="stack gap-0.5">
                      <div className="row align-center gap-2">
                        <span className="font-mono text-xs text-secondary">
                          {prod?.codigo || `SKU #${item.productoId}`}
                        </span>
                        <span className="text-sm font-medium">
                          {prod?.nombre || `Producto #${item.productoId}`}
                        </span>
                      </div>
                      <div className="text-xs text-danger stack gap-0.5">
                        {item.bultos.map((b) => (
                          <span key={b.bultoId}>
                            Bulto {b.codigo} ({b.cantidad} u.)
                            {b.motivo ? `: ${b.motivo}` : ": Precinto violado o alterado"}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="stack gap-0.5 align-end">
                      <span className="erp-impact-badge erp-impact-badge--danger tabular-nums">
                        <Icon name="alert-triangle" size={12} />
                        +0 u. vendibles ({item.cantidad} u. merma)
                      </span>
                      <div className="erp-impact-stock-shift tabular-nums font-mono">
                        {tieneActual ? (
                          <>
                            <span>Stock en {localDisplay}: {actual} u.</span>
                            <Icon name="arrow-right" size={11} />
                            <span className="font-medium text-secondary">Se mantiene en {actual} u.</span>
                          </>
                        ) : (
                          <span>No suma existencia comercial en {localDisplay}</span>
                        )}
                      </div>
                      <span className="text-xs text-danger">
                        Derivado formalmente a merma (Regla V1 / FR-020)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded bg-surface-muted text-xs text-secondary">
              0 mermas registradas. El 100% de la carga cumplió con el control de precintos.
            </div>
          )}
        </div>

        <div className="erp-callout">
          <span className="text-sm text-secondary">
            Consecuencia legal y contable: El cierre de remito es definitivo. Los productos con bultos verificados se acreditarán al inventario vendible de <strong>{localDisplay}</strong>. Los bultos rechazados no incrementarán el stock disponible y se asentarán en el registro formal de merma (Regla V1 / FR-020).
          </span>
        </div>
      </div>
    </Modal>
  );
}

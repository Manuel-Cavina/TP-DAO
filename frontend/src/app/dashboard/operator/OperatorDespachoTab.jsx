import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "../../../components/arc/button/button";
import { Badge } from "../../../components/arc/badge/badge";
import { EmptyState } from "../../../components/arc/empty-state/empty-state";
import { HoldToConfirm } from "../../../components/arc/hold-to-confirm/hold-to-confirm";
import styles from "../OperatorDashboardPage.module.css";

export function OperatorDespachoTab({
  gruposBultosPorEmitirRemito = [],
  remitosPorDespachar = [],
  branches = [],
  onGenerarRemito,
  onDespacharRemito,
}) {
  const getBranchName = (destId) => {
    const found = branches.find((b) => String(b.id) === String(destId));
    return found?.nombre || `Local #${destId}`;
  };

  const totalPendientes =
    gruposBultosPorEmitirRemito.length + remitosPorDespachar.length;

  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Despacho de bultos y remitos</h2>
        <span className={styles.sectionCount}>
          {totalPendientes} acciones pendientes
        </span>
      </div>

      {totalPendientes === 0 ? (
        <EmptyState
          title="Sin despachos pendientes"
          description="No hay bultos aprobados sin remito ni remitos pendientes de salida al transporte."
        />
      ) : (
        <>
          {gruposBultosPorEmitirRemito.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Bultos aprobados listos para emitir remito
              </h3>
              {gruposBultosPorEmitirRemito.map((grupo) => (
                <article key={grupo.ordenId} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Orden #{grupo.ordenId} · Destino {getBranchName(grupo.destinoId)}
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        {grupo.bultos.length} bulto(s) precintado(s) y aprobado(s)
                      </p>
                    </div>
                    <Badge tone="success">Aprobados</Badge>
                  </div>

                  <div className={styles.itemsList}>
                    {grupo.bultos.map((b) => (
                      <div key={b.id} className={styles.itemRow}>
                        <span>Bulto #{b.id}</span>
                        <span className={styles.itemQuantity}>
                          Precinto: {b.codigoPrecinto || b.codigo_precinto || "Sin precinto"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="md"
                    onClick={() =>
                      onGenerarRemito(
                        grupo.ordenId,
                        grupo.bultos.map((b) => b.id)
                      )
                    }
                  >
                    Emitir remito de despacho
                  </Button>
                </article>
              ))}
            </>
          )}

          {remitosPorDespachar.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Remitos listos para salida al transporte
              </h3>
              {remitosPorDespachar.map((remito) => (
                <article key={remito.numero} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Remito {remito.numero}
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        Destino {getBranchName(remito.destinoId)} · {remito.totalBultos} bulto(s)
                      </p>
                    </div>
                    <Badge tone="warning">Pendiente salida</Badge>
                  </div>

                  <HoldToConfirm
                    label="Mantener para despachar remito"
                    confirmedLabel="Remito despachado"
                    icon={<ArrowRight size={18} strokeWidth={1.75} />}
                    duration={1200}
                    tone="accent"
                    onConfirm={() => onDespacharRemito(remito.numero)}
                  />
                </article>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

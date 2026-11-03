import React from "react";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "../../../components/arc/empty-state/empty-state";
import { Badge } from "../../../components/arc/badge/badge";
import { Button } from "../../../components/arc/button/button";
import { HoldToConfirm } from "../../../components/arc/hold-to-confirm/hold-to-confirm";
import styles from "../OperatorDashboardPage.module.css";

export function OperatorControlarTab({
  inTransit = [],
  pendingControl = [],
  closable = [],
  currentLocal,
  onRecibirRemito,
  onOpenRemitoControl,
  onCerrarRemito,
}) {
  const totalPendientes = inTransit.length + pendingControl.length + closable.length;

  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Control físico en sucursal</h2>
        <span className={styles.sectionCount}>
          {totalPendientes} acciones pendientes
        </span>
      </div>

      {totalPendientes === 0 ? (
        <EmptyState
          title="Sin remitos por controlar"
          description={`No hay remitos en tránsito ni bultos pendientes de verificación para ${
            currentLocal?.nombre || "esta sucursal"
          }.`}
        />
      ) : (
        <>
          {inTransit.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Remitos en viaje (pendientes de arribo)
              </h3>
              {inTransit.map((remito) => (
                <article key={remito.numero} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Remito {remito.numero}
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        {remito.totalBultos} bulto(s) en viaje hacia {currentLocal?.nombre || "la sucursal"}
                      </p>
                    </div>
                    <Badge tone="warning">En tránsito</Badge>
                  </div>

                  <Button
                    size="md"
                    onClick={() => onRecibirRemito(remito.numero)}
                  >
                    Registrar arribo físico
                  </Button>
                </article>
              ))}
            </>
          )}

          {pendingControl.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Remitos arribados (control de precintos e items)
              </h3>
              {pendingControl.map((remito) => (
                <article key={remito.numero} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Remito {remito.numero}
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        {remito.progresoOperacional?.resumenTexto ||
                          `${remito.bultosPendientes} bulto(s) por inspeccionar`}
                      </p>
                    </div>
                    <Badge tone="info">Recibido</Badge>
                  </div>

                  <Button
                    size="md"
                    onClick={() => onOpenRemitoControl(remito.numero)}
                  >
                    Controlar precintos e items
                  </Button>
                </article>
              ))}
            </>
          )}

          {closable.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Remitos inspeccionados (listos para cierre e impacto)
              </h3>
              {closable.map((remito) => (
                <article key={remito.numero} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Remito {remito.numero}
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        Todos los {remito.totalBultos} bultos fueron controlados. Listo para impactar stock y mermas.
                      </p>
                    </div>
                    <Badge tone="success">Listo para cierre</Badge>
                  </div>

                  <HoldToConfirm
                    label="Mantener para cerrar e impactar stock"
                    confirmedLabel="Remito cerrado"
                    icon={<ArrowRight size={18} strokeWidth={1.75} />}
                    duration={1200}
                    tone="accent"
                    onConfirm={() => onCerrarRemito(remito.numero)}
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

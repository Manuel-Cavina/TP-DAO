import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BottomSheet } from "../../../components/arc/bottom-sheet/bottom-sheet";
import { Button } from "../../../components/arc/button/button";
import { Badge } from "../../../components/arc/badge/badge";
import { Input } from "../../../components/arc/input/input";
import { Alert } from "../../../components/arc/alert/alert";
import { HoldToConfirm } from "../../../components/arc/hold-to-confirm/hold-to-confirm";
import styles from "../OperatorDashboardPage.module.css";

export function OperatorControlSheet({
  open,
  onOpenChange,
  activeRemitoDetalle,
  loadingRemitoDetalle,
  productoMap,
  onSaveControlBulto,
  onCerrarRemito,
}) {
  const [activeBultoForControl, setActiveBultoForControl] = useState(null);
  const [precintoLeido, setPrecintoLeido] = useState("");
  const [decisionPrecinto, setDecisionPrecinto] = useState("");
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [controlError, setControlError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectBulto = (bulto) => {
    setActiveBultoForControl(bulto);
    setPrecintoLeido("");
    setDecisionPrecinto("");
    setMotivoRechazo("");
    setControlError("");
  };

  const handleSubmit = async () => {
    if (!precintoLeido.trim()) {
      setControlError("Ingresa el código del precinto leído físicamente.");
      return;
    }
    if (!decisionPrecinto) {
      setControlError("Indica si el precinto se encuentra intacto o violado.");
      return;
    }
    if (decisionPrecinto === "VIOLADO" && !motivoRechazo.trim()) {
      setControlError("Indica el motivo de rotura o merma física.");
      return;
    }

    try {
      setIsSubmitting(true);
      setControlError("");
      await onSaveControlBulto({
        bultoId: activeBultoForControl.id,
        precintoLeido: precintoLeido.trim(),
        estaIntacto: decisionPrecinto === "INTACTO",
        motivoRechazo: decisionPrecinto === "INTACTO" ? "" : motivoRechazo.trim(),
      });
      setActiveBultoForControl(null);
    } catch (err) {
      setControlError(err.message || "Error al registrar el control del bulto");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={activeRemitoDetalle ? `Remito ${activeRemitoDetalle.numero}` : "Control de bultos"}
      description="Verificación física de precintos y recepción de items"
    >
      <div className={styles.sheetContent}>
        {loadingRemitoDetalle && (
          <p className={styles.actionCardSubtitle}>Cargando bultos…</p>
        )}

        {activeRemitoDetalle && (
          <>
            {activeBultoForControl ? (
              <div className={styles.summaryBox}>
                <h3 className={styles.actionCardTitle}>
                  Control de bulto #{activeBultoForControl.id}
                </h3>
                <p className={styles.actionCardSubtitle}>
                  Precinto registrado en origen: {activeBultoForControl.codigo_precinto || "Sin precinto"}
                </p>

                <div className={styles.itemsList}>
                  {(activeBultoForControl.detalles || []).map((det) => {
                    const prod = productoMap.get(det.producto_id);
                    return (
                      <div key={det.id || det.producto_id} className={styles.itemRow}>
                        <span>{prod?.nombre || `Producto #${det.producto_id}`}</span>
                        <span className={styles.itemQuantity}>{det.cantidad} u</span>
                      </div>
                    );
                  })}
                </div>

                <Input
                  label="Código de precinto físico leído"
                  placeholder="Ingresa el código que figura en el precinto"
                  value={precintoLeido}
                  onChange={(e) => setPrecintoLeido(e.target.value)}
                />

                <div className={styles.decisionGroup}>
                  <Button
                    size="md"
                    variant={decisionPrecinto === "INTACTO" ? "primary" : "secondary"}
                    onClick={() => setDecisionPrecinto("INTACTO")}
                  >
                    Precinto intacto
                  </Button>
                  <Button
                    size="md"
                    variant={decisionPrecinto === "VIOLADO" ? "danger" : "secondary"}
                    onClick={() => setDecisionPrecinto("VIOLADO")}
                  >
                    Violado / merma
                  </Button>
                </div>

                {decisionPrecinto === "VIOLADO" && (
                  <Input
                    label="Motivo de rechazo / merma"
                    placeholder="Ej: Precinto cortado, rotura física o caja abierta"
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                  />
                )}

                {controlError && (
                  <Alert tone="danger" title="Error en control">
                    {controlError}
                  </Alert>
                )}

                <div className={styles.sheetActions}>
                  <Button
                    size="md"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    Confirmar control de bulto
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActiveBultoForControl(null)}
                  >
                    Volver a la lista
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.actionCardTitle}>Bultos del remito</h3>
                  <span className={styles.sectionCount}>
                    {activeRemitoDetalle.bultos?.length || 0} bultos
                  </span>
                </div>

                {(activeRemitoDetalle.bultos || []).map((bulto) => (
                  <article key={bulto.id} className={styles.actionCard}>
                    <div className={styles.actionCardHeader}>
                      <div className={styles.actionCardMeta}>
                        <h4 className={styles.actionCardTitle}>
                          Bulto #{bulto.id}
                        </h4>
                        <p className={styles.actionCardSubtitle}>
                          Precinto esperado: {bulto.codigo_precinto || "Sin precinto"} · {bulto.detalles?.length || 0} renglón(es)
                        </p>
                      </div>
                      <Badge
                        tone={
                          bulto.estado === "VERIFICADO"
                            ? "success"
                            : bulto.estado === "RECHAZADO"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {bulto.estado}
                      </Badge>
                    </div>

                    {activeRemitoDetalle.estado === "RECIBIDO" &&
                      bulto.estado !== "VERIFICADO" &&
                      bulto.estado !== "RECHAZADO" && (
                        <Button
                          size="md"
                          onClick={() => handleSelectBulto(bulto)}
                        >
                          Controlar precinto e items
                        </Button>
                      )}
                  </article>
                ))}

                {activeRemitoDetalle.estado === "RECIBIDO" &&
                  (activeRemitoDetalle.bultos || []).every(
                    (b) => b.estado === "VERIFICADO" || b.estado === "RECHAZADO"
                  ) && (
                    <div className={styles.summaryBox}>
                      <h4 className={styles.actionCardTitle}>
                        Balance de impacto de stock
                      </h4>
                      <div className={styles.summaryRow}>
                        <span>Bultos intactos (a stock vendible):</span>
                        <span className={styles.summaryValSuccess}>
                          {activeRemitoDetalle.bultos.filter((b) => b.estado === "VERIFICADO").length}
                        </span>
                      </div>
                      <div className={styles.summaryRow}>
                        <span>Bultos rechazados (a merma):</span>
                        <span className={styles.summaryValDanger}>
                          {activeRemitoDetalle.bultos.filter((b) => b.estado === "RECHAZADO").length}
                        </span>
                      </div>

                      <HoldToConfirm
                        label="Mantener para cerrar e impactar stock"
                        confirmedLabel="Remito cerrado"
                        duration={1200}
                        tone="accent"
                        onConfirm={() => onCerrarRemito(activeRemitoDetalle.numero)}
                      />
                    </div>
                  )}
              </>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

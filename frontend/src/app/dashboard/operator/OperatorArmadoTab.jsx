import React, { useState } from "react";
import { Button } from "../../../components/arc/button/button";
import { Badge } from "../../../components/arc/badge/badge";
import { Input } from "../../../components/arc/input/input";
import { Alert } from "../../../components/arc/alert/alert";
import { EmptyState } from "../../../components/arc/empty-state/empty-state";
import styles from "../OperatorDashboardPage.module.css";

export function OperatorArmadoTab({
  ordenesPorEmbalar = [],
  bultosSinPrecinto = [],
  bultosPorAprobar = [],
  productoMap,
  branches = [],
  onArmarOrden,
  onPrecintarBulto,
  onAprobarBulto,
}) {
  const [precintandoBultoId, setPrecintandoBultoId] = useState(null);
  const [precintoNuevoCodigo, setPrecintoNuevoCodigo] = useState("");
  const [precintoError, setPrecintoError] = useState("");
  const [isPrecintando, setIsPrecintando] = useState(false);

  const getBranchName = (destId) => {
    const found = branches.find((b) => String(b.id) === String(destId));
    return found?.nombre || `Local #${destId}`;
  };

  const totalAccionesArmado =
    ordenesPorEmbalar.length + bultosSinPrecinto.length + bultosPorAprobar.length;

  const handleConfirmPrecinto = async (bultoId) => {
    try {
      setIsPrecintando(true);
      setPrecintoError("");
      await onPrecintarBulto(bultoId, precintoNuevoCodigo);
      setPrecintandoBultoId(null);
      setPrecintoNuevoCodigo("");
    } catch (err) {
      setPrecintoError(err.message || "No se pudo asignar el precinto al bulto.");
    } finally {
      setIsPrecintando(false);
    }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Armado y preparación</h2>
        <span className={styles.sectionCount}>
          {totalAccionesArmado} acciones pendientes
        </span>
      </div>

      {totalAccionesArmado === 0 ? (
        <EmptyState
          title="Sin armado pendiente"
          description="Todas las órdenes están empaquetadas, precintadas y aprobadas para despacho."
        />
      ) : (
        <>
          {/* 1. Órdenes con items pendientes de embalar */}
          {ordenesPorEmbalar.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Órdenes con items por embalar
              </h3>
              {ordenesPorEmbalar.map((ord) => (
                <article key={ord.id} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Orden #{ord.id}
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        Destino: {getBranchName(ord.destino_id || ord.destinoId)}
                      </p>
                    </div>
                    <Badge tone="warning">
                      {ord.restanteTotal} u por embalar
                    </Badge>
                  </div>

                  <div className={styles.itemsList}>
                    {ord.items
                      ?.filter((it) => it.restante > 0)
                      .map((it) => {
                        const prod = productoMap.get(it.productoId);
                        return (
                          <div key={it.id} className={styles.itemRow}>
                            <span>{prod?.nombre || `Producto #${it.productoId}`}</span>
                            <span className={styles.itemQuantity}>
                              {it.restante} u restantes (solicitado: {it.solicitado} u, embalado previo: {it.embalado} u)
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  <Button
                    size="md"
                    onClick={() => onArmarOrden(ord)}
                  >
                    Armar nuevo bulto
                  </Button>
                </article>
              ))}
            </>
          )}

          {/* 2. Bultos pendientes de precinto físico */}
          {bultosSinPrecinto.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Bultos pendientes de precinto físico
              </h3>
              {bultosSinPrecinto.map((bulto) => (
                <article key={bulto.id} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Bulto #{bulto.id} (Orden #{bulto.ordenId})
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        Destino: {getBranchName(bulto.destinoId)} · {bulto.detalles?.length || 0} producto(s)
                      </p>
                    </div>
                    <Badge tone="warning">Sin precinto</Badge>
                  </div>

                  <div className={styles.itemsList}>
                    {(bulto.detalles || []).map((det) => {
                      const prod = productoMap.get(det.productoId || det.producto_id);
                      return (
                        <div key={det.id || det.productoId || det.producto_id} className={styles.itemRow}>
                          <span>{prod?.nombre || `Item #${det.productoId || det.producto_id}`}</span>
                          <span className={styles.itemQuantity}>{det.cantidad} u</span>
                        </div>
                      );
                    })}
                  </div>

                  {precintandoBultoId === bulto.id ? (
                    <div className={styles.formRow}>
                      <Input
                        label="Código de precinto físico"
                        placeholder="Ej: PREC-1234"
                        value={precintoNuevoCodigo}
                        onChange={(e) => {
                          setPrecintoNuevoCodigo(e.target.value);
                          if (precintoError) setPrecintoError("");
                        }}
                      />
                      {precintoError && (
                        <Alert tone="danger" title="Error al precintar">
                          {precintoError}
                        </Alert>
                      )}
                      <Button
                        size="md"
                        onClick={() => handleConfirmPrecinto(bulto.id)}
                        disabled={isPrecintando}
                      >
                        Guardar precinto
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPrecintandoBultoId(null);
                          setPrecintoNuevoCodigo("");
                          setPrecintoError("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => {
                        setPrecintandoBultoId(bulto.id);
                        setPrecintoNuevoCodigo("");
                        setPrecintoError("");
                      }}
                    >
                      Colocar precinto físico
                    </Button>
                  )}
                </article>
              ))}
            </>
          )}

          {/* 3. Bultos precintados pendientes de aprobación */}
          {bultosPorAprobar.length > 0 && (
            <>
              <h3 className={styles.subSectionTitle}>
                Bultos precintados pendientes de aprobación
              </h3>
              {bultosPorAprobar.map((bulto) => (
                <article key={bulto.id} className={styles.actionCard}>
                  <div className={styles.actionCardHeader}>
                    <div className={styles.actionCardMeta}>
                      <h4 className={styles.actionCardTitle}>
                        Bulto #{bulto.id} (Orden #{bulto.ordenId})
                      </h4>
                      <p className={styles.actionCardSubtitle}>
                        Precinto: {bulto.codigoPrecinto || bulto.codigo_precinto} · Destino: {getBranchName(bulto.destinoId)}
                      </p>
                    </div>
                    <Badge tone="info">Precintado</Badge>
                  </div>

                  <div className={styles.itemsList}>
                    {(bulto.detalles || []).map((det) => {
                      const prod = productoMap.get(det.productoId || det.producto_id);
                      return (
                        <div key={det.id || det.productoId || det.producto_id} className={styles.itemRow}>
                          <span>{prod?.nombre || `Item #${det.productoId || det.producto_id}`}</span>
                          <span className={styles.itemQuantity}>{det.cantidad} u</span>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    size="md"
                    onClick={() => onAprobarBulto(bulto.id)}
                  >
                    Aprobar bulto para despacho
                  </Button>
                </article>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

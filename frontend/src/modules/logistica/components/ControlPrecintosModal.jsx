import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/feedback/ToastContext";
import { logisticaService } from "../services";
import { createSealControlRows, validateSealControl } from "../mappers/sealControl";

export function ControlPrecintosModal({ remito, bultos, open, onClose, onSuccess, disabled = false }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  useEffect(() => {
    if (open) {
      setRows(createSealControlRows(bultos));
      setGeneralError("");
    }
  }, [open, remito?.numero]);

  const updateRow = (index, patch) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch, error: "" };
      return next;
    });
  };

  const totals = useMemo(() => {
    let conformes = 0;
    let rechazados = 0;
    for (const r of rows) {
      if (!r.resultado || !r.precintoLeido.trim()) continue;
      const discrepancia =
        r.precintoEsperado && r.precintoLeido.trim() !== r.precintoEsperado.trim();
      if (r.resultado === "VIOLADO" || discrepancia) {
        rechazados += 1;
      } else {
        conformes += 1;
      }
    }
    return { conformes, rechazados, total: rows.length };
  }, [rows]);

  const handleConfirmar = async () => {
    if (disabled || submitting) return;
    let hasError = false;
    const validatedRows = rows.map((row) => {
      const rowError = validateSealControl(row).error;
      if (rowError) hasError = true;
      return { ...row, error: rowError };
    });

    setRows(validatedRows);
    if (hasError || validatedRows.length === 0) {
      setGeneralError("Revise las filas marcadas con error antes de confirmar.");
      return;
    }

    setSubmitting(true);
    setGeneralError("");

    try {
      const payloadItems = validatedRows.map((r) => ({
        bulto_id: r.bultoId,
        version: r.version || 1,
        codigo_esperado: r.precintoEsperado,
        codigo_leido: r.precintoLeido.trim(),
        resultado: validateSealControl(r).resultado,
        motivo_rechazo: r.motivoRechazo.trim(),
      }));

      await logisticaService.controlarBultosBatch(remito.numero, { items: payloadItems });
      toast(`Control registrado para ${validatedRows.length} bultos del remito ${remito.numero}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      setGeneralError(err?.message || "Error al registrar el control por lote de precintos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Control de precintos por lote"
      subtitle={`Remito ${remito?.numero || ""} · ${rows.length} bulto(s) en revisión`}
      footer={
        <div className="row justify-between w-full align-center">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmar}
            loading={submitting}
            disabled={disabled || submitting || rows.length === 0}
            loadingLabel="Confirmando control..."
          >
            Confirmar control de precintos
          </Button>
        </div>
      }
    >
      <div className="stack gap-4">
        {generalError && (
          <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
            {generalError}
          </div>
        )}

        <div className="card p-3 bg-surface-muted row justify-between align-center wrap gap-2 text-sm">
          <div>
            <span className="text-muted block text-xs">Total bultos</span>
            <span className="font-medium text-md">{totals.total}</span>
          </div>
          <div>
            <span className="text-muted block text-xs">Conformes (Intacto)</span>
            <span className="font-medium text-md text-success">{totals.conformes}</span>
          </div>
          <div>
            <span className="text-muted block text-xs">Con rechazo / violados</span>
            <span className="font-medium text-md text-danger">{totals.rechazados}</span>
          </div>
        </div>

        <p className="text-xs text-secondary">
          Revise la faja de seguridad física de cada bulto. Si el código difiere o el precinto
          está dañado, registre el motivo para documentar la merma formal.
        </p>

        <div className="stack gap-3">
          {rows.map((row, idx) => {
            const discrepancia =
              row.precintoLeido.trim() && row.precintoEsperado &&
              row.precintoLeido.trim() !== row.precintoEsperado.trim();
            const esRechazo = row.resultado === "VIOLADO" || discrepancia;

            return (
              <div
                key={row.bultoId}
                className={`card p-3 stack gap-2 border ${
                  row.error ? "border-danger" : esRechazo ? "border-warning" : "border-muted"
                }`}
              >
                <div className="row justify-between align-center wrap gap-2">
                  <div>
                    <span className="font-mono font-medium text-sm block">
                      {row.codigoBulto}
                    </span>
                    <span className="text-xs text-muted">
                      Esperado: <strong className="font-mono">{row.precintoEsperado || "(sin código)"}</strong>
                    </span>
                  </div>

                  <div className="row gap-2 align-center">
                    <Button
                      size="sm"
                      aria-pressed={row.resultado === "INTACTO"}
                      variant={row.resultado === "INTACTO" && !discrepancia ? "success" : "ghost"}
                      onClick={() => updateRow(idx, { resultado: "INTACTO" })}
                    >
                      Intacto
                    </Button>
                    <Button
                      size="sm"
                      aria-pressed={row.resultado === "VIOLADO"}
                      variant={esRechazo ? "danger" : "ghost"}
                      onClick={() => updateRow(idx, { resultado: "VIOLADO" })}
                    >
                      Violado
                    </Button>
                  </div>
                </div>

                <div className="row gap-3 wrap align-center">
                  <div className="flex-1 min-w-48">
                    <label htmlFor={`seal-read-${row.bultoId}`} className="text-xs text-muted block mb-1">
                      Código leído en precinto
                    </label>
                    <input
                      id={`seal-read-${row.bultoId}`}
                      required
                      aria-invalid={Boolean(row.error)}
                      aria-describedby={row.error ? `seal-error-${row.bultoId}` : undefined}
                      className="input font-mono text-sm w-full"
                      value={row.precintoLeido}
                      onChange={(e) => updateRow(idx, { precintoLeido: e.target.value })}
                      placeholder="Código físico del precinto"
                    />
                  </div>
                </div>

                {discrepancia && (
                  <span className="text-xs text-warning">
                    Aviso: El código leído no coincide con el registrado en el remito.
                  </span>
                )}

                {esRechazo && (
                  <div className="stack gap-1">
                    <label htmlFor={`seal-reason-${row.bultoId}`} className="text-xs text-danger font-medium block">
                      Motivo de rechazo (obligatorio para merma)
                    </label>
                    <input
                      id={`seal-reason-${row.bultoId}`}
                      required
                      aria-invalid={Boolean(row.error)}
                      aria-describedby={row.error ? `seal-error-${row.bultoId}` : undefined}
                      className="input text-sm w-full"
                      value={row.motivoRechazo}
                      onChange={(e) => updateRow(idx, { motivoRechazo: e.target.value })}
                      placeholder="p. ej. Precinto cortado, roto o código adulterado"
                      maxLength={250}
                    />
                  </div>
                )}

                {row.error && (
                  <span id={`seal-error-${row.bultoId}`} role="alert" className="text-xs text-danger font-medium">{row.error}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export default ControlPrecintosModal;

import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/feedback/ToastContext";
import { logisticaService } from "../services";

export function ControlPrecintosModal({ remito, bultos, open, onClose, onSuccess }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  useEffect(() => {
    if (open && bultos && bultos.length > 0) {
      setRows(
        bultos.map((b) => ({
          bultoId: b.id,
          version: b.version || 1,
          codigoBulto: b.codigo || `BLT-${String(b.id).padStart(4, "0")}`,
          precintoEsperado: b.codigoPrecinto || "",
          precintoLeido: b.codigoPrecinto || "",
          resultado: "INTACTO",
          motivoRechazo: "",
          error: "",
        }))
      );
      setGeneralError("");
    }
  }, [open, bultos]);

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
    let hasError = false;
    const validatedRows = rows.map((row) => {
      let rowError = "";
      const readTrimmed = row.precintoLeido.trim();
      if (!readTrimmed) {
        rowError = "Ingrese el código de precinto leído.";
      } else {
        const discrepancia =
          row.precintoEsperado && readTrimmed !== row.precintoEsperado.trim();
        const requiereMotivo = row.resultado === "VIOLADO" || discrepancia;
        if (requiereMotivo && !row.motivoRechazo.trim()) {
          rowError = "Motivo de rechazo obligatorio al marcar violado o código discrepante.";
        }
      }
      if (rowError) hasError = true;
      return { ...row, error: rowError };
    });

    setRows(validatedRows);
    if (hasError) {
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
        resultado: r.resultado,
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
              row.precintoEsperado &&
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
                      variant={row.resultado === "INTACTO" && !discrepancia ? "success" : "ghost"}
                      onClick={() => updateRow(idx, { resultado: "INTACTO" })}
                    >
                      Intacto
                    </Button>
                    <Button
                      size="sm"
                      variant={esRechazo ? "danger" : "ghost"}
                      onClick={() => updateRow(idx, { resultado: "VIOLADO" })}
                    >
                      Violado
                    </Button>
                  </div>
                </div>

                <div className="row gap-3 wrap align-center">
                  <div className="flex-1 min-w-48">
                    <label className="text-xs text-muted block mb-1">
                      Código leído en precinto
                    </label>
                    <input
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
                    <label className="text-xs text-danger font-medium block">
                      Motivo de rechazo (obligatorio para merma)
                    </label>
                    <input
                      className="input text-sm w-full"
                      value={row.motivoRechazo}
                      onChange={(e) => updateRow(idx, { motivoRechazo: e.target.value })}
                      placeholder="p. ej. Precinto cortado, roto o código adulterado"
                      maxLength={250}
                    />
                  </div>
                )}

                {row.error && (
                  <span className="text-xs text-danger font-medium">{row.error}</span>
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

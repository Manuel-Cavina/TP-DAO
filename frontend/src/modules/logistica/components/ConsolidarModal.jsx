import React, { useState } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { StatusBadge } from "../../../shared/components/Badge";

/**
 * ConsolidarModal:
 * - Modo Remito (US4): Revision de bultos precintados restringidos a una unica orden antes de emitir remito.
 * - Modo Orden (US3 compatibilidad): Consolidacion de necesidades pendientes en orden de reposicion.
 */
export function ConsolidarModal({
  open,
  onClose,
  orden = null,
  bultos = [],
  locales = [],
  cdId,
  onSubmit,
  pending = false,
}) {
  const isRemitoMode = Boolean(orden);

  // Estado para modo remito
  const [numeroRemito, setNumeroRemito] = useState("");
  const [remitoError, setRemitoError] = useState("");

  // Estado para modo consolidar orden
  const [localDestinoId, setLocalDestinoId] = useState("");

  const localOptions = locales
    .filter((l) => l.tipo === "LOCAL")
    .map((l) => ({ value: String(l.id), label: l.nombre }));

  const handleSubmitRemito = async (e) => {
    e?.preventDefault();
    if (!numeroRemito.trim()) {
      setRemitoError("Debe ingresar un numero de remito formal.");
      return;
    }
    setRemitoError("");

    // Validar que todos los bultos pertenecen a la orden y estan precintados
    const invalidos = bultos.filter((b) => b.estado !== "PRECINTADO");
    if (invalidos.length > 0) {
      setRemitoError("Todos los bultos a remitir deben estar precintados.");
      return;
    }

    const bultosIds = bultos.map((b) => b.id);
    const res = await onSubmit({
      ordenId: orden.id,
      numero: numeroRemito.trim(),
      bultosIds,
    });
    if (res?.ok) {
      setNumeroRemito("");
      onClose();
    }
  };

  const handleSubmitOrden = async (e) => {
    e?.preventDefault();
    const destId = Number(localDestinoId || localOptions[0]?.value);
    if (!destId) return;

    const res = await onSubmit({ localDestinoId: destId, origenId: Number(cdId || 1) });
    if (res?.ok) onClose();
  };

  if (isRemitoMode) {
    const totalItems = bultos.reduce(
      (sum, b) => sum + (b.detalles?.reduce((s, d) => s + (d.cantidad || 0), 0) || 0),
      0
    );

    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Generar remito de despacho"
        subtitle={`Revision formal de bultos restringidos a la Orden #${orden.id}`}
        footer={
          <div className="row justify-between w-full">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitRemito}
              loading={pending}
              loadingLabel="Generando remito..."
              disabled={bultos.length === 0}
            >
              Confirmar emision de remito
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitRemito} className="stack gap-4">
          <div className="erp-callout">
            <span className="text-sm text-secondary">
              Regla de trazabilidad: Este remito incluye exclusivamente los bultos
              precintados correspondientes a la Orden #{orden.id}. No es posible combinar
              bultos de diferentes ordenes o destinos.
            </span>
          </div>

          <div className="grid-2 gap-3">
            <div className="stack gap-1">
              <span className="text-xs text-muted">Origen (CD)</span>
              <span className="text-sm font-medium">Sede #{orden.origenId}</span>
            </div>
            <div className="stack gap-1">
              <span className="text-xs text-muted">Destino (Local)</span>
              <span className="text-sm font-medium">Sede #{orden.destinoId}</span>
            </div>
          </div>

          <FormField
            label="Numero de remito formal"
            required
            hint="Identificador unico del documento legal de transporte"
            error={remitoError}
          >
            <TextInput
              mono
              value={numeroRemito}
              onChange={(e) => setNumeroRemito(e.target.value)}
              placeholder="p. ej. REM-2026-0042"
              required
            />
          </FormField>

          <div className="stack gap-2">
            <div className="row justify-between align-center">
              <span className="text-xs text-muted">
                Bultos a incluir ({bultos.length} bultos · {totalItems} unidades)
              </span>
            </div>

            <div className="stack gap-2 max-h-48 overflow-y-auto">
              {bultos.map((b) => (
                <div key={b.id} className="row justify-between align-center p-2 rounded bg-surface-muted">
                  <div className="row gap-2 align-center">
                    <span className="font-mono text-sm">Bulto #{b.id}</span>
                    <span className="text-xs text-secondary">
                      Precinto: <strong className="font-mono">{b.codigoPrecinto || "Sin asignar"}</strong>
                    </span>
                  </div>
                  <StatusBadge status={b.estado} />
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Consolidar Orden de Reposición"
      subtitle="Agrupa todas las necesidades pendientes para el local seleccionado en una orden formal."
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmitOrden} loading={pending} loadingLabel="Consolidando...">
            Generar orden formal
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmitOrden} className="stack gap-4">
        <FormField
          label="Local comercial de destino"
          required
          hint="Se consolidaran todas las necesidades pendientes registradas hacia este local."
        >
          <Select
            options={localOptions}
            value={localDestinoId ? String(localDestinoId) : (localOptions[0]?.value || "")}
            onChange={setLocalDestinoId}
            placeholder="Seleccionar sucursal"
          />
        </FormField>
      </form>
    </Modal>
  );
}

export default ConsolidarModal;

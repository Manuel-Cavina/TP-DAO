import React, { useState, useMemo } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { StatusBadge } from "../../../shared/components/Badge";

/**
 * ConsolidarModal (T048 / US4):
 * - Modo Remito Unico Completo: Revision completa de la orden (origen, destino,
 *   todos los bultos aprobados y cantidades completas) para emitir el remito unico.
 *   Removida cualquier seleccion de subconjuntos de bultos (FR-021).
 * - Modo Orden: Consolidacion de necesidades pendientes (US3).
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

  const localOptions = useMemo(
    () =>
      locales
        .filter((l) => l.tipo === "LOCAL")
        .map((l) => ({ value: String(l.id), label: l.nombre })),
    [locales]
  );

  // Verificacion de remito unico completo (FR-021, FR-041)
  const { totalUnidadesOrden, totalUnidadesEmpaquetadas, bloqueadoresRemito } = useMemo(() => {
    if (!orden) return { totalUnidadesOrden: 0, totalUnidadesEmpaquetadas: 0, bloqueadoresRemito: [] };

    const bloqueadores = [];
    const totalSol = (orden.detalles || []).reduce((sum, d) => sum + (d.cantidadSolicitada || 0), 0);
    const totalEmp = bultos.reduce(
      (sum, b) => sum + (b.detalles?.reduce((s, d) => s + (d.cantidad || 0), 0) || 0),
      0
    );

    if (bultos.length === 0) {
      bloqueadores.push("La orden no posee ningún bulto armado.");
    }

    if (totalEmp < totalSol) {
      bloqueadores.push(`Faltan ${totalSol - totalEmp} unidades por empaquetar de las ${totalSol} solicitadas.`);
    }

    const bultosSinPrecinto = bultos.filter((b) => b.estado !== "PRECINTADO" || !b.codigoPrecinto);
    if (bultosSinPrecinto.length > 0) {
      bloqueadores.push(`Existen ${bultosSinPrecinto.length} bulto(s) sin precinto de seguridad.`);
    }

    return {
      totalUnidadesOrden: totalSol,
      totalUnidadesEmpaquetadas: totalEmp,
      bloqueadoresRemito: bloqueadores,
    };
  }, [orden, bultos]);

  const handleSubmitRemito = async (e) => {
    e?.preventDefault();
    if (!numeroRemito.trim()) {
      setRemitoError("Debe ingresar un número de remito formal.");
      return;
    }

    if (bloqueadoresRemito.length > 0) {
      setRemitoError("No se puede emitir el remito: existen bloqueadores pendientes.");
      return;
    }

    setRemitoError("");
    // Se envian todos los bultos de la orden; no se permite remito parcial
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
    const ordenCompleta = bloqueadoresRemito.length === 0;

    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Emitir remito único completo"
        subtitle={`Revisión formal de la totalidad de la Orden #${orden.id} (FR-021)`}
        footer={
          <div className="row justify-between w-full">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitRemito}
              loading={pending}
              loadingLabel="Emitiendo remito..."
              disabled={!ordenCompleta || !numeroRemito.trim()}
            >
              Confirmar remito único
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitRemito} className="stack gap-4">
          <div className="erp-callout">
            <span className="text-sm text-secondary">
              Remito único completo (FR-021): Este documento ampara el 100% de los
              bultos y mercadería de la Orden #{orden.id}. No se permite remisión
              parcial ni selección de subconjuntos de bultos.
            </span>
          </div>

          {/* Bloqueadores si los hay */}
          {bloqueadoresRemito.length > 0 && (
            <div className="p-3 rounded bg-danger-subtle text-danger text-sm stack gap-1">
              <strong className="block">Emisión bloqueada:</strong>
              {bloqueadoresRemito.map((b, idx) => (
                <span key={idx}>· {b}</span>
              ))}
            </div>
          )}

          {/* Ruta y cantidades */}
          <div className="grid-3 gap-3">
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Centro Distribución (Origen)</span>
              <span className="text-sm font-medium">Sede #{orden.origenId}</span>
            </div>
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Sucursal (Destino)</span>
              <span className="text-sm font-medium">Sede #{orden.destinoId}</span>
            </div>
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Unidades totales</span>
              <span className="text-sm font-medium tabular-nums">
                {totalUnidadesEmpaquetadas} / {totalUnidadesOrden} u.
              </span>
            </div>
          </div>

          <FormField
            label="Número de remito formal"
            required
            hint="Identificador legal único del traslado físico"
            error={remitoError}
          >
            <TextInput
              mono
              value={numeroRemito}
              onChange={(e) => setNumeroRemito(e.target.value)}
              placeholder="p. ej. REM-2026-0042"
              required
              disabled={pending}
            />
          </FormField>

          {/* Revision de todos los bultos incluidos */}
          <div className="stack gap-2">
            <div className="row justify-between align-center">
              <span className="text-xs text-muted font-medium">
                TODOS LOS BULTOS DE LA ORDEN ({bultos.length} BULTOS · {totalUnidadesEmpaquetadas} U.)
              </span>
            </div>

            <div className="stack gap-2 max-h-48 overflow-y-auto">
              {bultos.map((b) => {
                const totalUnits = (b.detalles || []).reduce(
                  (sum, d) => sum + (d.cantidad || 0),
                  0
                );
                return (
                  <div
                    key={b.id}
                    className="row justify-between align-center p-2 rounded bg-surface-muted"
                  >
                    <div className="row gap-2 align-center">
                      <span className="font-mono text-sm font-medium">Bulto #{b.id}</span>
                      <span className="text-xs text-secondary">
                        Precinto: <strong className="font-mono">{b.codigoPrecinto || "Sin asignar"}</strong>
                      </span>
                      <span className="text-xs text-secondary">
                        ({totalUnits} u.)
                      </span>
                    </div>
                    <StatusBadge status={b.estado} />
                  </div>
                );
              })}
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
          <Button
            variant="primary"
            onClick={handleSubmitOrden}
            loading={pending}
            loadingLabel="Consolidando..."
          >
            Generar orden formal
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmitOrden} className="stack gap-4">
        <FormField
          label="Local comercial de destino"
          required
          hint="Se consolidarán todas las necesidades pendientes hacia este local."
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

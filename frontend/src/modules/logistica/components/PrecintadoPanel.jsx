import React, { useState, useMemo } from "react";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";
import { FormField, TextInput } from "../../../shared/components/FormControls";

/**
 * PrecintadoPanel (T046 / US4):
 * Soporte para precintado individual y por lote revisado asignando
 * codigo de precinto unico por bulto y validando duplicados.
 */
export function PrecintadoPanel({
  bultos = [],
  onPrecintarIndividual,
  onPrecintarLote,
  loading = false,
}) {
  const [activeTab, setActiveTab] = useState("individual"); // "individual" | "lote"

  // Estado para precintado individual: { [bultoId]: codigoPrecinto }
  const [individualInputs, setIndividualInputs] = useState({});
  const [individualLoadingId, setIndividualLoadingId] = useState(null);
  const [individualError, setIndividualError] = useState("");

  // Estado para precintado en lote: { [bultoId]: codigoPrecinto }
  const [loteInputs, setLoteInputs] = useState({});
  const [loteErrors, setLoteErrors] = useState({});
  const [loteGlobalError, setLoteGlobalError] = useState("");
  const [loteLoading, setLoteLoading] = useState(false);

  // Filtrar bultos pendientes de precinto (estado PREPARADO o sin precinto)
  const bultosPendientes = useMemo(() => {
    return bultos.filter(
      (b) => b.estado === "PREPARADO" || (!b.codigoPrecinto && b.estado !== "PRECINTADO")
    );
  }, [bultos]);

  // Codigos de precinto ya utilizados en bultos precintados de la orden
  const precintosYaUsados = useMemo(() => {
    const set = new Set();
    bultos.forEach((b) => {
      if (b.codigoPrecinto) set.add(b.codigoPrecinto.trim().toUpperCase());
    });
    return set;
  }, [bultos]);

  // Manejar precintado individual
  const handlePrecintarUno = async (bultoId) => {
    setIndividualError("");
    const codigo = (individualInputs[bultoId] || "").trim().toUpperCase();
    if (!codigo) {
      setIndividualError(`Debe ingresar un codigo de precinto para el bulto #${bultoId}.`);
      return;
    }

    if (precintosYaUsados.has(codigo)) {
      setIndividualError(`El precinto '${codigo}' ya esta asignado a otro bulto.`);
      return;
    }

    setIndividualLoadingId(bultoId);
    try {
      await onPrecintarIndividual(bultoId, codigo);
      setIndividualInputs((prev) => {
        const next = { ...prev };
        delete next[bultoId];
        return next;
      });
    } catch (err) {
      setIndividualError(err.message || "Error al precintar el bulto.");
    } finally {
      setIndividualLoadingId(null);
    }
  };

  // Validar entradas de lote
  const validarLote = () => {
    const errors = {};
    let globalErr = "";
    const codigosVistos = new Map();

    bultosPendientes.forEach((b) => {
      const codigo = (loteInputs[b.id] || "").trim().toUpperCase();
      if (!codigo) {
        errors[b.id] = "Precinto requerido";
      } else if (precintosYaUsados.has(codigo)) {
        errors[b.id] = "Ya utilizado en otro bulto";
        globalErr = "Uno o mas codigos ya fueron utilizados previamente.";
      } else if (codigosVistos.has(codigo)) {
        errors[b.id] = "Codigo duplicado en este lote";
        errors[codigosVistos.get(codigo)] = "Codigo duplicado en este lote";
        globalErr = "Los codigos de precinto deben ser unicos para cada bulto.";
      } else {
        codigosVistos.set(codigo, b.id);
      }
    });

    setLoteErrors(errors);
    setLoteGlobalError(globalErr);
    return Object.keys(errors).length === 0;
  };

  // Manejar precintado en lote revisado
  const handlePrecintarLoteSubmit = async (e) => {
    e.preventDefault();
    if (!validarLote()) return;

    const asignaciones = bultosPendientes.map((b) => ({
      bultoId: b.id,
      codigoPrecinto: (loteInputs[b.id] || "").trim().toUpperCase(),
    }));

    setLoteLoading(true);
    setLoteGlobalError("");
    try {
      await onPrecintarLote(asignaciones);
      setLoteInputs({});
      setLoteErrors({});
    } catch (err) {
      setLoteGlobalError(err.message || "Error al precintar el lote.");
    } finally {
      setLoteLoading(false);
    }
  };

  if (bultosPendientes.length === 0) {
    return (
      <div className="card p-4 stack gap-2 bg-surface-muted text-center">
        <span className="text-sm font-medium text-success">
          Todos los bultos de esta orden estan precintados
        </span>
        <span className="text-xs text-secondary">
          No hay bultos en estado PREPARADO pendientes de precinto de seguridad.
        </span>
      </div>
    );
  }

  return (
    <div className="card p-4 stack gap-4">
      <div className="row justify-between align-center wrap gap-2">
        <div>
          <h3 className="text-md font-medium">Asignación de precintos de seguridad</h3>
          <span className="text-xs text-secondary">
            {bultosPendientes.length} bulto(s) en preparación pendiente(s) de precinto
          </span>
        </div>

        {/* Toggle entre modo individual y por lote */}
        <div className="row gap-1 bg-surface-muted p-1 rounded">
          <Button
            size="sm"
            variant={activeTab === "individual" ? "primary" : "ghost"}
            onClick={() => setActiveTab("individual")}
          >
            Individual
          </Button>
          <Button
            size="sm"
            variant={activeTab === "lote" ? "primary" : "ghost"}
            onClick={() => setActiveTab("lote")}
          >
            Por lote ({bultosPendientes.length})
          </Button>
        </div>
      </div>

      {/* Modo individual */}
      {activeTab === "individual" && (
        <div className="stack gap-3">
          {individualError && (
            <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
              {individualError}
            </div>
          )}

          <div className="stack gap-2">
            {bultosPendientes.map((b) => {
              const totalUnits = (b.detalles || []).reduce(
                (sum, d) => sum + (d.cantidad || 0),
                0
              );
              return (
                <div
                  key={b.id}
                  className="row justify-between align-center p-3 rounded bg-surface-muted wrap gap-2"
                >
                  <div className="stack gap-1">
                    <div className="row gap-2 align-center">
                      <span className="font-mono text-sm font-medium">Bulto #{b.id}</span>
                      <StatusBadge status={b.estado} />
                    </div>
                    <span className="text-xs text-secondary">
                      Contiene {b.detalles?.length || 0} artículo(s) · {totalUnits} u. en total
                    </span>
                  </div>

                  <div className="row gap-2 align-center">
                    <TextInput
                      size="sm"
                      mono
                      placeholder="Código precinto (ej. PR-8821)"
                      value={individualInputs[b.id] || ""}
                      onChange={(e) =>
                        setIndividualInputs((prev) => ({
                          ...prev,
                          [b.id]: e.target.value,
                        }))
                      }
                      disabled={loading || individualLoadingId === b.id}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={individualLoadingId === b.id}
                      onClick={() => handlePrecintarUno(b.id)}
                      disabled={loading}
                    >
                      Precintar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modo por lote revisado */}
      {activeTab === "lote" && (
        <form onSubmit={handlePrecintarLoteSubmit} className="stack gap-3">
          <div className="erp-callout">
            <span className="text-sm text-secondary">
              Precintado en lote revisado: asigne un código de precinto único a cada uno
              de los bultos en preparación. Ningún código puede repetirse ni haber sido
              utilizado previamente.
            </span>
          </div>

          {loteGlobalError && (
            <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
              {loteGlobalError}
            </div>
          )}

          <div className="stack gap-2 max-h-72 overflow-y-auto">
            {bultosPendientes.map((b) => {
              const totalUnits = (b.detalles || []).reduce(
                (sum, d) => sum + (d.cantidad || 0),
                0
              );
              const err = loteErrors[b.id];
              return (
                <div
                  key={b.id}
                  className="row justify-between align-center p-3 rounded bg-surface-muted gap-3"
                >
                  <div className="stack gap-1 min-w-40">
                    <span className="font-mono text-sm font-medium">Bulto #{b.id}</span>
                    <span className="text-xs text-secondary">
                      {totalUnits} u. en {b.detalles?.length || 0} línea(s)
                    </span>
                  </div>

                  <div className="flex-1">
                    <FormField error={err}>
                      <TextInput
                        size="sm"
                        mono
                        placeholder="Código precinto"
                        value={loteInputs[b.id] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLoteInputs((prev) => ({ ...prev, [b.id]: val }));
                          if (loteErrors[b.id]) {
                            setLoteErrors((prev) => {
                              const n = { ...prev };
                              delete n[b.id];
                              return n;
                            });
                          }
                        }}
                        disabled={loteLoading || loading}
                      />
                    </FormField>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row justify-end pt-2 border-t">
            <Button
              variant="secondary"
              type="submit"
              loading={loteLoading}
              loadingLabel="Precintando lote..."
              disabled={loading || bultosPendientes.length === 0}
            >
              Confirmar precintado en lote ({bultosPendientes.length} bultos)
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default PrecintadoPanel;

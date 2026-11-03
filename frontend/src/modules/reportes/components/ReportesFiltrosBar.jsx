import React from "react";
import { Button } from "../../../shared/components/Button";
import { Switch } from "../../../shared/components/Switch";
import { Badge } from "../../../shared/components/Badge";
import { Icon } from "../../../shared/components/Icon";

export function ReportesFiltrosBar({
  reportKey,
  draftParams,
  setDraftParams,
  onApplyPreset,
  activePreset,
  locations,
  categories,
  onGenerate,
  onReset,
  loading,
  isDirty,
  hasInvalidRange,
}) {
  const isStock = reportKey === "stock";
  const isProductos = reportKey === "productos";

  const handleDesdeChange = (e) => {
    setDraftParams((prev) => ({ ...prev, desde: e.target.value }));
  };

  const handleHastaChange = (e) => {
    setDraftParams((prev) => ({ ...prev, hasta: e.target.value }));
  };

  const handleLocalChange = (e) => {
    setDraftParams((prev) => ({ ...prev, localId: e.target.value }));
  };

  const handleUbicacionChange = (e) => {
    setDraftParams((prev) => ({ ...prev, ubicacionId: e.target.value }));
  };

  const handleCategoriaChange = (e) => {
    setDraftParams((prev) => ({ ...prev, categoriaId: e.target.value }));
  };

  const handleSoloBajoMinimoChange = (checked) => {
    setDraftParams((prev) => ({ ...prev, soloBajoMinimo: checked }));
  };

  const handleTopChange = (e) => {
    setDraftParams((prev) => ({ ...prev, top: Number(e.target.value) }));
  };

  return (
    <section className="stocky-toolbar-card" aria-label="Parámetros y filtros del reporte">
      <div className="stack gap-3">
        {/* Fila 1: Presets temporales y controles de fecha (para reportes con rango) */}
        {!isStock && (
          <div className="row wrap align-center justify-between gap-3">
            <div className="row wrap align-center gap-2">
              <span className="text-xs text-secondary font-medium">Período:</span>
              <div className="row wrap align-center gap-1" role="group" aria-label="Presets de fecha">
                <Button
                  variant={activePreset === "30d" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => onApplyPreset("30d")}
                >
                  Últimos 30 días
                </Button>
                <Button
                  variant={activePreset === "7d" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => onApplyPreset("7d")}
                >
                  Últimos 7 días
                </Button>
                <Button
                  variant={activePreset === "mes" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => onApplyPreset("mes")}
                >
                  Este mes
                </Button>
                <Button
                  variant={activePreset === "anio" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => onApplyPreset("anio")}
                >
                  Año en curso
                </Button>
              </div>
            </div>

            <div className="row wrap align-center gap-2">
              <label className="row align-center gap-1 text-xs text-secondary font-medium">
                <span>Desde:</span>
                <input
                  type="date"
                  aria-label="Fecha inicial del período"
                  className="erp-input erp-input--sm"
                  value={draftParams.desde || ""}
                  onChange={handleDesdeChange}
                  max={draftParams.hasta || undefined}
                />
              </label>

              <label className="row align-center gap-1 text-xs text-secondary font-medium">
                <span>Hasta:</span>
                <input
                  type="date"
                  aria-label="Fecha final del período"
                  className="erp-input erp-input--sm"
                  value={draftParams.hasta || ""}
                  onChange={handleHastaChange}
                  min={draftParams.desde || undefined}
                />
              </label>
            </div>
          </div>
        )}

        {/* Fila 2: Sedes, categorías y filtros contextuales */}
        <div className="stocky-filter-row pt-2 border-t border-subtle">
          <div className="row wrap align-center justify-between gap-3">
            <div className="row wrap align-center gap-3">
              {/* Selector de sede / local */}
              {!isStock ? (
                <label className="row align-center gap-2 text-xs text-secondary font-medium">
                  <span>Sede:</span>
                  <select
                    className="erp-input erp-input--sm stocky-filter-select"
                    aria-label="Filtrar por sede o local"
                    value={draftParams.localId || ""}
                    onChange={handleLocalChange}
                  >
                    <option value="">Todas las sedes (Red completa)</option>
                    {locations
                      .filter((loc) => loc.tipo === "LOCAL")
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.nombre}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className="row align-center gap-2 text-xs text-secondary font-medium">
                  <span>Ubicación:</span>
                  <select
                    className="erp-input erp-input--sm stocky-filter-select"
                    aria-label="Filtrar por ubicación o centro"
                    value={draftParams.ubicacionId || ""}
                    onChange={handleUbicacionChange}
                  >
                    <option value="">Todas las ubicaciones</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.tipo === "CD" ? "CD" : "Local"} - {loc.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Filtro de Categoría para Stock */}
              {isStock && (
                <label className="row align-center gap-2 text-xs text-secondary font-medium">
                  <span>Categoría:</span>
                  <select
                    className="erp-input erp-input--sm stocky-filter-select"
                    aria-label="Filtrar por categoría de producto"
                    value={draftParams.categoriaId || ""}
                    onChange={handleCategoriaChange}
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Toggle Solo bajo mínimo para Stock */}
              {isStock && (
                <label className="row align-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={draftParams.soloBajoMinimo || false}
                    onChange={handleSoloBajoMinimoChange}
                    ariaLabel="Mostrar solo productos bajo mínimo"
                  />
                  <span className="text-danger font-medium">Solo bajo mínimo (Observer)</span>
                </label>
              )}

              {/* Selector Top N para Productos más vendidos */}
              {isProductos && (
                <label className="row align-center gap-2 text-xs text-secondary font-medium">
                  <span>Ranking:</span>
                  <select
                    className="erp-input erp-input--sm stocky-filter-select"
                    aria-label="Cantidad de productos del ranking"
                    value={draftParams.top || 10}
                    onChange={handleTopChange}
                  >
                    <option value={5}>Top 5 productos</option>
                    <option value={10}>Top 10 productos</option>
                    <option value={20}>Top 20 productos</option>
                    <option value={50}>Top 50 productos</option>
                    <option value={100}>Top 100 productos</option>
                  </select>
                </label>
              )}
            </div>

            {/* Fila 3: Botones de Acción obligatorios */}
            <div className="row wrap align-center gap-2">
              {isDirty && (
                <Badge tone="warning">
                  Parámetros modificados
                </Badge>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={loading}
              >
                Limpiar
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={onGenerate}
                loading={loading}
                disabled={loading || hasInvalidRange}
                icon={<Icon name="arrow-right" size="sm" />}
              >
                Generar reporte
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReportesFiltrosBar;

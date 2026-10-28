import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  Button,
  StatusBadge,
  Badge,
  Select,
} from "../../../shared";

function getUrgencia(nec) {
  if (nec.urgencia) return nec.urgencia;
  const dias = nec.fechaRegistro
    ? (Date.now() - new Date(nec.fechaRegistro).getTime()) / (1000 * 3600 * 24)
    : 0;
  if (dias >= 2 || nec.cantidad >= 50) return { key: "critica", label: "Crítica", tone: "danger" };
  if (dias >= 1 || nec.cantidad >= 20) return { key: "alta", label: "Alta", tone: "warning" };
  return { key: "normal", label: "Normal", tone: "neutral" };
}

function getAntiguedad(fechaStr) {
  if (!fechaStr) return { label: "Reciente", key: "hoy" };
  const horas = (Date.now() - new Date(fechaStr).getTime()) / (1000 * 3600);
  const dias = Math.floor(horas / 24);
  if (horas < 24) return { label: "Hoy (< 24h)", key: "hoy" };
  if (dias <= 7) return { label: `Hace ${dias} d`, key: "semana" };
  return { label: `Hace ${dias} d`, key: "antiguas" };
}

export function NecesidadesTab({
  necesidades = [],
  loading = false,
  error = null,
  onRetry,
  locales = [],
  ubicMap,
  productoMap,
  navigate,
  selectedKeys = [],
  onSelectionChange,
}) {
  const [searchNec, setSearchNec] = useState("");
  const [destinoFiltro, setDestinoFiltro] = useState("todos");
  const [urgenciaFiltro, setUrgenciaFiltro] = useState("todas");
  const [antiguedadFiltro, setAntiguedadFiltro] = useState("todas");

  const enrichedNecesidades = useMemo(() => {
    return necesidades.map((n) => {
      const prod = productoMap.get(n.productoId);
      const urg = getUrgencia(n);
      const ant = getAntiguedad(n.fechaRegistro);
      const localNombre = ubicMap.get(n.localId) || `Local #${n.localId}`;
      return {
        ...n,
        productoCodigo: prod?.codigo || `SKU-${n.productoId}`,
        productoNombre: prod?.nombre || `Producto #${n.productoId}`,
        localNombre,
        urgenciaInfo: urg,
        antiguedadInfo: ant,
      };
    });
  }, [necesidades, productoMap, ubicMap]);

  const filteredNecesidades = useMemo(() => {
    return enrichedNecesidades.filter((n) => {
      if (destinoFiltro && destinoFiltro !== "todos" && String(n.localId) !== String(destinoFiltro)) {
        return false;
      }
      if (urgenciaFiltro && urgenciaFiltro !== "todas" && n.urgenciaInfo.key !== urgenciaFiltro) {
        return false;
      }
      if (antiguedadFiltro && antiguedadFiltro !== "todas" && n.antiguedadInfo.key !== antiguedadFiltro) {
        return false;
      }
      if (searchNec.trim()) {
        const q = searchNec.toLowerCase();
        const match =
          String(n.id).includes(q) ||
          n.productoCodigo.toLowerCase().includes(q) ||
          n.productoNombre.toLowerCase().includes(q) ||
          n.localNombre.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [enrichedNecesidades, destinoFiltro, urgenciaFiltro, antiguedadFiltro, searchNec]);

  const selectedNeedsList = useMemo(
    () => enrichedNecesidades.filter((n) => selectedKeys.includes(n.id)),
    [enrichedNecesidades, selectedKeys]
  );

  const totalUnidadesSeleccionadas = useMemo(
    () => selectedNeedsList.reduce((acc, n) => acc + n.cantidad, 0),
    [selectedNeedsList]
  );

  const uniqueDestinos = useMemo(
    () => Array.from(new Set(selectedNeedsList.map((n) => n.localId))),
    [selectedNeedsList]
  );

  const isSingleDestino = uniqueDestinos.length <= 1;
  const singleDestinoNombre = uniqueDestinos.length === 1 ? ubicMap.get(uniqueDestinos[0]) : null;

  const handleConsolidarSeleccionadas = () => {
    if (selectedNeedsList.length === 0) return;
    const destId = uniqueDestinos[0] ? String(uniqueDestinos[0]) : "";
    navigate("/logistica/ordenes/nueva", {
      state: {
        preselectedNecIds: selectedKeys,
        destinoId: destId,
      },
    });
  };

  const handleClearNecFilters = () => {
    setSearchNec("");
    setDestinoFiltro("todos");
    setUrgenciaFiltro("todas");
    setAntiguedadFiltro("todas");
  };

  const hasNecFiltersActive =
    searchNec || destinoFiltro !== "todos" || urgenciaFiltro !== "todas" || antiguedadFiltro !== "todas";

  const necColumns = [
    { key: "id", header: "ID", mono: true, sortable: true },
    {
      key: "localNombre",
      header: "Destino (Local)",
      sortable: true,
      render: (v) => <span className="font-medium text-sm">{v}</span>,
    },
    {
      key: "productoNombre",
      header: "Producto",
      sortable: true,
      render: (_, row) => (
        <div className="stack gap-0">
          <span className="font-mono text-xs text-secondary">{row.productoCodigo}</span>
          <span className="text-sm font-medium">{row.productoNombre}</span>
        </div>
      ),
    },
    {
      key: "cantidad",
      header: "Cantidad",
      align: "right",
      sortable: true,
      render: (v) => <span className="tabular-nums font-medium">{v} u.</span>,
    },
    {
      key: "urgencia",
      header: "Urgencia",
      sortable: true,
      render: (_, row) => (
        <Badge tone={row.urgenciaInfo.tone}>{row.urgenciaInfo.label}</Badge>
      ),
    },
    {
      key: "antiguedad",
      header: "Antigüedad",
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-secondary" title={row.fechaRegistro || ""}>
          {row.antiguedadInfo.label}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "acciones",
      header: "Acción",
      align: "right",
      sortable: false,
      render: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          iconRight="arrow-right"
          onClick={() =>
            navigate("/logistica/ordenes/nueva", {
              state: {
                preselectedNecIds: [row.id],
                destinoId: String(row.localId),
              },
            })
          }
        >
          Consolidar
        </Button>
      ),
    },
  ];

  return (
    <div className="stack gap-3">
      {/* Barra de filtros de necesidades (T035: destino, producto, urgencia, antiguedad) */}
      <div className="card p-3 row wrap gap-3 align-center justify-between">
        <div className="row wrap gap-3 align-center flex-1">
          <div className="erp-search-box flex-1 min-w-48">
            <input
              type="search"
              value={searchNec}
              onChange={(e) => setSearchNec(e.target.value)}
              placeholder="Buscar por producto, SKU, destino o ID..."
              aria-label="Buscar necesidades de reposición"
              className="erp-search-box__input"
            />
          </div>

          <div className="w-44">
            <Select
              value={destinoFiltro}
              onChange={setDestinoFiltro}
              options={[
                { value: "todos", label: "Todos los destinos" },
                ...locales.map((l) => ({ value: String(l.id), label: l.nombre })),
              ]}
              aria-label="Filtrar por sucursal destino"
            />
          </div>

          <div className="w-36">
            <Select
              value={urgenciaFiltro}
              onChange={setUrgenciaFiltro}
              options={[
                { value: "todas", label: "Cualquier urgencia" },
                { value: "critica", label: "Crítica" },
                { value: "alta", label: "Alta" },
                { value: "normal", label: "Normal" },
              ]}
              aria-label="Filtrar por nivel de urgencia"
            />
          </div>

          <div className="w-40">
            <Select
              value={antiguedadFiltro}
              onChange={setAntiguedadFiltro}
              options={[
                { value: "todas", label: "Cualquier antigüedad" },
                { value: "hoy", label: "Hoy (< 24h)" },
                { value: "semana", label: "Últimos 7 días" },
                { value: "antiguas", label: "Más de 7 días" },
              ]}
              aria-label="Filtrar por antigüedad"
            />
          </div>

          {hasNecFiltersActive && (
            <Button variant="ghost" size="sm" onClick={handleClearNecFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Resumen con conteo de seleccionados y boton de consolidacion (T035) */}
      {selectedKeys.length > 0 && (
        <div className="card p-3 bg-primary-subtle border-primary row justify-between align-center wrap gap-2">
          <div className="row gap-3 align-center">
            <span className="text-sm font-medium">
              {selectedKeys.length} {selectedKeys.length === 1 ? "necesidad seleccionada" : "necesidades seleccionadas"} ({totalUnidadesSeleccionadas} unidades)
            </span>
            {isSingleDestino ? (
              <span className="text-xs text-secondary">
                Destino consolidado: <strong>{singleDestinoNombre}</strong>
              </span>
            ) : (
              <span className="text-xs text-danger font-medium">
                Atención: Múltiples destinos seleccionados. El wizard consolidará hacia el primer destino compatible.
              </span>
            )}
          </div>
          <div className="row gap-2 align-center">
            <Button variant="ghost" size="sm" onClick={() => onSelectionChange([])}>
              Deseleccionar
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconRight="arrow-right"
              onClick={handleConsolidarSeleccionadas}
            >
              Consolidar en orden ({selectedKeys.length})
            </Button>
          </div>
        </div>
      )}

      <SortableDataTable
        columns={necColumns}
        data={filteredNecesidades}
        rowKey="id"
        selectable={true}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyTitle="No hay necesidades pendientes de reposición"
        emptyDescription="No se encontraron necesidades registradas que coincidan con los filtros activos."
      />
    </div>
  );
}

export default NecesidadesTab;

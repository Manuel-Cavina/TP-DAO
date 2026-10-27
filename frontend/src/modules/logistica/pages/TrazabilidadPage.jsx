import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Select, StatusBadge } from "../../../shared";
import { logisticaService } from "../services";

const TYPE_LABELS = { ORDEN: "Órdenes", REMITO: "Remitos", BULTO: "Bultos" };

function formatDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString("es-AR") : "Sin fecha registrada";
}

function normalizeEvent(event) {
  return {
    id: event.id || `${event.fecha_hora || ""}-${event.accion || event.estado_nuevo || "evento"}`,
    title: event.accion || [event.estado_anterior, event.estado_nuevo].filter(Boolean).join(" → ") || "Evento registrado",
    detail: event.motivo_o_evidencia || event.registros_asociados || event.observacion || "Sin detalle adicional",
    actor: event.actor || "Sin responsable registrado",
    date: event.fecha_hora,
  };
}

function codeFor(type, item) {
  if (type === "ORDEN") return `OR-${String(item.id).padStart(6, "0")}`;
  if (type === "REMITO") return item.numero;
  return item.codigo || `BLT-${String(item.id).padStart(6, "0")}`;
}

function recentEventLabel(event) {
  const prefix = event.tipo_entidad === "ORDEN" ? "OR" : event.tipo_entidad === "BULTO" ? "BU" : event.tipo_entidad;
  return `${prefix}-${String(event.entidad_id).padStart(6, "0")}`;
}

export function TrazabilidadPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTerm = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(queryTerm);
  const [entityFilter, setEntityFilter] = useState("TODAS");
  const [stateFilter, setStateFilter] = useState("TODOS");
  const [searching, setSearching] = useState(Boolean(queryTerm));
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState({ ordenes: [], remitos: [], bultos: [] });
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentError, setRecentError] = useState("");

  const selectEntity = useCallback(async (type, item) => {
    setLoadingDetail(true);
    setDetailError("");
    try {
      const [response, remitosResponse] = await Promise.all([
        type === "BULTO"
          ? logisticaService.consultarTrazabilidad(item.id)
        : type === "ORDEN"
          ? logisticaService.consultarTrazabilidadOrden(item.id)
          : logisticaService.obtenerTrazabilidadRemito(item.numero),
        type === "BULTO" ? logisticaService.listarRemitos() : Promise.resolve([]),
      ]);
      const remitos = Array.isArray(remitosResponse) ? remitosResponse : remitosResponse?.data || [];
      const relatedRemito = type === "BULTO"
        ? remitos.find((remito) => (remito.bultos || remito.bultos_resumen || []).some((bulto) => String(bulto.id) === String(item.id)))
        : null;
      const events = response?.eventos || response?.eventos_trazabilidad || response?.historial || [];
      setSelectedEntity({
        type,
        id: type === "REMITO" ? item.numero : item.id,
        code: codeFor(type, item),
        status: response?.estado_actual || response?.estado || item.estado,
        orderId: response?.orden_id || item.orden_id,
        remitoNumber: type === "REMITO" ? item.numero : item.remito_numero || item.remitoNumero || relatedRemito?.numero,
        seal: response?.codigo_precinto || item.codigo_precinto || item.precinto?.codigo,
        packageCount: Array.isArray(response?.bultos) ? response.bultos.length : null,
        events: events.map(normalizeEvent),
      });
    } catch (error) {
      setSelectedEntity(null);
      setDetailError(error?.message || "No se pudo cargar la trazabilidad de la entidad seleccionada.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const executeSearch = useCallback(async (term) => {
    const value = String(term || "").trim();
    if (!value) {
      setResults({ ordenes: [], remitos: [], bultos: [] });
      setSelectedEntity(null);
      setSearchError("");
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError("");
    setDetailError("");
    try {
      const response = await logisticaService.buscarTrazabilidad(value);
      const nextResults = {
        ordenes: Array.isArray(response?.ordenes) ? response.ordenes : [],
        remitos: Array.isArray(response?.remitos) ? response.remitos : [],
        bultos: Array.isArray(response?.bultos) ? response.bultos : [],
      };
      setResults(nextResults);
      setSelectedEntity(null);
    } catch (error) {
      setResults({ ordenes: [], remitos: [], bultos: [] });
      setSelectedEntity(null);
      setSearchError(error?.message || "No se pudo buscar en trazabilidad.");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    setSearchQuery(queryTerm);
    executeSearch(queryTerm);
  }, [executeSearch, queryTerm]);

  useEffect(() => {
    if (queryTerm) return undefined;
    let active = true;
    setRecentError("");
    logisticaService.listarEventosRecientes({ limite: 8 })
      .then((response) => {
        if (active) {
          setRecentEvents(Array.isArray(response) ? response : response?.data || []);
          setRecentError("");
        }
      })
      .catch((error) => {
        if (active) setRecentError(error?.message || "No se pudieron consultar los movimientos recientes.");
      });
    return () => { active = false; };
  }, [queryTerm]);

  const resultItems = useMemo(() => [
    ...results.ordenes.map((item) => ({ type: "ORDEN", item })),
    ...results.remitos.map((item) => ({ type: "REMITO", item })),
    ...results.bultos.map((item) => ({ type: "BULTO", item })),
  ], [results]);
  const availableStates = useMemo(() => [...new Set(resultItems.map(({ item }) => item.estado).filter(Boolean))], [resultItems]);
  const filteredResults = resultItems.filter(({ type, item }) =>
    (entityFilter === "TODAS" || type === entityFilter) && (stateFilter === "TODOS" || item.estado === stateFilter)
  );

  const submitSearch = (event) => {
    event.preventDefault();
    const value = searchQuery.trim();
    if (value === queryTerm) executeSearch(value);
    else setSearchParams(value ? { q: value } : {});
  };
  const clearSearch = () => {
    setSearchQuery(""); setEntityFilter("TODAS"); setStateFilter("TODOS"); setSearchParams({});
  };
  const detailPath = (entity) => entity.type === "ORDEN"
    ? `/logistica/ordenes/${entity.id}`
    : entity.type === "REMITO" ? `/logistica/remitos/${encodeURIComponent(entity.id)}` : `/logistica/bultos/${entity.id}`;

  return (
    <section className="trace-page" aria-labelledby="trace-title">
      <div className="page-head">
        <div><h1 id="trace-title">Trazabilidad integral</h1><p className="muted">Consulta por orden, remito, bulto o precinto y conserva las relaciones documentales.</p></div>
      </div>

      <form className="toolbar trace-toolbar" onSubmit={submitSearch}>
        <div className="search-wrap trace-search"><input className="search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar orden, remito, bulto o precinto" aria-label="Buscar trazabilidad" /></div>
        <Button type="submit" loading={searching} loadingLabel="Buscando…">Buscar</Button>
        <Select className="trace-filter" ariaLabel="Filtrar por entidad" options={[{ value: "TODAS", label: "Todas las entidades" }, { value: "ORDEN", label: "Órdenes" }, { value: "REMITO", label: "Remitos" }, { value: "BULTO", label: "Bultos" }]} value={entityFilter} onChange={setEntityFilter} />
        <Select className="trace-filter" ariaLabel="Filtrar por estado" options={[{ value: "TODOS", label: "Todos los estados" }, ...availableStates.map((state) => ({ value: state, label: state }))]} value={stateFilter} onChange={setStateFilter} />
        <Button variant="ghost" onClick={clearSearch}>Limpiar</Button>
      </form>

      {searchError && <Alert tone="danger" title="No se pudo buscar" description={searchError} action={<Button variant="secondary" size="sm" onClick={() => executeSearch(searchQuery)}>Reintentar</Button>} />}
      {!queryTerm && !searching && !searchError && <article className="card trace-results"><div className="row"><div><h2>Movimientos recientes</h2><p className="micro">Evidencia inmutable registrada en la operación.</p></div></div>{recentError && <Alert tone="danger" title="No se pudieron cargar los movimientos" description={recentError} />}{recentEvents.length > 0 ? <div className="trace-result-list">{recentEvents.map((event) => <article key={event.id} className="trace-result"><button type="button" className="trace-result-main" onClick={() => navigate(event.tipo_entidad === "ORDEN" ? `/logistica/ordenes/${event.entidad_id}` : `/logistica/bultos/${event.entidad_id}`)}><span className="micro">{event.tipo_entidad}</span><strong>{recentEventLabel(event)}</strong><span className="micro">{event.motivo_o_evidencia || `${event.estado_anterior || "Sin estado"} → ${event.estado_nuevo}`}</span></button><span className="micro">{formatDate(event.fecha_hora)}</span><span className="micro">{String(event.accion || "Evento").replaceAll("_", " ")}</span></article>)}</div> : !recentError && <div className="trace-empty"><strong>Sin eventos registrados</strong><span className="micro">Las nuevas órdenes, bultos y controles aparecerán aquí automáticamente.</span></div>}</article>}

      {queryTerm && !searchError && <article className="card trace-results">
        <div className="row"><div><h2>Entidades encontradas</h2><p className="micro">{searching ? "Consultando registros…" : `${filteredResults.length} resultado(s) según los filtros actuales.`}</p></div></div>
        {!searching && filteredResults.length === 0 ? <div className="trace-empty"><strong>No hay coincidencias</strong><span className="micro">Probá con otro código o quitá los filtros activos.</span></div> : <div className="trace-result-list">
          {filteredResults.map(({ type, item }) => <article key={`${type}-${item.id || item.numero}`} className="trace-result">
            <button type="button" className="trace-result-main" onClick={() => selectEntity(type, item)}><span className="micro">{TYPE_LABELS[type]}</span><strong>{codeFor(type, item)}</strong><span className="micro">Abrir para ver relaciones documentales.</span></button>
            <StatusBadge status={item.estado} />
            <Button variant="ghost" size="sm" onClick={() => navigate(detailPath({ type, id: type === "REMITO" ? item.numero : item.id }))}>Abrir</Button>
          </article>)}
        </div>}
      </article>}

      {loadingDetail && <article className="card trace-loading" aria-live="polite">Cargando cadena documental y eventos…</article>}
      {detailError && <Alert tone="danger" title="No se pudo cargar la trazabilidad" description={detailError} />}

      {selectedEntity && !loadingDetail && <>
        <article className="card trace-chain"><div className="row"><div><h2>Cadena documental de {selectedEntity.code}</h2><p className="micro">Relaciones disponibles en el registro seleccionado.</p></div><StatusBadge status={selectedEntity.status} /></div>
          <div className="entity-chain">
            {selectedEntity.orderId && selectedEntity.type !== "ORDEN" && <button type="button" className="entity-node" onClick={() => navigate(`/logistica/ordenes/${selectedEntity.orderId}`)}><span className="micro">Orden</span><strong>OR-{String(selectedEntity.orderId).padStart(6, "0")}</strong></button>}
            {selectedEntity.orderId && selectedEntity.remitoNumber && selectedEntity.type === "BULTO" && <span className="chain-arrow" aria-hidden="true">→</span>}
            {selectedEntity.remitoNumber && selectedEntity.type !== "REMITO" && <button type="button" className="entity-node" onClick={() => navigate(`/logistica/remitos/${encodeURIComponent(selectedEntity.remitoNumber)}`)}><span className="micro">Remito</span><strong>{selectedEntity.remitoNumber}</strong></button>}
            {(selectedEntity.orderId || selectedEntity.remitoNumber) && selectedEntity.type === "BULTO" && <span className="chain-arrow" aria-hidden="true">→</span>}
            <button type="button" className="entity-node" onClick={() => navigate(detailPath(selectedEntity))}><span className="micro">{TYPE_LABELS[selectedEntity.type].slice(0, -1)}</span><strong>{selectedEntity.code}</strong></button>
            {selectedEntity.seal && <><span className="chain-arrow" aria-hidden="true">→</span><span className="entity-node"><span className="micro">Precinto</span><strong>{selectedEntity.seal}</strong></span></>}
          </div>
        </article>
        <div className="grid two trace-detail-grid"><article className="card"><h2>Línea temporal inmutable</h2>{selectedEntity.events.length === 0 ? <div className="trace-empty"><span className="micro">Esta entidad todavía no registra eventos de trazabilidad.</span></div> : <ul className="timeline">{selectedEntity.events.map((event) => <li key={event.id}><strong>{event.title}</strong><br /><span className="micro">{formatDate(event.date)} · {event.actor} · {event.detail}</span></li>)}</ul>}</article>
          <aside className="card"><h2>Estado actual</h2><ul className="list"><li><span>Entidad</span><strong>{TYPE_LABELS[selectedEntity.type]}</strong></li><li><span>Identificador</span><strong>{selectedEntity.code}</strong></li><li><span>Estado</span><StatusBadge status={selectedEntity.status} /></li>{selectedEntity.packageCount !== null && <li><span>Bultos vinculados</span><strong>{selectedEntity.packageCount}</strong></li>}{selectedEntity.seal && <li><span>Precinto</span><strong>{selectedEntity.seal}</strong></li>}</ul></aside>
        </div>
      </>}
    </section>
  );
}

export default TrazabilidadPage;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../shared/feedback/ToastContext";

export function TrazabilidadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("PC-883102");
  const [entityFilter, setEntityFilter] = useState("Todas las entidades");
  const [statusFilter, setStatusFilter] = useState("Todos los estados");
  const [dateFilter, setDateFilter] = useState("");

  const handleExport = () => {
    toast("Evidencia exportada. Archivo preparado para descarga.");
  };

  const handleLimpiar = () => {
    setSearchQuery("");
    setEntityFilter("Todas las entidades");
    setStatusFilter("Todos los estados");
    setDateFilter("");
  };

  const displayedEntity = searchQuery.trim() || "PC-883102";

  return (
    <section className="screen" id="trace">
      <div className="workspace">
        <main>
          <div className="page-head">
            <div>
              <h1>Trazabilidad integral</h1>
              <p className="muted">
                Consulta por orden, remito, bulto, precinto, SKU o producto.
              </p>
            </div>
            <button type="button" className="button" onClick={handleExport}>
              Exportar evidencia
            </button>
          </div>

          <div className="toolbar">
            <div className="search-wrap">
              <input
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar trazabilidad"
                aria-label="Buscar trazabilidad"
              />
            </div>
            <select
              className="select w-160"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="Todas las entidades">Todas las entidades</option>
              <option value="Orden">Orden</option>
              <option value="Remito único">Remito único</option>
              <option value="Bulto">Bulto</option>
              <option value="Precinto">Precinto</option>
            </select>
            <select
              className="select w-160"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="Todos los estados">Todos los estados</option>
              <option value="Despachada">Despachada</option>
              <option value="Recibido">Recibido</option>
              <option value="Por verificar">Por verificar</option>
            </select>
            <input
              className="input w-160"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <button type="button" className="button ghost" onClick={handleLimpiar}>
              Limpiar
            </button>
          </div>

          <article className="card">
            <h2>Cadena documental de {displayedEntity}</h2>
            <div className="entity-chain">
              <div
                className="entity-node cursor-pointer"
                onClick={() => navigate("/logistica/ordenes/OR-000112")}
              >
                <span className="micro">Orden</span>
                <h3>OR-000112</h3>
                <span className="badge warn">Despachada</span>
              </div>
              <span className="chain-arrow">&rarr;</span>
              <div
                className="entity-node cursor-pointer"
                onClick={() => navigate("/logistica/remitos/RM-000078")}
              >
                <span className="micro">Remito único</span>
                <h3>RM-000078</h3>
                <span className="badge info">Recibido</span>
              </div>
              <span className="chain-arrow">&rarr;</span>
              <div
                className="entity-node cursor-pointer"
                onClick={() => navigate("/logistica/bultos/BU-000045")}
              >
                <span className="micro">Bulto</span>
                <h3>BU-000045</h3>
                <span className="badge info">Recibido</span>
              </div>
              <span className="chain-arrow">&rarr;</span>
              <div className="entity-node">
                <span className="micro">Precinto</span>
                <h3>PC-883102</h3>
                <span className="badge warn">Por verificar</span>
              </div>
            </div>
          </article>

          <div className="grid two dashboard-grid-two">
            <article className="card">
              <h2>Línea temporal inmutable</h2>
              <ul className="timeline">
                <li>
                  <strong>Recepción registrada</strong>
                  <br />
                  <span className="micro">
                    19 oct 14:32 · Ana Ruiz · Local Palermo · sin impacto todavía
                  </span>
                </li>
                <li>
                  <strong>Despacho registrado</strong>
                  <br />
                  <span className="micro">
                    19 oct 11:18 · Laura Pérez · CD Central · 12 u. en tránsito
                  </span>
                </li>
                <li>
                  <strong>Precinto asignado</strong>
                  <br />
                  <span className="micro">
                    19 oct 10:42 · Martín Gómez · PC-883102
                  </span>
                </li>
                <li>
                  <strong>Bulto preparado</strong>
                  <br />
                  <span className="micro">19 oct 10:20 · 12 u. reservadas</span>
                </li>
              </ul>
            </article>

            <aside className="card">
              <h2>Estado actual</h2>
              <ul className="list">
                <li>
                  <span>Ubicación</span>
                  <strong>Local Palermo</strong>
                </li>
                <li>
                  <span>Responsable actual</span>
                  <strong>Ana Ruiz</strong>
                </li>
                <li>
                  <span>Stock</span>
                  <strong>12 u. en tránsito</strong>
                </li>
                <li>
                  <span>Siguiente acción</span>
                  <strong>Verificar precinto</strong>
                </li>
              </ul>
              <button
                type="button"
                className="button primary"
                data-go="bulto"
                onClick={() => navigate("/logistica/bultos/BU-000045")}
              >
                Abrir bulto
              </button>
            </aside>
          </div>
        </main>
      </div>
    </section>
  );
}

export default TrazabilidadPage;

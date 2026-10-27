import React from "react";

const money = (value) => value == null ? "No disponible" : `$${Number(value).toLocaleString("es-AR")}`;
const dateTime = () => new Date().toLocaleString("es-AR");

function Summary({ reportKey, summary = {} }) {
  const items = reportKey === "r1"
    ? [
        ["Valorización a costo", money(summary.total_valorizado_costo)],
        ["Valorización a venta", money(summary.total_valorizado_venta)],
        ["Unidades en red", Number(summary.total_existencias || 0).toLocaleString("es-AR")],
        ["Alertas de mínimo", Number(summary.total_items_criticos || 0).toLocaleString("es-AR")],
      ]
    : [
        ["Bultos rechazados", Number(summary.total_bultos_rechazados || 0).toLocaleString("es-AR")],
        ["Unidades afectadas", Number(summary.total_unidades_perdidas || 0).toLocaleString("es-AR")],
        ["Pérdida a costo", money(summary.total_costo_merma)],
        ["Pérdida a venta", money(summary.total_valor_venta_merma)],
      ];

  return (
    <dl className="stocky-print-summary">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StockTable({ items }) {
  return (
    <table className="stocky-print-table">
      <thead><tr><th>Código</th><th>Producto</th><th>Ubicación</th><th>Disponible</th><th>Mínimo</th><th>Estado</th><th>Val. costo</th><th>Val. venta</th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={`${item.producto_id}-${item.ubicacion_id}-${index}`}>
        <td>{item.producto_codigo}</td><td>{item.producto_nombre}</td><td>{item.ubicacion_nombre}</td>
        <td>{item.cantidad_disponible}</td><td>{item.nivel_minimo_existencia}</td><td>{item.estado_stock}</td>
        <td>{money(item.valorizacion_costo)}</td><td>{money(item.valorizacion_venta)}</td>
      </tr>)}</tbody>
    </table>
  );
}

function MermaTable({ items }) {
  return (
    <table className="stocky-print-table">
      <thead><tr><th>Bulto</th><th>Remito</th><th>Precinto</th><th>Origen</th><th>Destino</th><th>Fecha de rechazo</th><th>Unidades</th><th>Pérdida a costo</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.bulto_id}>
        <td>#{item.bulto_id}</td><td>{item.remito_numero || "-"}</td><td>{item.codigo_precinto || "Sin precinto"}</td>
        <td>{item.origen_nombre}</td><td>{item.destino_nombre}</td>
        <td>{item.fecha_rechazo ? new Date(item.fecha_rechazo).toLocaleString("es-AR") : "-"}</td>
        <td>{item.total_unidades}</td><td>{money(item.total_perdida_costo)}</td>
      </tr>)}</tbody>
    </table>
  );
}

export function PrintReport({ reportKey, items, summary, filters }) {
  const isR1 = reportKey === "r1";
  const title = isR1
    ? "Salud de Existencias y Valorización Integral"
    : "Auditoría Forense de Mermas y Precintos";
  const question = isR1
    ? "¿Dónde está el stock y cuál es su valorización?"
    : "¿Dónde se originaron las mermas y violaciones de precintos?";
  const detailTitle = isR1 ? "Detalle analítico de existencias" : "Bitácora de incidentes de rechazo";

  return (
    <article className="stocky-print-report" aria-hidden="true">
      <section className="stocky-print-portrait">
        <header className="stocky-formal-header">
          <img src="/brand/stocky-logo.png" alt="Stocky Logo" className="stocky-formal-logo" />
          <div>
            <div className="stocky-formal-company">Stocky Distribución y Logística S.A.</div>
            <div className="stocky-formal-fiscal">
              CUIT: 30-71829401-8 · IVA Responsable Inscripto<br />
              CD Central Troncal: Av. Circunvalación 4500
            </div>
          </div>
          <div className="stocky-formal-meta-box">
            <div>Informe oficial de auditoría</div>
            <div className="dictamen-code">AUD-2026-STK-0842</div>
            <div>Emitido: {dateTime()}</div>
            <div>Responsable: Martín Gómez (Auditoría Central)</div>
          </div>
        </header>

        <section className="stocky-formal-question-banner">
          <div className="stocky-formal-question-title">{question}</div>
          <div className="stocky-formal-question-sub">{title}</div>
        </section>

        <section className="stocky-formal-filters-box">
          <span className="font-medium">Parámetros y filtros aplicados: </span>
          <span>{filters}</span>
        </section>

        <Summary reportKey={reportKey} summary={summary} />
      </section>

      <section className="stocky-print-appendix-landscape">
        <div className="stocky-formal-appendix-intro">
          <div className="stocky-formal-question-title">{detailTitle}</div>
          <div className="stocky-formal-question-sub">
            Apéndice documental apaisado para preservación de legibilidad numérica.
          </div>
        </div>

        {items && items.length > 0 ? (
          isR1 ? <StockTable items={items} /> : <MermaTable items={items} />
        ) : (
          <p className="p-3 text-secondary">
            No se identificaron registros ni hallazgos de desvío para los filtros seleccionados.
          </p>
        )}

        <footer className="stocky-formal-footer">
          <span>Stocky ERP · Sistema de Ventas e Inventario</span>
          <span>Página oficial de auditoría interna</span>
        </footer>
      </section>
    </article>
  );
}

import React, { useState } from "react";

export function ProductDrawerBody() {
  return (
    <>
      <div className="stepper">
        <div className="step current">Identidad</div>
        <div className="step">Clasificación</div>
        <div className="step">Valores</div>
        <div className="step">Revisar</div>
      </div>
      <div className="field-grid">
        <div className="field">
          <label>SKU</label>
          <input className="input" defaultValue=" SKU-307 " maxLength={24} pattern="[A-Za-z0-9-]+" />
          <span className="field-help">Se recortan espacios y se normaliza a mayúsculas.</span>
        </div>
        <div className="field">
          <label>Nombre</label>
          <input className="input" defaultValue="Galletas avena 300 g" maxLength={120} />
          <span className="field-help">Texto plano; no acepta etiquetas HTML.</span>
        </div>
      </div>
      <div className="field mt-3">
        <label>Categoría</label>
        <div className="search-select">
          <input className="input" placeholder="Buscar por nombre o código" defaultValue="Almacén" />
          <div className="search-select-results">
            <button type="button" className="option">
              <span><strong>Almacén</strong><br /><span className="micro">CAT-001 · 128 productos</span></span>
              <span>✓</span>
            </button>
            <button type="button" className="option">
              <span><strong>Almacén saludable</strong><br /><span className="micro">CAT-014 · 34 productos</span></span>
            </button>
          </div>
        </div>
        <span className="field-help">Con muchas categorías, búsqueda paginada; no se cargan todas de una vez.</span>
      </div>
      <div className="field mt-3">
        <label>Proveedor</label>
        <input className="input" list="providerOptions" placeholder="Buscar razón social o CUIT" />
        <datalist id="providerOptions">
          <option value="Mayorista Sur · 30-71234567-9" />
          <option value="Distribuidora Norte · 30-70987654-2" />
        </datalist>
      </div>
      <div className="field-grid mt-3">
        <div className="field">
          <label>Costo unitario</label>
          <input className="input" inputMode="decimal" defaultValue="1250,50" />
          <span className="field-help">Decimal positivo, máximo 2 decimales.</span>
        </div>
        <div className="field">
          <label>Precio de venta</label>
          <input className="input invalid" inputMode="decimal" defaultValue="1000" />
          <span className="field-error">Debe ser igual o mayor que el costo.</span>
        </div>
        <div className="field">
          <label>Nivel mínimo</label>
          <input className="input" inputMode="numeric" defaultValue="20" />
          <span className="field-help">Entero positivo.</span>
        </div>
      </div>
      <div className="validation-note mt-4">
        <strong>Doble validación:</strong> el frontend mejora la experiencia y bloquea formatos inválidos; el backend es la autoridad y vuelve a validar unicidad, rangos y permisos.
      </div>
    </>
  );
}

export function PackageDrawerBody() {
  return (
    <>
      <div className="stepper">
        <div className="step done">Orden</div>
        <div className="step current">Contenido</div>
        <div className="step">Precinto</div>
        <div className="step">Revisar</div>
      </div>
      <div className="context-strip">
        <span><span className="micro">Orden</span><br /><strong>OR-000118</strong></span>
        <span className="separator" />
        <span><span className="micro">Ruta</span><br /><strong>CD Central → Local Palermo</strong></span>
      </div>
      <div className="field">
        <label>Buscar producto pendiente</label>
        <div className="search-wrap">
          <input className="search-input" placeholder="SKU o nombre" defaultValue="Café" />
        </div>
        <div className="search-select-results">
          <button type="button" className="option">
            <span><strong>SKU-229 · Café 500 g</strong><br /><span className="micro">Pendiente 6 · disponible 46</span></span>
            <span>Agregar</span>
          </button>
        </div>
      </div>
      <div className="field-grid mt-3">
        <div className="field">
          <label>Cantidad</label>
          <input className="input" inputMode="numeric" defaultValue="6" />
          <span className="field-help">Entero entre 1 y 6.</span>
        </div>
        <div className="field">
          <label>Precinto</label>
          <input className="input" defaultValue="PC-883103" maxLength={32} />
          <span className="field-help">Único, no reutilizable; permite letras, números y guion.</span>
        </div>
      </div>
      <div className="validation-note mt-4">
        Crear el bulto reserva 6 unidades en CD Central. Precintarlo no despacha: el despacho ocurre con el remito completo.
      </div>
    </>
  );
}

export function BulkDrawerBody() {
  const [bulkMode, setBulkMode] = useState("increase");
  const [bulkPercent, setBulkPercent] = useState("12,5");

  const value = Math.min(100, Math.max(0, Number(bulkPercent.replace(",", ".")) || 0));
  const multiplier = bulkMode === "increase" ? 1 + value / 100 : 1 - value / 100;
  const deltaLabel = `${bulkMode === "increase" ? "+" : "-"}${String(value).replace(".", ",")}%`;
  const yerbaProposed = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(3450 * multiplier);
  const cafeProposed = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(7800 * multiplier);

  return (
    <>
      <div className="stepper">
        <div className="step done">Seleccionar</div>
        <div className="step current">Regla</div>
        <div className="step">Revisar</div>
        <div className="step">Confirmar</div>
      </div>
      <div className="field-grid">
        <div className="field">
          <label>Atributo</label>
          <select className="select">
            <option>Precio de venta</option>
          </select>
        </div>
        <div className="field">
          <label>Operación</label>
          <select
            className="select"
            id="bulkMode"
            value={bulkMode}
            onChange={(e) => setBulkMode(e.target.value)}
          >
            <option value="increase">Incrementar porcentaje</option>
            <option value="decrease">Reducir porcentaje</option>
          </select>
        </div>
        <div className="field">
          <label>Porcentaje</label>
          <div className="row justify-start">
            <input
              className="input max-w-140"
              id="bulkPercent"
              inputMode="decimal"
              value={bulkPercent}
              onChange={(e) => setBulkPercent(e.target.value)}
            />
            <strong>%</strong>
          </div>
          <span className="field-help">Mayor que 0 y hasta 100; máximo 2 decimales.</span>
        </div>
      </div>
      <table className="mt-3">
        <thead>
          <tr>
            <th>Producto</th>
            <th className="num">Anterior</th>
            <th className="num">Variación</th>
            <th className="num">Propuesto</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SKU-104 · Yerba</td>
            <td className="num">ARS 3.450,00</td>
            <td className="num bulk-delta">{deltaLabel}</td>
            <td className="num bulk-result">{yerbaProposed}</td>
          </tr>
          <tr>
            <td>SKU-229 · Café</td>
            <td className="num">ARS 7.800,00</td>
            <td className="num bulk-delta">{deltaLabel}</td>
            <td className="num bulk-result">{cafeProposed}</td>
          </tr>
        </tbody>
      </table>
      <div className="validation-note mt-3">
        La revisión muestra precio anterior, porcentaje y resultado por producto. La operación es atómica: si una fila es inválida, no cambia ninguna.
      </div>
    </>
  );
}

export function ApprovePackagesDrawerBody({ onToast }) {
  return (
    <>
      <div className="stepper">
        <div className="step done">Orden</div>
        <div className="step current">Bultos</div>
        <div className="step">Evidencia</div>
        <div className="step">Confirmar</div>
      </div>
      <p>
        Puede aprobar un bulto desde su fila o confirmar juntos todos los que ya cumplan contenido y precinto. Cada bulto conserva un evento individual.
      </p>
      <table>
        <thead>
          <tr>
            <th>Bulto</th>
            <th>Contenido</th>
            <th>Precinto</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>BU-000043</td>
            <td><span className="badge ok">12/12 u.</span></td>
            <td>PC-88103</td>
            <td>
              <button
                type="button"
                className="button small"
                onClick={() => onToast?.("BU-000043 aprobado para remito")}
              >
                Aprobar bulto
              </button>
            </td>
          </tr>
          <tr>
            <td>BU-000044</td>
            <td><span className="badge ok">12/12 u.</span></td>
            <td>PC-88104</td>
            <td>
              <button
                type="button"
                className="button small"
                onClick={() => onToast?.("BU-000044 aprobado para remito")}
              >
                Aprobar bulto
              </button>
            </td>
          </tr>
          <tr>
            <td>BU-000045</td>
            <td><span className="badge warn">6/12 u.</span></td>
            <td>Sin precinto</td>
            <td>
              <button type="button" className="button small" disabled>
                No elegible
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="validation-note mt-3">
        <strong>Aprobar listos</strong> incluye sólo BU-000043 y BU-000044. No completa, corrige ni omite el bulto bloqueado.
      </div>
    </>
  );
}

export function VerifyAllDrawerBody() {
  return (
    <>
      <div className="stepper">
        <div className="step done">Remito recibido</div>
        <div className="step current">Escanear</div>
        <div className="step">Resultados</div>
        <div className="step">Confirmar</div>
      </div>
      <p>
        Control por lote de RM-000078. Cada precinto debe escanearse o ingresarse y conserva su propio resultado.
      </p>
      <table>
        <thead>
          <tr>
            <th className="col-w-18">Bulto</th>
            <th className="col-w-24">Precinto esperado</th>
            <th className="col-w-32">Lectura</th>
            <th className="col-w-26">Resultado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>BU-000045</td>
            <td>PC-883102</td>
            <td><input className="input" defaultValue="PC-883102" /></td>
            <td>
              <select className="select" defaultValue="Íntegro">
                <option value="Íntegro">Íntegro</option>
                <option value="Violado">Violado</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>BU-000046</td>
            <td>PC-883103</td>
            <td><input className="input" defaultValue="PC-883103" /></td>
            <td>
              <select className="select" defaultValue="Íntegro">
                <option value="Íntegro">Íntegro</option>
                <option value="Violado">Violado</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>BU-000047</td>
            <td>PC-883104</td>
            <td><input className="input" defaultValue="PC-883104" /></td>
            <td>
              <select className="select" defaultValue="Íntegro">
                <option value="Íntegro">Íntegro</option>
                <option value="Violado">Violado</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="validation-note mt-3">
        “Confirmar 3 resultados” no significa aprobar a ciegas: valida cada lectura, exige motivo si se elige Violado y genera tres eventos de trazabilidad.
      </div>
    </>
  );
}

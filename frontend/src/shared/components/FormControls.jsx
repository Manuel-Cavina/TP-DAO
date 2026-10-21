import React from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";

/**
 * Reusable CRUD & Form Primitives (`frontend/src/shared/components/FormControls.jsx`)
 * Standardized inputs, field wrappers, key-value detail grids, and endpoint contract banners
 * con soporte para feedback claro de tipos, rangos, longitud y sanitización (FR-017, FR-038).
 */

/**
 * Sanitiza texto eliminando etiquetas HTML y normalizando espacios repetidos (FR-038).
 * Asegura que los datos se rendericen como texto plano y no como markup ejecutable.
 */
export function sanitizeTextInput(value, { allowMultiline = false, trim = true } = {}) {
  if (value === undefined || value === null) return "";
  let str = String(value);
  // Eliminar markup HTML ejecutable
  str = str.replace(/<[^>]*>/g, "");
  if (!allowMultiline) {
    str = str.replace(/[\r\n]+/g, " ");
  }
  // Normalizar espacios múltiples
  str = str.replace(/[ \t]+/g, " ");
  return trim ? str.trim() : str;
}

/**
 * Validador estándar para campos según FR-038.
 * Proporciona mensajes claros en español para requeridos, tipos, rangos y longitudes,
 * preservando los valores ingresados ante errores recuperables.
 */
export function validateField(value, rules = {}) {
  const {
    label = "El campo",
    required = false,
    type, // "number", "integer", "cuit", "email"
    min,
    max,
    minLength,
    maxLength,
    pattern,
    patternMessage,
  } = rules;

  const rawStr = value === undefined || value === null ? "" : String(value);
  const trimmed = rawStr.trim();

  if (required && trimmed === "") {
    return `${label} es obligatorio.`;
  }

  if (trimmed === "") {
    return null;
  }

  if (minLength !== undefined && trimmed.length < minLength) {
    return `${label} debe tener al menos ${minLength} caracteres (actual: ${trimmed.length}).`;
  }

  if (maxLength !== undefined && trimmed.length > maxLength) {
    return `${label} no puede superar los ${maxLength} caracteres (actual: ${trimmed.length}).`;
  }

  if (type === "number" || type === "integer" || min !== undefined || max !== undefined) {
    const num = Number(trimmed);
    if (isNaN(num)) {
      return `${label} debe ser un valor numérico válido.`;
    }
    if (type === "integer" && !Number.isInteger(num)) {
      return `${label} debe ser un número entero.`;
    }
    if (min !== undefined && max !== undefined && (num < min || num > max)) {
      return `${label} debe estar entre ${min} y ${max}.`;
    }
    if (min !== undefined && num < min) {
      return `${label} debe ser mayor o igual a ${min}.`;
    }
    if (max !== undefined && num > max) {
      return `${label} debe ser menor o igual a ${max}.`;
    }
  }

  if (type === "cuit") {
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length !== 11) {
      return `${label} debe tener exactamente 11 dígitos numéricos.`;
    }
  }

  if (pattern && !pattern.test(trimmed)) {
    return patternMessage || `${label} contiene caracteres o formato no válidos.`;
  }

  return null;
}

/**
 * Valida un formulario completo según esquema y sanitiza los campos.
 * Retorna `{ isValid, errors, sanitized }`.
 */
export function validateForm(values, schema = {}) {
  const errors = {};
  const sanitized = {};

  Object.entries(schema).forEach(([field, rules]) => {
    const val = values?.[field];
    const fieldError = validateField(val, rules);
    if (fieldError) {
      errors[field] = fieldError;
    }
    if (rules.sanitize && typeof val === "string") {
      sanitized[field] = sanitizeTextInput(val, rules.sanitizeOptions);
    } else {
      sanitized[field] = val;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}

/**
 * Genera hint automático describiendo restricciones cuando no se pasa hint explícito.
 */
function buildConstraintHint({ hint, min, max, minLength, maxLength, type, integer }) {
  if (hint) return hint;
  const parts = [];

  if (type === "integer" || integer) {
    if (min !== undefined && max !== undefined) {
      parts.push(`Entero entre ${min} y ${max}`);
    } else if (min !== undefined) {
      parts.push(`Entero mayor o igual a ${min}`);
    } else if (max !== undefined) {
      parts.push(`Entero hasta ${max}`);
    } else {
      parts.push("Número entero");
    }
  } else if (type === "number" || min !== undefined || max !== undefined) {
    if (min !== undefined && max !== undefined) {
      parts.push(`Valor entre ${min} y ${max}`);
    } else if (min !== undefined) {
      parts.push(`Mínimo ${min}`);
    } else if (max !== undefined) {
      parts.push(`Máximo ${max}`);
    }
  }

  if (minLength !== undefined && maxLength !== undefined) {
    parts.push(`De ${minLength} a ${maxLength} caracteres`);
  } else if (maxLength !== undefined) {
    parts.push(`Hasta ${maxLength} caracteres`);
  } else if (minLength !== undefined) {
    parts.push(`Mínimo ${minLength} caracteres`);
  }

  return parts.length ? parts.join(" · ") : null;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  counter,
  children,
  className = "",
  id,
}) {
  const fieldId = htmlFor || id;
  const errorId = fieldId ? `${fieldId}-error` : undefined;
  const hintId = fieldId ? `${fieldId}-hint` : undefined;

  return (
    <label htmlFor={fieldId} className={`erp-field ${className}`.trim()}>
      {(label || hint || counter) && (
        <span className="erp-field-label erp-field-label--split">
          <span>
            {label} {required && <span className="text-danger" aria-hidden="true">*</span>}
          </span>
          <span className="row align-center gap-2">
            {counter && (
              <span className="text-muted font-mono font-regular text-xs">
                {counter}
              </span>
            )}
            {hint && (
              <span id={hintId} className="text-muted font-regular">
                {hint}
              </span>
            )}
          </span>
        </span>
      )}
      {children}
      {error && (
        <span id={errorId} className="text-xs text-danger" role="alert" aria-live="polite">
          {error}
        </span>
      )}
    </label>
  );
}

export function TextInput({
  label,
  hint,
  error,
  required,
  mono = false,
  minLength,
  maxLength,
  showCount = false,
  className = "",
  id,
  value,
  ...props
}) {
  const errorClass = error ? "is-invalid" : "";
  const resolvedHint = buildConstraintHint({ hint, minLength, maxLength });
  const valLength = value !== undefined && value !== null ? String(value).length : 0;
  const counter = showCount && maxLength ? `${valLength}/${maxLength}` : null;
  const errorId = id && error ? `${id}-error` : undefined;
  const hintId = id && resolvedHint ? `${id}-hint` : undefined;

  const inputEl = (
    <input
      id={id}
      type="text"
      className={`erp-input ${mono ? "font-mono" : ""} ${errorClass} ${className}`.trim()}
      value={value}
      minLength={minLength}
      maxLength={maxLength}
      aria-required={required ? "true" : undefined}
      aria-invalid={error ? "true" : "false"}
      aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
      {...props}
    />
  );
  if (!label && !error && !resolvedHint && !counter) return inputEl;
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={resolvedHint}
      counter={counter}
      error={error}
      required={required}
    >
      {inputEl}
    </FormField>
  );
}

export function NumberInput({
  label,
  hint,
  error,
  required,
  min,
  max,
  step,
  integer = false,
  className = "",
  id,
  value,
  ...props
}) {
  const errorClass = error ? "is-invalid" : "";
  const resolvedHint = buildConstraintHint({ hint, min, max, integer });
  const errorId = id && error ? `${id}-error` : undefined;
  const hintId = id && resolvedHint ? `${id}-hint` : undefined;

  const inputEl = (
    <input
      id={id}
      type="number"
      className={`erp-input tabular-nums ${errorClass} ${className}`.trim()}
      value={value}
      min={min}
      max={max}
      step={step || (integer ? "1" : undefined)}
      aria-required={required ? "true" : undefined}
      aria-invalid={error ? "true" : "false"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
      {...props}
    />
  );
  if (!label && !error && !resolvedHint) return inputEl;
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={resolvedHint}
      error={error}
      required={required}
    >
      {inputEl}
    </FormField>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  required,
  minLength,
  maxLength,
  showCount = false,
  className = "",
  id,
  value,
  ...props
}) {
  const errorClass = error ? "is-invalid" : "";
  const resolvedHint = buildConstraintHint({ hint, minLength, maxLength });
  const valLength = value !== undefined && value !== null ? String(value).length : 0;
  const counter = showCount && maxLength ? `${valLength}/${maxLength}` : null;
  const errorId = id && error ? `${id}-error` : undefined;
  const hintId = id && resolvedHint ? `${id}-hint` : undefined;

  const areaEl = (
    <textarea
      id={id}
      className={`erp-textarea ${errorClass} ${className}`.trim()}
      value={value}
      minLength={minLength}
      maxLength={maxLength}
      aria-required={required ? "true" : undefined}
      aria-invalid={error ? "true" : "false"}
      aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
      {...props}
    />
  );
  if (!label && !error && !resolvedHint && !counter) return areaEl;
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={resolvedHint}
      counter={counter}
      error={error}
      required={required}
    >
      {areaEl}
    </FormField>
  );
}

export function KeyValueGrid({ items = [] }) {
  return (
    <div className="erp-kv-grid">
      {items.map((item, idx) => (
        <div key={`${item.label}-${idx}`} className="erp-kv-item">
          <span className="text-xs text-muted">
            {item.label}
          </span>
          <span
            className={`erp-kv-item__value ${item.mono ? "font-mono" : ""}`.trim()}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EndpointBadge({ method = "GET", path = "/api/catalogo/productos" }) {
  const tone =
    method === "POST"
      ? "info"
      : method === "DELETE"
      ? "danger"
      : method === "PUT" || method === "PATCH"
      ? "warning"
      : "success";
  return (
    <span className="erp-endpoint font-mono">
      <Badge tone={tone} dot={false}>
        {method}
      </Badge>
      <span className="text-secondary">{path}</span>
    </span>
  );
}

export function UserStoryBanner({
  storyId = "HU-CAT-01",
  title,
  endpoints = [],
  onTriggerAction,
  actionLabel,
}) {
  return (
    <div className="erp-story-banner">
      <div className="row wrap align-center gap-2">
        <Badge tone="info">{storyId}</Badge>
        <span className="text-xs font-medium">
          {title}
        </span>
        {endpoints.map((ep, i) => (
          <EndpointBadge key={i} method={ep.method} path={ep.path} />
        ))}
      </div>
      {onTriggerAction && actionLabel && (
        <Button variant="secondary" size="sm" iconLeft="plus" onClick={onTriggerAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

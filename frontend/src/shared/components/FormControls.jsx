import React from "react";
import { Icon } from "./Icon";
import { Badge } from "./Badge";
import { Button } from "./Button";

/**
 * Reusable CRUD & Form Primitives (`frontend/src/shared/components/FormControls.jsx`)
 * Standardized inputs, field wrappers, key-value detail grids, and endpoint contract banners
 * so every CRUD screen across the 5 modules shares the exact same visual pattern.
 */

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className = "",
}) {
  return (
    <label htmlFor={htmlFor} className={`erp-field ${className}`.trim()}>
      {label && (
        <span className="erp-field-label erp-field-label--split">
          <span>
            {label} {required && <span className="text-danger">*</span>}
          </span>
          {hint && (
            <span className="text-muted font-regular">
              {hint}
            </span>
          )}
        </span>
      )}
      {children}
      {error && (
        <span className="text-xs text-danger">
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
  className = "",
  ...props
}) {
  const errorClass = error ? "is-invalid" : "";
  const inputEl = (
    <input
      type="text"
      className={`erp-input ${mono ? "font-mono" : ""} ${errorClass} ${className}`.trim()}
      {...props}
    />
  );
  if (!label && !error && !hint) return inputEl;
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {inputEl}
    </FormField>
  );
}

export function NumberInput({
  label,
  hint,
  error,
  required,
  className = "",
  ...props
}) {
  const errorClass = error ? "is-invalid" : "";
  const inputEl = (
    <input
      type="number"
      className={`erp-input tabular-nums ${errorClass} ${className}`.trim()}
      {...props}
    />
  );
  if (!label && !error && !hint) return inputEl;
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {inputEl}
    </FormField>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  required,
  className = "",
  ...props
}) {
  const errorClass = error ? "is-invalid" : "";
  const areaEl = (
    <textarea
      className={`erp-textarea ${errorClass} ${className}`.trim()}
      {...props}
    />
  );
  if (!label && !error && !hint) return areaEl;
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
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

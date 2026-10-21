import React, { useState } from "react";

/**
 * Arc UI Avatar & UserChip (`frontend/src/shared/components/Avatar.jsx`)
 * Renders user/operator avatar with automatic initials fallback and online status dot.
 */

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  name = "Operador ERP",
  src,
  size = "md",
  status = "online",
  className = "",
}) {
  const [imgError, setImgError] = useState(false);
  const sizeClass =
    size === "sm" ? "erp-avatar--sm" : size === "lg" ? "erp-avatar--lg" : "";
  const statusClass =
    status === "online" ? "erp-avatar__status--online" : "";

  return (
    <span
      className={`erp-avatar ${sizeClass} ${className}`.trim()}
      title={name}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          className="erp-avatar__img"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
      {status && (
        <span
          className={`erp-avatar__status ${statusClass}`.trim()}
        />
      )}
    </span>
  );
}

export function UserChip({ name = "Martín Gómez", role = "Jefe de CD Central", src }) {
  return (
    <div className="erp-user-chip">
      <Avatar name={name} src={src} size="sm" status="online" />
      <div className="stack gap-1">
        <span className="erp-user-chip__name">{name}</span>
        <span className="erp-user-chip__role">{role}</span>
      </div>
    </div>
  );
}

export default Avatar;

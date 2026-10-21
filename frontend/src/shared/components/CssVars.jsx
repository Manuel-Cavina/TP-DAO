import React, { useLayoutEffect, useRef } from "react";

/**
 * Dynamic CSS custom properties without inline `style` props.
 * `useCssVars(vars)` returns a ref; the properties are set with
 * `element.style.setProperty` in a layout effect. `VarBox` wraps it as an element.
 * A `null`/`undefined` value removes the property.
 */
export function useCssVars(vars) {
  const ref = useRef(null);
  const key = JSON.stringify(vars || {});
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    Object.entries(JSON.parse(key)).forEach(([name, value]) => {
      if (value === null || value === undefined) el.style.removeProperty(name);
      else el.style.setProperty(name, String(value));
    });
  }, [key]);
  return ref;
}

export function VarBox({ as: Tag = "div", vars, children, ...props }) {
  const ref = useCssVars(vars);
  return (
    <Tag ref={ref} {...props}>
      {children}
    </Tag>
  );
}

/** Normalizes a number to px, leaves strings (`78%`, `2rem`) untouched. */
export function toCssSize(value) {
  return typeof value === "number" ? `${value}px` : value;
}

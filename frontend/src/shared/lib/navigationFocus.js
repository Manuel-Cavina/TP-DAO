/** Return the focus-loop destination, or null when native tabbing can proceed. */
export function navigationFocusTarget(items, activeElement, shiftKey) {
  if (!items.length) return null;
  const outside = !items.includes(activeElement);
  if (shiftKey && (outside || activeElement === items[0])) return items[items.length - 1];
  if (!shiftKey && (outside || activeElement === items[items.length - 1])) return items[0];
  return null;
}

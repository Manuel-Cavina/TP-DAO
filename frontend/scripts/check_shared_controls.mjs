import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toAppError, AppError } from "../src/core/http/index.js";

// 1. Verificación estática de SearchableSelect.jsx
const searchSelectSrc = readFileSync(new URL("../src/shared/components/SearchableSelect.jsx", import.meta.url), "utf8");

assert.match(searchSelectSrc, /export function SearchableSelect/, "SearchableSelect debe ser exportado");
assert.match(searchSelectSrc, /search-select-clear/, "SearchableSelect debe tener botón de clear");
assert.match(searchSelectSrc, /handleClear/, "SearchableSelect debe implementar handleClear");
assert.match(searchSelectSrc, /role="combobox"/, "SearchableSelect debe tener role combobox");
assert.match(searchSelectSrc, /role="listbox"/, "SearchableSelect debe tener role listbox");
assert.match(searchSelectSrc, /role="option"/, "SearchableSelect debe tener role option");
assert.match(searchSelectSrc, /aria-expanded/, "SearchableSelect debe manejar aria-expanded");
assert.match(searchSelectSrc, /aria-controls/, "SearchableSelect debe manejar aria-controls");
assert.match(searchSelectSrc, /aria-activedescendant/, "SearchableSelect debe manejar aria-activedescendant");
assert.match(searchSelectSrc, /ArrowDown/, "SearchableSelect debe soportar ArrowDown");
assert.match(searchSelectSrc, /ArrowUp/, "SearchableSelect debe soportar ArrowUp");
assert.match(searchSelectSrc, /Enter/, "SearchableSelect debe soportar Enter");
assert.match(searchSelectSrc, /Escape/, "SearchableSelect debe soportar Escape");
assert.match(searchSelectSrc, /\.slice\(0,\s*20\)/, "SearchableSelect debe limitar los resultados a 20");

// 2. Verificación de CSS de SearchableSelect clear button
const wireframeCss = readFileSync(new URL("../src/shared/styles/wireframe-tokens.css", import.meta.url), "utf8");
assert.match(wireframeCss, /\.search-select-clear\s*\{/, "wireframe-tokens.css debe definir .search-select-clear");

const controlsCss = readFileSync(new URL("../src/shared/styles/components-controls.css", import.meta.url), "utf8");
assert.match(controlsCss, /\.search-select-clear\s*\{/, "components-controls.css debe definir .search-select-clear");

// 3. Verificación de FormControls.jsx
const formControlsSrc = readFileSync(new URL("../src/shared/components/FormControls.jsx", import.meta.url), "utf8");
assert.match(formControlsSrc, /export function FormField/, "FormControls debe exportar FormField");
assert.match(formControlsSrc, /export function TextInput/, "FormControls debe exportar TextInput");
assert.match(formControlsSrc, /export function NumberInput/, "FormControls debe exportar NumberInput");
assert.match(formControlsSrc, /export function TextareaField/, "FormControls debe exportar TextareaField");
assert.match(formControlsSrc, /export function sanitizeTextInput/, "FormControls debe exportar sanitizeTextInput");
assert.match(formControlsSrc, /export function validateField/, "FormControls debe exportar validateField");
assert.match(formControlsSrc, /export function validateForm/, "FormControls debe exportar validateForm");
assert.match(formControlsSrc, /aria-invalid/, "FormControls debe manejar aria-invalid");
assert.match(formControlsSrc, /aria-required/, "FormControls debe manejar aria-required");

// 4. Verificación de ToastContext.jsx
const toastSrc = readFileSync(new URL("../src/shared/feedback/ToastContext.jsx", import.meta.url), "utf8");
assert.match(toastSrc, /export function ToastProvider/, "ToastContext debe exportar ToastProvider");
assert.match(toastSrc, /export function useToast/, "ToastContext debe exportar useToast");
assert.match(toastSrc, /notifySuccess/, "ToastContext debe implementar notifySuccess con soporte de entidad y resultado");
assert.match(toastSrc, /notifyError/, "ToastContext debe implementar notifyError");
assert.match(toastSrc, /kind === "conflict"/, "ToastContext debe asociar conflictos con tono warning");

// 5. Test unitario de toAppError con string y objetos
const strErr = toAppError("Error de negocio personalizado");
assert.equal(strErr.kind, "domain");
assert.equal(strErr.message, "Error de negocio personalizado");

const appErr = new AppError({ kind: "conflict", message: "Versión obsoleta" });
const mappedAppErr = toAppError(appErr);
assert.equal(mappedAppErr.kind, "conflict");
assert.equal(mappedAppErr.message, "Versión obsoleta");

console.log("Verificaciones de componentes compartidos T015 y T018 exitosas.");

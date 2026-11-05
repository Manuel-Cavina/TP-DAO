// Executes production JSX handlers with deterministic hooks and HTTP. This is not a DOM test.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(resolve(root, 'frontend/package.json'));
const { transformSync } = require('esbuild');
export { assert };
export const read = path => readFileSync(resolve(root, path), 'utf8');
export function runtime(initial = []) {
  const state = [...initial]; let index = 0;
  const refs = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'Fragment',
    useState: initialValue => { const at = index++; if (state[at] === undefined) state[at] = typeof initialValue === 'function' ? initialValue() : initialValue; return [state[at], value => state[at] = typeof value === 'function' ? value(state[at]) : value]; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {},
    useRef: value => { const at=index++; return refs[at] ||= {current:value}; },
  };
  return { React, state, reset: () => { index = 0; } };
}
export function load(path, overrides = {}, rt = runtime()) {
  const cache = new Map();
  const fallback = new Proxy({ __esModule: true }, { get: (obj, key) => {
    if (key in obj) return obj[key];
    if (!cache.has(key)) cache.set(key, Object.defineProperty((...args) => undefined, 'name', { value: String(key) }));
    return cache.get(key);
  } });
  const localRequire = path => path === 'react' ? { ...rt.React, default: rt.React, __esModule: true } : overrides[path] || fallback;
  const module = { exports: {} };
  const code = transformSync(read(path), { loader: path.endsWith('jsx') ? 'jsx' : 'js', format: 'cjs' }).code;
  new Function('require','module','exports',code)(localRequire,module,module.exports);
  return { exports: module.exports, rt, render: (name, props) => { rt.reset(); return module.exports[name](props); } };
}
export const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' && tree.props ? [tree, ...nodes(tree.props.children)] : [];
export const byName = (tree, name) => nodes(tree).find(n => n.type?.name === name);
export const textOf = tree => Array.isArray(tree) ? tree.map(textOf).join(' ') : tree?.props ? textOf(tree.props.children) : tree == null ? '' : String(tree);
export async function run(cases) {
  let failures=0;
  for(const [name,test] of cases) try { await test(); console.log('PASS',name); } catch(error) { failures++; console.log('RED',name,'\n ',error.message); }
  console.log(`${cases.length-failures}/${cases.length} passing`); if(failures) process.exitCode=1;
}

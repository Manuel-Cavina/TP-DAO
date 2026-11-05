import { assert, load, read, run } from './harness.mjs';
const {computeGuidanceByTab}=load('frontend/src/modules/logistica/mappers/ordenDetalleGuidance.js').exports;
await run([
 ['received all checked requires closure, not missing checks',()=>{
   const {recepcion}=computeGuidanceByTab({orden:{estado:'DESPACHADA'},remito:{estado:'RECIBIDO',bultosPendientes:0,bultosVerificados:1,bultosRechazados:1}});
   assert.doesNotMatch(recepcion.title,/falta verificar/i); assert.match(recepcion.title,/cerrar|cierre/i);
 }],
 ['sealed out-of-scope row must not ask for seal',()=>{
   const source=read('frontend/src/modules/logistica/pages/EmpaquetadoPage.jsx');
   const start=source.indexOf('render: (_, row) =>',source.indexOf('key: "aprobacion"'));
   const expression=source.slice(start+'render: (_, row) =>'.length,source.indexOf('\n    },',start)).trim().replace(/,$/,'');
   // Keep actual branch conditions, replace only JSX leaves with their visible text.
   const executable=expression.replace(/<span[^>]*>([^<]*)<\/span>/g,(_,label)=>JSON.stringify(label)).replace(/<Button[\s\S]*?<\/Button>/g,'"Aprobar"');
   const shown=new Function('aprobadosSet','row','puedeOperarOrigen',`return ${executable}`)(new Set(),{id:1,estado:'PRECINTADO',codigoPrecinto:'PC-1',aprobado:false},false);
   assert.notEqual(shown,'Requiere precinto');
 }],
]);

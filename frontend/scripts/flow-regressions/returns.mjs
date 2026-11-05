import {assert,load,runtime,byName,run} from './harness.mjs';
const sales=[{id:1,local_id:2,fecha_hora:'2026-11-04T12:00:00',total:'100',detalles:[]},{id:2,local_id:2,fecha_hora:'2026-10-20T12:00:00',total:'100',detalles:[]},{id:3,local_id:2,fecha_hora:'2026-10-06T00:00:00',total:'100',detalles:[]},{id:4,local_id:2,fecha_hora:'2026-10-05T23:59:59',total:'100',detalles:[]}];
const requests=[];
const mappers=load('frontend/src/modules/ventas_caja/mappers/ventasMappers.js').exports;
const http={get:async(path,{params={}}={})=>{
  requests.push({path,params});
  if(path==='/api/ventas')return sales.filter(s=>(!params.desde||s.fecha_hora>=params.desde)&&(!params.hasta||s.fecha_hora<=params.hasta));
  if(path==='/api/ventas/1/devoluciones')return [{id:7,venta_id:1,local_id:2,fecha_hora:'2026-11-05T12:00:00',monto_reintegrado:'100',detalles:[]}];
  if(path==='/api/ventas/2/devoluciones')return [{id:8,venta_id:2,local_id:2,fecha_hora:'2026-10-21T12:00:00',monto_reintegrado:'100',detalles:[{producto_id:1,cantidad:1}]}];
  if(/^\/api\/ventas\/[34]\/devoluciones$/.test(path))return [];
  if(path==='/api/caja/2')return {cantidad_devoluciones:params.desde==='2026-11-05'?1:0,total_devoluciones:params.desde==='2026-11-05'?'100':'0',saldo:'-100'};
  throw Error(path);
}};
const {ventasService}=load('frontend/src/modules/ventas_caja/services/ventasService.js',{'../../../core/http':{http},'../mappers/ventasMappers':mappers}).exports;
let fetcher,data;
const {useVentasCaja}=load('frontend/src/modules/ventas_caja/hooks/useVentasCaja.js',{
  '../../../shared/hooks':{useAsync:f=>{fetcher=f;return{data,status:'success',reload:()=>{}};},useMutation:()=>({})},
  '../services':{ventasService},
}).exports;
async function query(day){data=null;useVentasCaja({localId:2,desde:day,hasta:day});data=await fetcher({signal:new AbortController().signal});return useVentasCaja({localId:2,desde:day,hasta:day});}
const RealDate=Date;
class AuditDate extends RealDate{constructor(...args){super(...(args.length?args:['2026-11-05T12:00:00']));}static now(){return new RealDate('2026-11-05T12:00:00').getTime();}}
globalThis.Date=AuditDate;
try { await run([
 ['today includes return of yesterday sale',async()=>{const result=await query('2026-11-05');assert.equal(result.devoluciones.length,result.caja.cantidadDevoluciones);assert.deepEqual(result.devoluciones.map(d=>d.id),[7]);}],
 ['yesterday excludes return made today',async()=>{const result=await query('2026-11-04');assert.equal(result.devoluciones.length,result.caja.cantidadDevoluciones);}],
 ['eligible prior-month sale reaches actual refund modal',async()=>{
   const result=await query('2026-11-05');
   const page=load('frontend/src/modules/ventas_caja/pages/VentasCajaPage.jsx',{
     'react-router-dom':{useSearchParams:()=>[new URLSearchParams(),()=>{}]},
     '../../../shared/hooks':{useDisclosure:()=>({open:true})},
     '../../../app/providers/SedeProvider':{useSede:()=>({sede:{tipo:'LOCAL',value:2},sedeId:2,sedes:[{tipo:'LOCAL',value:2,label:'Local2'}]})},
     '../hooks/useVentasCaja':{useVentasCaja:()=>result},
     '../../catalogo':{useProductos:()=>({productos:[]})},
     '../../ubicaciones_stock':{useStockMatriz:()=>({stocks:[]})},
   });
   const modal=byName(page.render('VentasCajaPage'),'DevolucionModal');
   assert.ok(modal.props.facturas.some(v=>v.id===2),'Oct20 sale is16days old on Nov5, but refund candidates omit it');
   assert.ok(modal.props.devoluciones.some(v=>v.id===8),'Quantity caps need prior returns outside the movement period');
 }],
 ['bounded local-day read includes30day boundary, excludes earlier sale',async()=>{
   const result=await query('2026-11-05');
   assert.deepEqual(result.ventasParaDevolver.map(v=>v.id),[1,2,3]);
   const reads=requests.filter(r=>r.path==='/api/ventas');
   assert.ok(reads.every(r=>r.params.desde&&r.params.hasta),'Never issue unbounded all-time N+1 history');
   assert.equal(reads.at(-1).params.desde,'2026-10-06T00:00:00');
   assert.equal(reads.at(-1).params.hasta,'2026-11-05T23:59:59.999999');
 }],
 ['changed period never relabels stale cash or old return candidates',async()=>{
   await query('2026-11-05');
   const switched=useVentasCaja({localId:2,desde:'2026-11-04',hasta:'2026-11-04'});
   assert.equal(switched.hasData,false);assert.deepEqual(switched.ventasParaDevolver,[]);assert.deepEqual(switched.devoluciones,[]);
 }],
]); } finally { globalThis.Date=RealDate; }

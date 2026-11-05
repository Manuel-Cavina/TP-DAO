import {assert,load,runtime,nodes,byName,textOf,run} from './harness.mjs';
const locations=[{id:1,tipo:'CD',activo:true,nombre:'Destino'},{id:2,tipo:'CD',activo:true,nombre:'Origen'}];
const products=[{id:1,nombre:'Aceite',codigo:'ACE'},{id:2,nombre:'Arroz',codigo:'ARR'}];
const drawerPath='frontend/src/modules/ubicaciones_stock/components/RestockCdDrawer.jsx';
function drawer(mode='proveedor',quantity='10',props={}){
 let mutations=[];
 const rt=runtime(['1',quantity,false,'','']);
 const component=load(drawerPath,{
   '../../catalogo/hooks/useProveedores':{useProveedores:()=>({proveedores:[{id:1}]})},
   '../../catalogo/hooks/useProductos':{useProductos:()=>({productos:products})},
   '../hooks/useUbicaciones':{useUbicaciones:()=>({ubicaciones:locations})},
   '../services':{stockService:{ingresoCD:async dto=>mutations.push(dto)}},
 },rt);
 const allProps={open:true,cdId:1,onClose:()=>{},stockPorProducto:new Map([[1,{disponible:300,demandaSedes:20}],[2,{disponible:500,demandaSedes:600}]]),...props};
 return {component,rt,mutations,render:()=>component.render('RestockCdDrawer',allProps),tree:component.render('RestockCdDrawer',allProps)};
}
async function submit(test){const original=setTimeout;globalThis.setTimeout=()=>0;try{await nodes(test.tree).find(n=>textOf(n).trim()==='Confirmar ingreso al CD').props.onClick();}finally{globalThis.setTimeout=original;}}
await run([
 ['unsupported interCD is not offered as a transaction',()=>{const d=drawer('inter_cd');assert.equal(nodes(d.tree).find(n=>textOf(n).trim()==='Otra Casa Central'),undefined);assert.match(textOf(d.tree),/transferencias entre centros no están disponibles/i);}],
 ['fractional units do not silently mutate integer stock',async()=>{const d=drawer('proveedor','1.5');await submit(d);assert.equal(d.mutations.length,0,'Silently posted '+JSON.stringify(d.mutations));}],
 ['header-open projection uses selected product real stock',()=>{
   const stock=load('frontend/src/modules/ubicaciones_stock/pages/StockPage.jsx',{
     'react-router-dom':{useNavigate:()=>()=>{}},
     '../../../app/providers/SedeProvider':{useSede:()=>({sede:{id:1,tipo:'CD',nombre:'Destino'},sedeId:1})},
     '../hooks/useUbicaciones':{useUbicaciones:()=>({ubicaciones:locations})},
     '../hooks/useStockMatriz':{useStockMatriz:()=>({stocks:[{id:1,productoId:1,disponible:300,enTransito:0,nivelMinimo:10}]})},
     '../hooks/useAlertasStock':{useAlertasStock:()=>({alertas:[]})},
     '../../catalogo/hooks/useProductos':{useProductos:()=>({productos:products})},
     '../../logistica/hooks/useNecesidades':{useNecesidades:()=>({necesidades:[]})},
   });
   const props=byName(stock.render('StockPage'),'RestockCdDrawer').props;
   const d=drawer('proveedor','10',props);
   assert.match(textOf(d.tree),/300\s+u\./,'Real Aceite stock300 is absent from header drawer projection');
 }],
 ['projection follows changed product and its demand',()=>{
   const d=drawer();const productSelect=nodes(d.tree).find(n=>n.props.ariaLabel==='Artículo del ingreso');productSelect.props.onChange('2');
   const text=textOf(d.render());assert.match(text,/500\s+u\./);assert.match(text,/510 u\. \(\+10\)/);assert.match(text,/600\s+u\./);assert.doesNotMatch(text,/300\s+u\./);
 }],
 ['loading and failed stock block ingress with explicit state',async()=>{
   for(const props of [{stockLoading:true},{stockError:new Error('offline')},{stockStale:true}]){
     const d=drawer('proveedor','10',props);const button=nodes(d.tree).find(n=>textOf(n).trim()==='Confirmar ingreso al CD');assert.equal(button.props.disabled,true);assert.ok(nodes(d.tree).some(n=>n.type?.name==='Alert'));await submit(d);assert.equal(d.mutations.length,0);
   }
 }],
 ['only exact positive safe integers reach ingress API',async()=>{
   for(const quantity of ['','0','-1','NaN','Infinity','9007199254740992']){const d=drawer('proveedor',quantity);await submit(d);assert.equal(d.mutations.length,0);}
   const d=drawer('proveedor','12');await submit(d);assert.equal(d.mutations[0].cantidad,12);
 }],
]);

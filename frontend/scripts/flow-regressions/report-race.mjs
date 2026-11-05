import {assert,load,runtime,byName,run} from './harness.mjs';
await run(['stock','mermas'].map(report=>[
 `actual live ${report} detail preserves latest selected entity`,async()=>{
  const pending=new Map(),initial=[];
  initial[2]={[report]:true}; initial[5]={[report]:{filas:[]}};
  const page=load('frontend/src/modules/reportes/pages/ReportesPage.jsx',{
    'react-router-dom':{useNavigate:()=>()=>{},useLocation:()=>({pathname:'/reportes/'+report})},
    '../services/reportesUnifiedService':{presets:{hace30Dias:()=>'',hoy:()=>''}},
    '../services/reportesService':{reportesService:{
      getR1DrillDown:id=>new Promise(resolve=>pending.set(id,resolve)),
      getR2DrillDown:id=>new Promise(resolve=>pending.set(id,resolve)),
    }},
  },runtime(initial));
  const render=()=>page.render('ReportesPage',{initialReport:report});
  let tree=render();
  const handlerName=report==='stock'?'onOpenStockDrillDown':'onOpenMermaDrillDown';
  const modalName=report==='stock'?'ModalFichaStock':'ModalAuditoriaMerma';
  const a=byName(tree,'ReportesTableView').props[handlerName](1);
  tree=render(); byName(tree,modalName).props.onClose();
  tree=render(); const b=byName(tree,'ReportesTableView').props[handlerName](2);
  pending.get(2)({entity:2}); await b; pending.get(1)({entity:1}); await a;
  const modal=byName(render(),modalName);
  const selected=modal.props[report==='stock'?'productoId':'bultoId'];
  assert.equal(modal.props.data.entity,selected);
 }
]));

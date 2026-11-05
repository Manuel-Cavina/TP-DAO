import {assert,load,runtime,byName,run} from './harness.mjs';
await run([
 ['supplier Todos must query inactive records too',()=>{
   let params;
   const page=load('frontend/src/modules/catalogo/pages/ProveedoresPage.jsx',{
     '../hooks/useProveedores':{useProveedores:p=>{params=p;return{proveedores:[]};}},
     '../../../shared/hooks':{useDisclosure:()=>({})},
   },runtime(['todos','']));
   page.render('ProveedoresPage'); assert.equal(params.activos,false);
 }],
 ['missing per-location minimum must not become invented1',()=>{
   const {mapProductoToUI}=load('frontend/src/modules/catalogo/mappers/catalogoMappers.js').exports;
   const product=mapProductoToUI({id:1,precio_venta:'150',costo_unitario:'100',activo:true});
   assert.ok(product.nivelMinimo==null,'No minimum is published by Producto_DTO; expected unknown, actual '+product.nivelMinimo);
 }],
]);

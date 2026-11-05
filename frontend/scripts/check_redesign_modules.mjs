import { assert, load, runtime, nodes, byName, textOf, run } from './flow-regressions/harness.mjs';

const products = [{ id: 1, codigo: 'ACE', nombre: 'Aceite' }, { id: 2, codigo: 'ARR', nombre: 'Arroz' }];
const locations = [{ id: 1, tipo: 'CD', activo: true, nombre: 'CD destino' }];
function drawer(quantity = '10', props = {}) {
  const mutations = [];
  const component = load('frontend/src/modules/ubicaciones_stock/components/RestockCdDrawer.jsx', {
    '../../catalogo/hooks/useProductos': { useProductos: () => ({ productos: products }) },
    '../hooks/useUbicaciones': { useUbicaciones: () => ({ ubicaciones: locations }) },
    '../services': { stockService: { ingresoCD: async dto => mutations.push(dto) } },
  }, runtime(['1', quantity, false, '', '']));
  const allProps = { open: true, cdId: 1, onClose() {}, stockPorProducto: new Map([[1, { disponible: 300, demandaSedes: 20 }], [2, { disponible: 500, demandaSedes: 600 }]]), ...props };
  return { mutations, render: () => component.render('RestockCdDrawer', allProps) };
}
function sales(tab) {
  const component = load('frontend/src/modules/ventas_caja/pages/VentasCajaPage.jsx', {
    'react-router-dom': { useSearchParams: () => [new URLSearchParams({ tab }), () => {}] },
    '../../../app/providers/SedeProvider': { useSede: () => ({ sede: { tipo: 'LOCAL', value: 2 }, sedeId: 2, sedes: [{ tipo: 'LOCAL', value: 2, label: 'Local Norte' }], setSedeId() {} }) },
    '../../../shared/hooks': { useDisclosure: () => ({ open: false, onClose() {}, onOpen() {} }) },
    '../hooks/useVentasCaja': { useVentasCaja: () => ({ ventas: [], devoluciones: [], ventasParaDevolver: [], devolucionesPrevias: [], caja: { saldo: 0, totalVentas: 0, totalDevoluciones: 0 }, hasData: true }) },
    '../../catalogo': { useProductos: () => ({ productos: [] }) },
    '../../ubicaciones_stock': { useStockMatriz: () => ({ stocks: [] }) },
  });
  return component.render('VentasCajaPage');
}

await run([
  ['supplier filters query and display active, inactive and all records honestly', () => {
    for (const [filter, expectedIds] of [['activos', [1]], ['inactivos', [2]], ['todos', [1, 2]]]) {
      let query;
      const page = load('frontend/src/modules/catalogo/pages/ProveedoresPage.jsx', {
        '../hooks/useProveedores': { useProveedores: params => { query = params; return { proveedores: [{ id: 1, cuit: '1', razonSocial: 'Activo', activo: true }, { id: 2, cuit: '2', razonSocial: 'Inactivo', activo: false }] }; } },
        '../../../shared/hooks': { useDisclosure: () => ({}) },
      }, runtime(['', filter]));
      const tree = page.render('ProveedoresPage');
      assert.equal(query.activos, filter === 'activos');
      assert.deepEqual(byName(tree, 'SortableDataTable').props.data.map(item => item.id), expectedIds);
    }
  }],
  ['catalog minimum preserves unknown, zero and known values without inventing one', () => {
    const { mapProductoToUI } = load('frontend/src/modules/catalogo/mappers/catalogoMappers.js').exports;
    for (const value of [undefined, null, '', 'invalid']) assert.equal(mapProductoToUI({ nivel_minimo: value }).nivelMinimo, null);
    assert.equal(mapProductoToUI({ nivel_minimo: 0 }).nivelMinimo, 0);
    assert.equal(mapProductoToUI({ nivel_minimo: '7' }).nivelMinimo, 7);
  }],
  ['POS puts selling first, without cash-period or KPI chrome', () => {
    const tree = sales('pos');
    assert.ok(byName(tree, 'PosTerminal'));
    assert.doesNotMatch(textOf(tree), /Período de caja|Saldo neto de caja|Registrar devolución/);
    assert.equal(nodes(tree).filter(node => node.type === 'h1').length, 1);
  }],
  ['cash and returns retain movement periods and original receipt context', () => {
    assert.match(textOf(sales('facturas')), /Período de caja/);
    assert.equal(nodes(sales('facturas')).filter(node => node.type?.name === 'MetricCard').length, 3);
    assert.match(textOf(sales('devoluciones')), /comprobante original.*cantidades pendientes/);
    assert.ok(byName(sales('devoluciones'), 'DevolucionModal'));
  }],
  ['CD ingress no longer collects ignored purchase or supplier evidence', () => {
    const tree = drawer().render();
    assert.match(textOf(tree), /No registra una compra ni un comprobante/);
    assert.doesNotMatch(textOf(tree), /Datos del proveedor|Otra Casa Central/);
    assert.match(textOf(tree), /300\s+u\./);
    assert.match(textOf(tree), /310 u\. \(\+10\)/);
  }],
  ['projection follows the selected product, not the opening row', () => {
    const d = drawer();
    nodes(d.render()).find(node => node.props.ariaLabel === 'Artículo del ingreso').props.onChange('2');
    assert.match(textOf(d.render()), /510 u\. \(\+10\)/);
    assert.match(textOf(d.render()), /600\s+u\./);
  }],
  ['only exact positive units and fresh known stock can submit', async () => {
    for (const [quantity, props] of [['1.5', {}], ['0', {}], ['Infinity', {}], ['9007199254740992', {}], ['12', { stockStale: true }], ['12', { stockLoading: true }], ['12', { stockError: new Error('offline') }]]) {
      const d = drawer(quantity, props);
      const button = nodes(d.render()).find(node => textOf(node).trim() === 'Confirmar ingreso al CD');
      assert.equal(button.props.disabled, true);
      await button.props.onClick();
      assert.equal(d.mutations.length, 0);
    }
    const d = drawer('12');
    const original = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;
    try { await nodes(d.render()).find(node => textOf(node).trim() === 'Confirmar ingreso al CD').props.onClick(); }
    finally { globalThis.setTimeout = original; }
    assert.deepEqual(d.mutations, [{ producto_id: 1, cd_id: 1, cantidad: 12 }]);
  }],
  ['generated reports keep applied scope separate from edited draft filters', () => {
    const applied = { desde: '2026-10-01', hasta: '2026-10-31', localId: '2' };
    const report = load('frontend/src/modules/reportes/pages/ReportesPage.jsx', {
      'react-router-dom': { useNavigate: () => () => {}, useLocation: () => ({ pathname: '/reportes/ventas' }) },
      '../services/reportesUnifiedService': { presets: { hace30Dias: () => '2026-10-01', hoy: () => '2026-10-31' } },
    }, runtime(['ventas', '30d', { ventas: true }, { ...applied, localId: '3' }, { ventas: applied }, { ventas: {} }, [{ id: 2, nombre: 'Local aplicado' }, { id: 3, nombre: 'Local borrador' }], []]));
    const tree = report.render('ReportesPage', {});
    const scope = nodes(tree).find(node => node.props.className === 'stocky-applied-scope');
    assert.match(textOf(scope), /Local aplicado/);
    assert.doesNotMatch(textOf(scope), /Local borrador/);
    assert.match(textOf(scope), /2026-10-01\s+al\s+2026-10-31/);
    assert.match(textOf(scope), /Filtros nuevos sin aplicar/);
  }],
  ['stale report detail errors and completion cannot replace the active entity', async () => {
    for (const report of ['stock', 'mermas']) {
      const pending = new Map();
      const initial = []; initial[2] = { [report]: true }; initial[5] = { [report]: { filas: [] } };
      const request = id => new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      const page = load('frontend/src/modules/reportes/pages/ReportesPage.jsx', {
        'react-router-dom': { useNavigate: () => () => {}, useLocation: () => ({ pathname: `/reportes/${report}` }) },
        '../services/reportesUnifiedService': { presets: { hace30Dias: () => '', hoy: () => '' } },
        '../services/reportesService': { reportesService: { getR1DrillDown: request, getR2DrillDown: request } },
      }, runtime(initial));
      const render = () => page.render('ReportesPage', { initialReport: report });
      const modalName = report === 'stock' ? 'ModalFichaStock' : 'ModalAuditoriaMerma';
      const handlerName = report === 'stock' ? 'onOpenStockDrillDown' : 'onOpenMermaDrillDown';
      const first = byName(render(), 'ReportesTableView').props[handlerName](1);
      byName(render(), modalName).props.onClose();
      const second = byName(render(), 'ReportesTableView').props[handlerName](2);
      pending.get(1).reject(new Error('obsolete failure')); await first;
      assert.equal(byName(render(), modalName).props.loading, true);
      assert.equal(byName(render(), modalName).props.error, null);
      pending.get(2).resolve({ entity: 2 }); await second;
      const modal = byName(render(), modalName);
      assert.equal(modal.props.data.entity, 2);
      assert.equal(modal.props.loading, false);
    }
  }],
]);

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthProvider";
import { Alert, Badge, Button, Modal, Select } from "../../shared";
import { useUbicaciones } from "../../modules/ubicaciones_stock/hooks/useUbicaciones";
import { useRemitos } from "../../modules/logistica/hooks/useRemitos";

function WorkCard({ remito, tone, title, description, actionLabel, onOpen }) {
  return <article className="card mobile-card-gap">
    <div className="row justify-between align-center"><Badge tone={tone}>{tone === "warning" ? "En tránsito" : tone === "info" ? "Recibido" : "Listo para cierre"}</Badge><span className="micro font-mono">{remito.numero}</span></div>
    <h2 className="mobile-card-title">{title}: {remito.numero}</h2>
    <p>{description}</p>
    <Button className="w-full" onClick={onOpen}>{actionLabel}</Button>
  </article>;
}

export function OperatorDashboardPage() {
  const navigate = useNavigate();
  const { user, scope, logout } = useAuth();
  const { ubicaciones, loading: loadingLocations, error: locationsError, reload: reloadLocations } = useUbicaciones();
  const { remitos, loading: loadingRemitos, error: remitosError, reload: reloadRemitos } = useRemitos();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const loading = loadingRemitos || loadingLocations;
  const loadError = remitosError || locationsError;
  const reload = () => { reloadLocations(); reloadRemitos(); };
  const isAdmin = user?.role === "ADMIN";
  const authorisedIds = useMemo(() => scope?.authorised_branch_ids || scope?.branch_ids || [], [scope]);
  const branches = useMemo(() => {
    const locales = ubicaciones.filter((item) => item.tipo === "LOCAL" || !item.tipo);
    if (isAdmin) return locales.length ? locales : ubicaciones;
    return locales.filter((item) => authorisedIds.some((id) => String(id) === String(item.id)));
  }, [ubicaciones, isAdmin, authorisedIds]);
  useEffect(() => {
    if (!branches.some((branch) => String(branch.id) === selectedBranchId)) setSelectedBranchId(branches[0] ? String(branches[0].id) : "");
  }, [branches, selectedBranchId]);
  const local = branches.find((branch) => String(branch.id) === String(selectedBranchId));
  const reportingCd = useMemo(() => ubicaciones.find((item) => item.id === scope?.reporting_cd_id)?.nombre || ubicaciones.find((item) => item.tipo === "CD")?.nombre || "Centro de distribución sin informar", [scope, ubicaciones]);
  const userName = user?.displayName || user?.name || "Operador";
  const initials = userName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const work = useMemo(() => {
    const relevant = selectedBranchId ? remitos.filter((item) => String(item.destinoId) === String(selectedBranchId)) : [];
    const inTransit = relevant.filter((item) => item.estado === "DESPACHADO" || item.estado === "EN_TRANSITO");
    const pending = relevant.filter((item) => item.estado === "RECIBIDO" && (item.bultosPendientes > 0 || item.progresoOperacional?.pendientes > 0));
    const closable = relevant.filter((item) => item.estado === "RECIBIDO" && item.totalBultos > 0 && (item.bultosPendientes === 0 || item.progresoOperacional?.pendientes === 0));
    return { inTransit, pending, closable, total: inTransit.length + pending.length + closable.length };
  }, [remitos, selectedBranchId]);
  const openReception = (numero) => navigate(`/logistica/recepcion?remito=${encodeURIComponent(numero)}`);

  return <section className="screen no-shell active" id="operator"><main><div className="mobile-stage">
    <header className="mobile-top"><img src="/brand/stocky-icon.png" alt="Stocky" className="mobile-brand-icon" /><div><strong>Stocky Operaciones</strong><br /><span className="micro">Sesión de {userName} ({user?.role || "OPERADOR"})</span></div><span className="flex-1" /><Button variant="ghost" size="sm" iconLeft="bell" aria-label="Notificaciones" onClick={() => setShowNotifications((current) => !current)} /><span className="avatar">{initials}</span></header>
    <div className="mobile-body">
      <section className="mobile-context"><div className="row justify-between align-center"><div><span className="micro">Reporta a</span><br /><strong>{reportingCd}</strong></div><Button size="sm" variant="secondary" onClick={reload} disabled={loading}>Actualizar</Button></div><hr className="mobile-divider" />
        <Select label="Sucursal de trabajo" ariaLabel="Sucursal de trabajo" options={branches.map((branch) => ({ value: String(branch.id), label: `${branch.nombre} · Recepción` }))} value={selectedBranchId} onChange={setSelectedBranchId} placeholder="Sin sucursal asignada" />
        <span className="field-help">{isAdmin ? "Modo Administrador: todas las sucursales habilitadas." : "Sucursales autorizadas según asignación de turno del operador."}</span><p className="micro mobile-shift">{scope?.shift_label || "Turno no informado"}</p>
      </section>
      {showNotifications && <Alert tone={work.total ? "warning" : "info"} title="Actividad operativa" description={loadError ? "No se pudo consultar la actividad. Reintenta la carga." : work.total ? `${work.total} tarea(s) real(es) pendientes para ${local?.nombre || "la sucursal seleccionada"}.` : "No hay tareas operativas pendientes para la sucursal seleccionada."} />}
      <div className="page-head mobile-page-head"><div><h1>Mi trabajo en {local?.nombre || "la sucursal asignada"}</h1><p className="muted">{loading ? "Consultando tareas…" : loadError ? "No se pudieron actualizar las tareas" : `${work.total} acción(es) pendiente(s)`}</p></div><span className="micro">Tiempo real</span></div>
      {loadError && <Alert tone="danger" title="No se pudo cargar el trabajo" description={loadError.message} action={<Button variant="secondary" onClick={reload}>Reintentar</Button>} />}
      {!loading && !locationsError && !branches.length && <Alert tone="warning" title="Sin sucursal autorizada" description="Solicita al administrador que revise la asignación de sucursales de tu cuenta." />}
      <Button variant="secondary" onClick={() => navigate("/logistica/operaciones")}>Preparar y despachar órdenes</Button>
      {loading && <div className="card p-4 text-center" aria-live="polite">Cargando tareas pendientes…</div>}
      {!loading && !loadError && branches.length > 0 && !work.total && <div className="card p-4 text-center stack gap-2"><Badge tone="success">Al día</Badge><p className="font-medium text-sm">Sin tareas pendientes</p><p className="text-xs text-secondary">No hay remitos en tránsito ni bultos pendientes de control para {local?.nombre || "esta sucursal"}.</p></div>}
      {work.inTransit.map((remito) => <WorkCard key={remito.numero} remito={remito} tone="warning" title="Arribo pendiente" description={`Transporte hacia ${local?.nombre || "la sucursal"} · ${remito.totalBultos} bulto(s) en remito.`} actionLabel="Registrar arribo" onOpen={() => openReception(remito.numero)} />)}
      {work.pending.map((remito) => <WorkCard key={remito.numero} remito={remito} tone="info" title="Controlar precintos" description={`${remito.bultosPendientes} bulto(s) pendiente(s) de revisión física.`} actionLabel="Controlar precintos" onOpen={() => openReception(remito.numero)} />)}
      {work.closable.map((remito) => <WorkCard key={remito.numero} remito={remito} tone="success" title="Cerrar e impactar" description={`Todos los ${remito.totalBultos} bultos fueron controlados.`} actionLabel="Cerrar remito e impactar stock" onOpen={() => openReception(remito.numero)} />)}
      <Alert tone="info" title="Alcance de trabajo" description="El operador visualiza centro de reporte, sucursal autorizada, turno asignado y una acción primaria por tarea." />
    </div>
    <nav className="mobile-nav" aria-label="Navegación del operador"><button type="button" className="active">Trabajo</button><button type="button" onClick={() => navigate("/logistica/trazabilidad")}>Escanear</button><button type="button" onClick={() => navigate("/logistica/trazabilidad")}>Historial</button><button type="button" onClick={() => setShowAccount(true)}>Cuenta</button></nav>
    <Modal open={showAccount} onClose={() => setShowAccount(false)} title="Mi cuenta">
      <div className="stack gap-3"><p>{userName} · {user?.login}</p><p className="text-sm">{scope?.shift_label || "Turno no informado"}</p><Button onClick={async () => { await logout(); navigate("/login", { replace: true }); }}>Cerrar sesión</Button></div>
    </Modal>
  </div></main></section>;
}

export default OperatorDashboardPage;

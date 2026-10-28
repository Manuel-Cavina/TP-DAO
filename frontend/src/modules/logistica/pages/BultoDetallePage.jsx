import React, { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Modal, StatusBadge, TextInput, TextareaField, useLiveResource } from "../../../shared";
import { useProductos } from "../../catalogo";
import { logisticaService } from "../services";

const code = (id) => `BLT-${String(id).padStart(6, "0")}`;
const dateTime = (value) => value ? new Date(value).toLocaleString("es-AR") : "Sin fecha registrada";

export function BultoDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modal, setModal] = useState("");
  const [lectura, setLectura] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const { productos } = useProductos();
  const productById = useMemo(() => new Map(productos.map((producto) => [String(producto.id), producto])), [productos]);
  const load = useCallback(async () => {
    const [bulto, trazabilidad, remitosResponse] = await Promise.all([
      logisticaService.obtenerBulto(id),
      logisticaService.consultarTrazabilidad(id),
      logisticaService.listarRemitos(),
    ]);
    const remitos = Array.isArray(remitosResponse) ? remitosResponse : remitosResponse?.data || [];
    return { bulto, trazabilidad, remito: remitos.find((remito) => (remito.bultos || remito.bultos_resumen || []).some((item) => String(item.id) === String(id))) };
  }, [id]);
  const { data, error, isLoading, refresh } = useLiveResource(load, { intervalMs: 15000 });
  const bulto = data?.bulto;
  const precinto = bulto?.precinto?.codigo || bulto?.codigo_precinto || data?.trazabilidad?.codigo_precinto;
  const canVerify = bulto?.estado === "RECIBIDO";
  const eventos = data?.trazabilidad?.eventos || data?.trazabilidad?.historial || bulto?.historial || [];

  const openVerification = (type) => {
    setMutationError("");
    setLectura(precinto || "");
    setMotivo("");
    setModal(type);
  };
  const confirmVerification = async () => {
    if (modal === "incidencia" && !motivo.trim()) {
      setMutationError("Indicá el motivo de la incidencia para continuar.");
      return;
    }
    setMutating(true);
    setMutationError("");
    try {
      await logisticaService.verificarBulto(bulto.id, { codigoPrecintoRecibido: lectura, estaIntacto: modal === "intacto", motivoRechazo: motivo.trim() });
      setModal("");
      await refresh();
    } catch (requestError) {
      setMutationError(requestError?.message || "No se pudo registrar la verificación.");
    } finally {
      setMutating(false);
    }
  };

  if (isLoading && !data) return <div className="erp-section-card" aria-live="polite">Cargando bulto y trazabilidad…</div>;
  if (error && !data) return <Alert tone="danger" title="No se pudo cargar el bulto" description={error.message} action={<Button variant="secondary" size="sm" onClick={refresh}>Reintentar</Button>} />;
  if (!bulto) return <Alert tone="warning" title="Bulto no encontrado" description="El backend no devolvió un bulto para este identificador." />;

  return <div className="stack gap-5">
    {error && <Alert tone="warning" title="Datos posiblemente desactualizados" description={error.message} action={<Button variant="secondary" size="sm" onClick={refresh}>Reintentar</Button>} />}
    <div className="erp-flow-header">
      <div><div className="erp-breadcrumb"><span>Bultos</span><span>·</span><span>{code(bulto.id)}</span></div><div className="row gap-2 align-center"><h1 className="text-xl">Bulto {code(bulto.id)}</h1><StatusBadge status={bulto.estado} /></div><p className="text-sm text-secondary">{precinto ? `Precinto ${precinto}` : "Sin precinto asignado"}{data.remito ? ` · ${data.remito.numero}` : ""}{bulto.orden_id ? ` · Orden OR-${String(bulto.orden_id).padStart(6, "0")}` : ""}</p></div>
      <Button variant="secondary" onClick={() => navigate(`/logistica/trazabilidad?q=${encodeURIComponent(precinto || code(bulto.id))}`)}>Ver trazabilidad</Button>
    </div>
    <div className="grid two">
      <div className="stack gap-4">
        <article className="erp-section-card"><h2 className="erp-card-title">Contenido e impacto</h2><div className="erp-table-scroll"><table className="erp-table"><thead><tr><th>Producto</th><th className="text-right">Cantidad</th><th>Situación</th></tr></thead><tbody>{(bulto.detalles || []).map((detalle) => { const producto = productById.get(String(detalle.producto_id)); return <tr key={detalle.id || detalle.producto_id}><td>{producto ? `${producto.codigo} · ${producto.nombre}` : `Producto #${detalle.producto_id}`}</td><td className="text-right">{detalle.cantidad}</td><td>{bulto.estado}</td></tr>; })}</tbody></table></div><p className="erp-callout mt-3">El impacto de stock se determina al cerrar el remito según el resultado de verificación registrado.</p></article>
        <article className="erp-section-card"><h2 className="erp-card-title">Trazabilidad</h2>{eventos.length ? <ul className="timeline">{eventos.map((evento, index) => <li key={evento.id || `${evento.fecha_hora}-${index}`}><strong>{evento.accion || evento.estado_nuevo || "Evento registrado"}</strong><br /><span className="micro">{dateTime(evento.fecha_hora)} · {evento.actor || "Sin responsable registrado"}{evento.motivo_o_evidencia ? ` · ${evento.motivo_o_evidencia}` : ""}</span></li>)}</ul> : <p className="text-sm text-secondary">El backend aún no informó eventos para este bulto.</p>}</article>
      </div>
      <aside className="erp-section-card stack gap-3"><h2 className="erp-card-title">Verificar precinto</h2><p className="text-sm text-secondary">{precinto ? <>Compará físicamente el código con <strong>{precinto}</strong>.</> : "Este bulto no tiene un precinto disponible para verificar."}</p>{canVerify ? <><Button variant="primary" onClick={() => openVerification("intacto")}>Precinto intacto</Button><Button variant="danger" onClick={() => openVerification("incidencia")}>Registrar incidencia</Button></> : <p className="erp-callout">El bulto está en estado {bulto.estado}; no admite una nueva verificación.</p>}{data.remito && <Button variant="secondary" onClick={() => navigate(`/logistica/recepcion?remito=${encodeURIComponent(data.remito.numero)}`)}>Controlar bultos del remito</Button>}</aside>
    </div>
    <Modal open={Boolean(modal)} onClose={() => !mutating && setModal("")} title={modal === "intacto" ? "Confirmar precinto intacto" : "Registrar incidencia"} subtitle={`${code(bulto.id)} · ${bulto.estado}`} isBusy={mutating} footer={<div className="row justify-between w-full"><Button variant="ghost" onClick={() => setModal("")} disabled={mutating}>Cancelar</Button><Button variant={modal === "intacto" ? "primary" : "danger"} loading={mutating} loadingLabel="Registrando…" onClick={confirmVerification}>Confirmar y registrar</Button></div>}>
      <div className="stack gap-3"><TextInput id="lectura-precinto" label="Código leído" value={lectura} onChange={(event) => setLectura(event.target.value)} required />{modal === "incidencia" && <TextareaField id="motivo-incidencia" label="Motivo de la incidencia" value={motivo} onChange={(event) => setMotivo(event.target.value)} required maxLength={250} showCount />}{mutationError && <Alert tone="danger" title="No se pudo confirmar" description={mutationError} />}</div>
    </Modal>
  </div>;
}

export default BultoDetallePage;

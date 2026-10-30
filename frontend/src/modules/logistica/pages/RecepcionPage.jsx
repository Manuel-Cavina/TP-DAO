import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { StatusBadge } from "../../../shared/components/Badge";
import { MetricCard } from "../../../shared/components/Feedback";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { Modal } from "../../../shared/components/Motion";
import { useDisclosure, useLiveResource } from "../../../shared/hooks";
import { useToast } from "../../../shared/feedback/ToastContext";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useRemitos } from "../hooks/useRemitos";
import { logisticaService } from "../services";
import { mapRemitoToUI } from "../mappers/logisticaMappers";
import { ControlPrecintosModal } from "../components/ControlPrecintosModal";
import { validateSealControl } from "../mappers/sealControl";

export function RecepcionPage({ remitoNumero, embedded = false, onChange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { ubicaciones } = useUbicaciones();
  const { remitos, reload: reloadRemitos } = useRemitos();

  const queryNumero = searchParams.get("remito");
  const effectiveNumero = remitoNumero || queryNumero;
  const [selectedNumeroFallback, setSelectedNumero] = useState(effectiveNumero || "");
  const selectedNumero = effectiveNumero || selectedNumeroFallback;
  const [listScope, setListScope] = useState("pendientes");

  const verificarModal = useDisclosure(false);
  const [targetBulto, setTargetBulto] = useState(null);
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [resultadoPrecinto, setResultadoPrecinto] = useState("");
  const estaIntacto = resultadoPrecinto === "INTACTO";
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [verifError, setVerifError] = useState("");

  const controlBatchModal = useDisclosure(false);
  const preCierreModal = useDisclosure(false);
  const [recibiendo, setRecibiendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [cierreOutcome, setCierreOutcome] = useState(null);
  const [actionError, setActionError] = useState("");

  const ubicMap = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones]);
  const remitosRecepcion = useMemo(() => remitos.filter((remito) => {
    if (listScope === "historial") return remito.estado === "CERRADO";
    if (listScope === "verificacion") return remito.estado === "RECIBIDO";
    return remito.estado === "DESPACHADO" || remito.estado === "EN_TRANSITO";
  }), [remitos, listScope]);

  useEffect(() => {
    if (effectiveNumero) {
      setSelectedNumero(effectiveNumero);
    } else if (remitosRecepcion.length > 0 && !remitosRecepcion.some((remito) => remito.numero === selectedNumero)) {
      const firstNum = remitosRecepcion[0].numero;
      setSelectedNumero(firstNum);
      if (!embedded) setSearchParams({ remito: firstNum });
    }
  }, [effectiveNumero, remitosRecepcion, selectedNumero, embedded, setSearchParams]);

  const fetchActiveRemito = useCallback(async ({ signal }) => {
      const res = await logisticaService.obtenerRemito(selectedNumero, { signal });
      const mapped = mapRemitoToUI(res);
      if (Array.isArray(res.bultos)) {
        mapped.bultosResumen = res.bultos.map((b) => ({
          id: b.id,
          ordenId: b.orden_id,
          codigo: b.codigo || `BLT-${String(b.id).padStart(4, "0")}`,
          codigoPrecinto: b.codigo_precinto || b.precinto?.codigo || null,
          estado: b.estado,
          cantidadItems: Number(b.cantidad_items) || (b.detalles || []).reduce((acc, d) => acc + (Number(d.cantidad) || 0), 0),
          detalles: b.detalles || [],
        }));
        mapped.totalBultos = mapped.bultosResumen.length;
        mapped.bultosVerificados = mapped.bultosResumen.filter((b) => b.estado === "VERIFICADO").length;
        mapped.bultosRechazados = mapped.bultosResumen.filter((b) => b.estado === "RECHAZADO").length;
        mapped.bultosPendientes = mapped.bultosResumen.filter((b) => b.estado === "RECIBIDO" || b.estado === "EN_TRANSITO").length;
      }
      return mapped;
  }, [selectedNumero]);
  const { data: activeRemito, isLoading: loadingRemito, error: errorRemito, isStale, refresh: loadActiveRemito } = useLiveResource(fetchActiveRemito, {
    resourceKey: `reception:${selectedNumero}`,
    enabled: Boolean(selectedNumero),
  });

  useEffect(() => {
    setCierreOutcome(null);
    verificarModal.onClose();
    controlBatchModal.onClose();
    preCierreModal.onClose();
    setTargetBulto(null);
  }, [selectedNumero]);

  const bultosPendientesRecibidos = useMemo(
    () => (activeRemito?.bultosResumen || []).filter((b) => b.estado === "RECIBIDO"),
    [activeRemito]
  );

  const { unidadesVerificadas, unidadesMerma } = useMemo(() => {
    let verif = 0;
    let merma = 0;
    for (const b of activeRemito?.bultosResumen || []) {
      const cant = b.cantidadItems || 0;
      if (b.estado === "VERIFICADO") verif += cant;
      else if (b.estado === "RECHAZADO") merma += cant;
    }
    return { unidadesVerificadas: verif, unidadesMerma: merma };
  }, [activeRemito]);

  const handleRecibirRemito = async () => {
    if (!selectedNumero || isStale || loadingRemito) return;
    setRecibiendo(true);
    setActionError("");
    try {
      await logisticaService.recibirRemito(selectedNumero);
      toast(`Remito ${selectedNumero} recibido en sucursal destino`);
      await loadActiveRemito();
      await reloadRemitos();
      onChange?.();
    } catch (err) {
      setActionError(err.message || "Error al recibir remito.");
    } finally {
      setRecibiendo(false);
    }
  };

  const handleOpenVerificar = (bulto) => {
    if (isStale || loadingRemito) return;
    setTargetBulto(bulto);
    setCodigoIngresado("");
    setResultadoPrecinto("");
    setMotivoRechazo("");
    setVerifError("");
    verificarModal.onOpen();
  };

  const handleSubmitVerificar = async (e) => {
    e?.preventDefault();
    if (!targetBulto || isStale || loadingRemito || !activeRemito?.bultosResumen.some((bulto) => bulto.id === targetBulto.id)) return;
    const decision = validateSealControl({ precintoEsperado: targetBulto.codigoPrecinto, precintoLeido: codigoIngresado, resultado: resultadoPrecinto, motivoRechazo });
    if (decision.error) {
      setVerifError(decision.error);
      return;
    }
    setVerificando(true);
    setVerifError("");
    try {
      await logisticaService.verificarBulto(targetBulto.id, {
        codigoPrecintoRecibido: decision.read,
        estaIntacto: !decision.rejected,
        motivoRechazo: motivoRechazo.trim(),
      });
      verificarModal.onClose();
      toast(`Control registrado para el bulto #${targetBulto.id}`);
      await loadActiveRemito();
      await reloadRemitos();
      onChange?.();
    } catch (err) {
      setVerifError(err.message || "Error al registrar la verificación del bulto.");
    } finally {
      setVerificando(false);
    }
  };

  const handleConfirmarCierreFinal = async () => {
    if (!selectedNumero || isStale || loadingRemito) return;
    setCerrando(true);
    setActionError("");
    try {
      const res = await logisticaService.cerrarRemito(selectedNumero);
      setCierreOutcome(res);
      preCierreModal.onClose();
      toast(`Remito ${selectedNumero} cerrado con impacto exitoso en stock`);
      await loadActiveRemito();
      await reloadRemitos();
      onChange?.();
    } catch (err) {
      setActionError(err.message || "Error al cerrar el remito.");
    } finally {
      setCerrando(false);
    }
  };

  const isDespachado = activeRemito?.documentoEstado === "DESPACHADO";
  const isCerrado = activeRemito?.documentoEstado === "CERRADO";
  const totalBultos = activeRemito?.totalBultos || 0;
  const bultosPendientes = activeRemito?.bultosPendientes || 0;
  const canCerrarRemito = !isCerrado && totalBultos > 0 && bultosPendientes === 0 && !isStale && !loadingRemito;

  const bultoChecklistColumns = [
    {
      key: "codigo",
      header: "Bulto",
      mono: true,
      render: (_, r) => <span>{r.codigo || `BLT-${r.id}`} <span className="text-xs text-muted">(#{r.id})</span></span>,
    },
    {
      key: "codigoPrecinto",
      header: "Precinto registrado",
      mono: true,
      render: (v) => v || <span className="text-muted">Sin precinto</span>,
    },
    {
      key: "estado",
      header: "Estado",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "accion",
      header: "Control de precinto",
      align: "right",
      render: (_, r) => {
        if (r.estado === "RECIBIDO") {
          return <Button variant="primary" size="sm" iconLeft="check" onClick={() => handleOpenVerificar(r)}>Controlar precinto</Button>;
        }
        if (r.estado === "VERIFICADO") return <span className="text-xs text-success font-medium">Precinto intacto (conforme)</span>;
        if (r.estado === "RECHAZADO") return <span className="text-xs text-danger font-medium">Precinto violado (merma)</span>;
        return <span className="text-xs text-muted">Arribo pendiente</span>;
      },
    },
  ];

  return (
    <div className="stack gap-5">
      {loadingRemito && !activeRemito && <div role="status" className="erp-callout">Cargando el remito seleccionado…</div>}
      {isStale && activeRemito && <div role="alert" className="erp-callout">Datos sin confirmar. Actualice el remito antes de continuar. <Button variant="secondary" size="sm" onClick={loadActiveRemito}>Actualizar</Button></div>}
      {!embedded && <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span className="cursor-pointer text-secondary" onClick={() => navigate("/logistica/recepcion")}>Recepción</span>
            <span>·</span>
            <span>Recepción y verificación en destino</span>
          </div>
          <h1 className="text-xl">Recepción multi-bulto y control de precintos</h1>
        </div>
        {activeRemito?.bultosResumen?.[0]?.ordenId && (
          <Button variant="ghost" size="sm" iconLeft="arrow-left" onClick={() => navigate(`/logistica/ordenes/${activeRemito.bultosResumen[0].ordenId}?tab=recepcion`)}>
            Volver a la orden
          </Button>
        )}
      </div>}

      {!embedded && <SegmentedControl
        value={listScope}
        onChange={setListScope}
        options={[
          { value: "pendientes", label: "Pendientes de recibir", count: remitos.filter((r) => r.estado === "DESPACHADO" || r.estado === "EN_TRANSITO").length },
          { value: "verificacion", label: "En verificación", count: remitos.filter((r) => r.estado === "RECIBIDO").length },
          { value: "historial", label: "Historial", count: remitos.filter((r) => r.estado === "CERRADO").length },
        ]}
      />}

      {!embedded && <div className="card p-4 row justify-between align-center wrap gap-3">
        <div className="flex-1 min-w-64">
          <FormField label="Remito en tránsito o recibido a procesar">
            <Select
              options={remitosRecepcion.map((r) => ({
                value: r.numero,
                label: `Remito ${r.numero} · Destino: ${ubicMap.get(r.destinoId) || `#${r.destinoId}`} (${r.estado})`,
              }))}
              value={selectedNumero}
              onChange={(val) => { setSelectedNumero(val); setSearchParams({ remito: val }); }}
              placeholder="Seleccionar remito de traslado"
            />
          </FormField>
        </div>
        {activeRemito && (
          <div className="row gap-4 align-center pt-2">
            <div><span className="text-xs text-muted block">Origen (CD)</span><span className="text-sm font-medium">{ubicMap.get(activeRemito.origenId) || `CD #${activeRemito.origenId}`}</span></div>
            <div><span className="text-xs text-muted block">Destino (Local)</span><span className="text-sm font-medium">{ubicMap.get(activeRemito.destinoId) || `Local #${activeRemito.destinoId}`}</span></div>
            <div><span className="text-xs text-muted block">Documento</span><StatusBadge status={activeRemito.documentoEstado} /></div>
          </div>
        )}
      </div>}

      {actionError && <div className="p-3 rounded bg-danger-subtle text-danger text-sm">{actionError}</div>}
      {errorRemito && <div role="alert" className="p-3 rounded bg-danger-subtle text-danger text-sm">{errorRemito.message || "No se pudo cargar el remito."}<Button variant="secondary" size="sm" onClick={loadActiveRemito}>Reintentar</Button></div>}

      {cierreOutcome && (
        <div className="card p-4 bg-success-subtle border-success stack gap-2">
          <h2 className="text-md text-success">Remito cerrado exitosamente</h2>
          <div className="grid-4 gap-3 text-sm">
            <div><span className="text-xs text-muted block">Bultos verificados</span><span className="text-lg font-medium text-success">{cierreOutcome.bultos_verificados}</span></div>
            <div><span className="text-xs text-muted block">Bultos rechazados</span><span className="text-lg font-medium text-danger">{cierreOutcome.bultos_rechazados}</span></div>
            <div><span className="text-xs text-muted block">Unidades acreditadas a stock</span><span className="text-lg font-medium text-success">{cierreOutcome.unidades_acreditadas} u.</span></div>
            <div><span className="text-xs text-muted block">Unidades registradas merma</span><span className="text-lg font-medium text-danger">{cierreOutcome.unidades_merma} u.</span></div>
          </div>
        </div>
      )}

      {isDespachado && (
        <div className="card p-4 row justify-between align-center bg-surface-muted wrap gap-3">
          <div>
            <h2 className="text-md">Mercadería en tránsito hacia la sucursal</h2>
            <p className="text-sm text-secondary">Registre el arribo del transporte a la sucursal destino para descargar y habilitar el control de precintos.</p>
          </div>
          <Button variant="primary" iconLeft="package" disabled={isStale || loadingRemito} onClick={handleRecibirRemito} loading={recibiendo} loadingLabel="Registrando arribo...">
            Registrar recepción en local
          </Button>
        </div>
      )}

      {activeRemito && (
        <>
          <div className="grid-4 gap-3">
            <MetricCard label="Total bultos en remito" value={activeRemito.totalBultos} subtext="En este envío" />
            <MetricCard label="Bultos verificados" value={activeRemito.bultosVerificados} subtext="Acreditarán stock vendible" badgeTone={activeRemito.bultosVerificados > 0 ? "success" : "neutral"} />
            <MetricCard label="Bultos rechazados" value={activeRemito.bultosRechazados} subtext="Registrarán merma formal" badgeTone={activeRemito.bultosRechazados > 0 ? "danger" : "neutral"} />
            <MetricCard label="Pendientes de verificación" value={activeRemito.bultosPendientes} subtext="Requieren control de precinto" badgeTone={activeRemito.bultosPendientes > 0 ? "warning" : "success"} />
          </div>

          <div className="card p-4 stack gap-3">
            <div className="row justify-between align-center wrap gap-2">
              <div>
                <h2 className="text-md">Checklist de bultos para control de precintos</h2>
                <p className="text-xs text-secondary">Verifique individualmente cada precinto contra la faja de seguridad recibida.</p>
              </div>
              <div className="row gap-3 align-center">
                <span className="text-xs text-muted">{activeRemito.bultosVerificados + activeRemito.bultosRechazados} de {activeRemito.totalBultos} controlados</span>
                {bultosPendientesRecibidos.length > 0 && (
                  <Button variant="secondary" size="sm" iconLeft="check" disabled={isStale || loadingRemito} onClick={controlBatchModal.onOpen}>
                    Controlar todos ({bultosPendientesRecibidos.length})
                  </Button>
                )}
              </div>
            </div>

            <SortableDataTable columns={bultoChecklistColumns} data={activeRemito.bultosResumen || []} rowKey="id" loading={loadingRemito} emptyTitle="Sin bultos para recibir" />
          </div>

          {!isCerrado && (
            <div className="card p-5 stack gap-3 border-t">
              <div className="row justify-between align-center wrap gap-3">
                <div className="stack gap-1 flex-1">
                  <h2 className="text-md">Cierre formal de remito e impacto de stock</h2>
                  <p className="text-sm text-secondary">La acreditación al stock disponible vendible del local o el registro de merma se efectivizan exclusivamente al cerrar el remito.</p>
                </div>
                <Button variant="primary" iconLeft="check" disabled={!canCerrarRemito || cerrando} loading={cerrando} loadingLabel="Procesando cierre..." onClick={preCierreModal.onOpen}>
                  Cerrar remito e impactar stock
                </Button>
              </div>
              {!canCerrarRemito && (
                <div className="p-3 rounded bg-warning-subtle text-sm text-secondary">
                  {isDespachado ? "El remito aún se encuentra en tránsito. Registre su arribo para continuar." : `No es posible cerrar el remito: aún quedan ${bultosPendientes} bulto(s) sin verificar o rechazar.`}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal verificacion individual */}
      <Modal
        open={verificarModal.open}
        onClose={verificarModal.onClose}
        title="Control de precinto de bulto"
        subtitle={`Bulto #${targetBulto?.id || ""} · Remito: ${activeRemito?.numero || ""}`}
        footer={
          <div className="row justify-between w-full">
            <Button variant="ghost" onClick={verificarModal.onClose} disabled={verificando}>Cancelar</Button>
            <Button variant={estaIntacto ? "primary" : "danger"} onClick={handleSubmitVerificar} disabled={!resultadoPrecinto || isStale} loading={verificando} loadingLabel="Registrando control...">
              {estaIntacto ? "Acreditar como verificado" : "Rechazar bulto por merma"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitVerificar} className="stack gap-4">
          {verifError && <div className="p-3 rounded bg-danger-subtle text-danger text-sm">{verifError}</div>}
          <div className="p-3 rounded bg-surface-muted stack gap-1">
            <span className="text-xs text-muted">Precinto esperado según remito</span>
            <span className="font-mono text-sm font-medium">{targetBulto?.codigoPrecinto || "Sin código registrado"}</span>
          </div>
          <TextInput id="reception-seal-read" label="Código de precinto físico observado" hint="Ingrese el código de la faja física, sin copiar el esperado." mono value={codigoIngresado} onChange={(e) => setCodigoIngresado(e.target.value)} placeholder="p. ej. PRC-2026-0001" required />
          <SegmentedControl ariaLabel="Resultado de la inspección física" value={resultadoPrecinto} onChange={setResultadoPrecinto} options={[{ value: "INTACTO", label: "Intacto" }, { value: "VIOLADO", label: "Violado" }]} />
          {(resultadoPrecinto === "VIOLADO" || (codigoIngresado.trim() && targetBulto?.codigoPrecinto && codigoIngresado.trim() !== targetBulto.codigoPrecinto)) && (
            <FormField label="Motivo de rechazo" htmlFor="reception-rejection-reason" required hint="Describa el daño o anomalía observada (máx 250 caracteres).">
              <textarea id="reception-rejection-reason" className="input text-sm w-full" rows={3} maxLength={250} value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} placeholder="p. ej. Precinto cortado con faja alterada" required />
            </FormField>
          )}
          <div className="erp-callout">
            <span className="text-sm text-secondary">
              {!resultadoPrecinto ? "Seleccione el resultado después de inspeccionar físicamente el precinto." : estaIntacto && codigoIngresado.trim() === targetBulto?.codigoPrecinto ? "Bulto conforme: Al cerrar el remito, las unidades se acreditarán al stock vendible del local." : "Regla de merma: Un precinto violado o discrepante NO ingresa al stock vendible."}
            </span>
          </div>
        </form>
      </Modal>

      {/* Modal Control por Lote (T058) */}
      <ControlPrecintosModal
        disabled={isStale || loadingRemito}
        open={controlBatchModal.open}
        onClose={controlBatchModal.onClose}
        remito={activeRemito}
        bultos={bultosPendientesRecibidos}
        onSuccess={async () => {
          controlBatchModal.onClose();
          await loadActiveRemito();
          await reloadRemitos();
        }}
      />

      {/* Modal Pre-cierre y consecuencia de stock (T059) */}
      <Modal
        open={preCierreModal.open}
        onClose={preCierreModal.onClose}
        title="Confirmación de cierre e impacto de stock"
        subtitle={`Remito ${activeRemito?.numero || ""} · Destino: ${ubicMap.get(activeRemito?.destinoId) || ""}`}
        footer={
          <div className="row justify-between w-full align-center">
            <Button variant="ghost" onClick={preCierreModal.onClose} disabled={cerrando}>Cancelar</Button>
            <Button variant="primary" onClick={handleConfirmarCierreFinal} loading={cerrando} loadingLabel="Confirmando cierre...">
              Confirmar cierre e impacto
            </Button>
          </div>
        }
      >
        <div className="stack gap-4">
          <p className="text-sm text-secondary">
            Revise el balance de mercadería antes del cierre formal. Esta acción es definitiva e impactará las existencias del inventario según el control físico efectuado.
          </p>
          <div className="grid-2 gap-3">
            <div className="card p-3 bg-success-subtle border-success stack gap-1">
              <span className="text-xs text-muted block">Acreditación a stock vendible</span>
              <span className="text-xl font-medium text-success">{activeRemito?.bultosVerificados || 0} bultos</span>
              <span className="text-sm text-secondary">{unidadesVerificadas} unidades listas para venta comercial</span>
            </div>
            <div className="card p-3 bg-danger-subtle border-danger stack gap-1">
              <span className="text-xs text-muted block">Registro formal de merma</span>
              <span className="text-xl font-medium text-danger">{activeRemito?.bultosRechazados || 0} bultos</span>
              <span className="text-sm text-secondary">{unidadesMerma} unidades derivadas a merma por precinto violado</span>
            </div>
          </div>
          <div className="erp-callout">
            <span className="text-sm text-secondary">
              Consecuencia legal y contable: Las unidades conformes quedarán disponibles para caja y POS en este local. Los bultos rechazados no podrán venderse y se registrarán en la bitácora de mermas.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default RecepcionPage;

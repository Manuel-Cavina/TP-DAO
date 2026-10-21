import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";
import { MetricCard } from "../../../shared/components/Feedback";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { Switch } from "../../../shared/components/Switch";
import { Modal } from "../../../shared/components/Motion";
import { useDisclosure } from "../../../shared/hooks";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useRemitos } from "../hooks/useRemitos";
import { logisticaService } from "../services";
import { mapRemitoToUI } from "../mappers/logisticaMappers";

export function RecepcionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ubicaciones } = useUbicaciones();
  const { remitos, reload: reloadRemitos } = useRemitos();

  const queryNumero = searchParams.get("remito");
  const [selectedNumero, setSelectedNumero] = useState(queryNumero || "");

  const [activeRemito, setActiveRemito] = useState(null);
  const [loadingRemito, setLoadingRemito] = useState(false);
  const [errorRemito, setErrorRemito] = useState(null);

  // Modal de control individual de bulto
  const verificarModal = useDisclosure(false);
  const [targetBulto, setTargetBulto] = useState(null);
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [estaIntacto, setEstaIntacto] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [verifError, setVerifError] = useState("");

  // Acciones sobre remito (recibir y cerrar)
  const [recibiendo, setRecibiendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [cierreOutcome, setCierreOutcome] = useState(null);
  const [actionError, setActionError] = useState("");

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );

  // Remitos aplicables a recepcion (en transito, recibidos o cerrados)
  const remitosRecepcion = useMemo(() => {
    return remitos.filter((r) => r.estado !== "EMITIDO");
  }, [remitos]);

  // Sincronizar selectedNumero con URL o primer remito en transito
  useEffect(() => {
    if (queryNumero) {
      setSelectedNumero(queryNumero);
    } else if (!selectedNumero && remitosRecepcion.length > 0) {
      const firstNum = remitosRecepcion[0].numero;
      setSelectedNumero(firstNum);
      setSearchParams({ remito: firstNum });
    }
  }, [queryNumero, remitosRecepcion]);

  // Cargar remito seleccionado
  const loadActiveRemito = async () => {
    if (!selectedNumero) {
      setActiveRemito(null);
      return;
    }
    setLoadingRemito(true);
    setErrorRemito(null);
    try {
      const res = await logisticaService.obtenerRemito(selectedNumero);
      setActiveRemito(mapRemitoToUI(res));
    } catch (err) {
      setErrorRemito(err.message || "Error al cargar remito.");
    } finally {
      setLoadingRemito(false);
    }
  };

  useEffect(() => {
    loadActiveRemito();
    setCierreOutcome(null);
  }, [selectedNumero]);

  // Recibir remito fisicamente en destino
  const handleRecibirRemito = async () => {
    if (!selectedNumero) return;
    setRecibiendo(true);
    setActionError("");
    try {
      await logisticaService.recibirRemito(selectedNumero);
      await loadActiveRemito();
      await reloadRemitos();
    } catch (err) {
      setActionError(err.message || "Error al recibir remito.");
    } finally {
      setRecibiendo(false);
    }
  };

  // Abrir modal de verificacion para un bulto
  const handleOpenVerificar = (bulto) => {
    setTargetBulto(bulto);
    setCodigoIngresado(bulto.codigoPrecinto || "");
    setEstaIntacto(true);
    setVerifError("");
    verificarModal.onOpen();
  };

  // Confirmar verificacion individual del bulto
  const handleSubmitVerificar = async (e) => {
    e?.preventDefault();
    if (!targetBulto) return;
    if (!codigoIngresado.trim()) {
      setVerifError("Debe ingresar el código de precinto observado en la faja.");
      return;
    }

    setVerificando(true);
    setVerifError("");
    try {
      await logisticaService.verificarBulto(targetBulto.id, {
        codigoPrecintoRecibido: codigoIngresado.trim(),
        estaIntacto,
      });
      verificarModal.onClose();
      await loadActiveRemito();
      await reloadRemitos();
    } catch (err) {
      setVerifError(err.message || "Error al registrar la verificación del bulto.");
    } finally {
      setVerificando(false);
    }
  };

  // Cerrar remito e impactar stock
  const handleCerrarRemito = async () => {
    if (!selectedNumero) return;
    setCerrando(true);
    setActionError("");
    try {
      const res = await logisticaService.cerrarRemito(selectedNumero);
      setCierreOutcome(res);
      await loadActiveRemito();
      await reloadRemitos();
    } catch (err) {
      setActionError(err.message || "Error al cerrar el remito.");
    } finally {
      setCerrando(false);
    }
  };

  const isDespachado = activeRemito?.documentoEstado === "DESPACHADO";
  const isCerrado = activeRemito?.documentoEstado === "CERRADO";

  // Validacion estricta para habilitar el boton de cierre: 100% resueltos
  const totalBultos = activeRemito?.totalBultos || 0;
  const bultosPendientes = activeRemito?.bultosPendientes || 0;
  const canCerrarRemito =
    !isCerrado &&
    totalBultos > 0 &&
    bultosPendientes === 0;

  const bultoChecklistColumns = [
    {
      key: "codigo",
      header: "Bulto",
      mono: true,
      render: (_, row) => (
        <span>
          {row.codigo || `BLT-${row.id}`} <span className="text-xs text-muted">(#{row.id})</span>
        </span>
      ),
    },
    {
      key: "codigoPrecinto",
      header: "Precinto registrado",
      mono: true,
      render: (v) => v || <span className="text-muted">Sin precinto</span>,
    },
    {
      key: "estado",
      header: "Estado individual",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "accion",
      header: "Control de precinto",
      align: "right",
      render: (_, row) => {
        if (row.estado === "RECIBIDO") {
          return (
            <Button
              variant="primary"
              size="sm"
              iconLeft="check"
              onClick={() => handleOpenVerificar(row)}
            >
              Controlar precinto
            </Button>
          );
        }
        if (row.estado === "VERIFICADO") {
          return (
            <span className="text-xs text-success font-medium">
              Precinto intacto (conforme)
            </span>
          );
        }
        if (row.estado === "RECHAZADO") {
          return (
            <span className="text-xs text-danger font-medium">
              Precinto violado (merma)
            </span>
          );
        }
        return <span className="text-xs text-muted">Arribo pendiente</span>;
      },
    },
  ];

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span
              className="cursor-pointer text-secondary"
              onClick={() => navigate("/logistica/remitos")}
            >
              Distribución
            </span>
            <span>·</span>
            <span>Recepción y verificación en destino</span>
          </div>
          <h1 className="text-xl">Recepción multi-bulto y control de precintos</h1>
        </div>
      </div>

      {/* Selector de remito */}
      <div className="card p-4 row justify-between align-center wrap gap-3">
        <div className="flex-1 min-w-64">
          <FormField label="Remito en tránsito o recibido a procesar">
            <Select
              options={remitosRecepcion.map((r) => ({
                value: r.numero,
                label: `Remito ${r.numero} · Destino: ${ubicMap.get(r.destinoId) || `#${r.destinoId}`} (${r.estado})`,
              }))}
              value={selectedNumero}
              onChange={(val) => {
                setSelectedNumero(val);
                setSearchParams({ remito: val });
              }}
              placeholder="Seleccionar remito de traslado"
            />
          </FormField>
        </div>

        {activeRemito && (
          <div className="row gap-4 align-center pt-2">
            <div>
              <span className="text-xs text-muted block">Origen (CD)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(activeRemito.origenId) || `CD #${activeRemito.origenId}`}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block">Destino (Local)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(activeRemito.destinoId) || `Local #${activeRemito.destinoId}`}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block">Documento</span>
              <StatusBadge status={activeRemito.documentoEstado} />
            </div>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
          {actionError}
        </div>
      )}

      {/* Resultado formal tras el cierre */}
      {cierreOutcome && (
        <div className="card p-4 bg-success-subtle border-success stack gap-2">
          <h2 className="text-md text-success">Remito cerrado exitosamente</h2>
          <div className="grid-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted block">Bultos verificados</span>
              <span className="text-lg font-medium text-success">{cierreOutcome.bultos_verificados}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Bultos rechazados</span>
              <span className="text-lg font-medium text-danger">{cierreOutcome.bultos_rechazados}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Unidades acreditadas a stock</span>
              <span className="text-lg font-medium text-success">{cierreOutcome.unidades_acreditadas} u.</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Unidades registradas como merma</span>
              <span className="text-lg font-medium text-danger">{cierreOutcome.unidades_merma} u.</span>
            </div>
          </div>
        </div>
      )}

      {/* Paso 1: Si el remito esta DESPACHADO, boton para registrar llegada fisica */}
      {isDespachado && (
        <div className="card p-4 row justify-between align-center bg-surface-muted wrap gap-3">
          <div>
            <h2 className="text-md">Mercadería en tránsito hacia la sucursal</h2>
            <p className="text-sm text-secondary">
              Registre el arribo del transporte a la sucursal destino para descargar y habilitar
              el control de precintos de cada bulto.
            </p>
          </div>
          <Button
            variant="primary"
            iconLeft="package"
            onClick={handleRecibirRemito}
            loading={recibiendo}
            loadingLabel="Registrando arribo..."
          >
            Registrar recepción en local
          </Button>
        </div>
      )}

      {activeRemito && (
        <>
          {/* Métricas de progreso operacional */}
          <div className="grid-4 gap-3">
            <MetricCard
              label="Total bultos en remito"
              value={activeRemito.totalBultos}
              subtext="En este envío"
            />
            <MetricCard
              label="Bultos verificados"
              value={activeRemito.bultosVerificados}
              subtext="Acreditarán stock vendible"
              badgeTone={activeRemito.bultosVerificados > 0 ? "success" : "neutral"}
            />
            <MetricCard
              label="Bultos rechazados"
              value={activeRemito.bultosRechazados}
              subtext="Registrarán merma formal"
              badgeTone={activeRemito.bultosRechazados > 0 ? "danger" : "neutral"}
            />
            <MetricCard
              label="Pendientes de verificación"
              value={activeRemito.bultosPendientes}
              subtext="Requieren control de precinto"
              badgeTone={activeRemito.bultosPendientes > 0 ? "warning" : "success"}
            />
          </div>

          {/* Checklist de bultos del remito */}
          <div className="card p-4 stack gap-3">
            <div className="row justify-between align-center">
              <div>
                <h2 className="text-md">Checklist de bultos para control de precintos</h2>
                <p className="text-xs text-secondary">
                  Verifique individualmente cada precinto contra la faja de seguridad recibida.
                </p>
              </div>
              <span className="text-xs text-muted">
                {activeRemito.bultosVerificados + activeRemito.bultosRechazados} de {activeRemito.totalBultos} controlados
              </span>
            </div>

            <SortableDataTable
              columns={bultoChecklistColumns}
              data={activeRemito.bultosResumen || []}
              rowKey="id"
              loading={loadingRemito}
              emptyTitle="Sin bultos para recibir"
            />
          </div>

          {/* Sección de cierre de remito e impacto de stock */}
          {!isCerrado && (
            <div className="card p-5 stack gap-3 border-t">
              <div className="row justify-between align-center wrap gap-3">
                <div className="stack gap-1 flex-1">
                  <h2 className="text-md">Cierre formal de remito e impacto de stock</h2>
                  <p className="text-sm text-secondary">
                    Regla de acreditación: La acreditación al stock disponible vendible del local
                    o el registro de merma se efectivizan exclusivamente al momento de cerrar el remito.
                  </p>
                </div>

                <Button
                  variant="primary"
                  iconLeft="check"
                  disabled={!canCerrarRemito || cerrando}
                  loading={cerrando}
                  loadingLabel="Cerrando remito e impactando stock..."
                  onClick={handleCerrarRemito}
                >
                  Cerrar remito e impactar stock
                </Button>
              </div>

              {!canCerrarRemito && (
                <div className="p-3 rounded bg-warning-subtle text-sm text-secondary">
                  {isDespachado
                    ? "El remito aún se encuentra en tránsito. Primero debe registrar su recepción física en el local."
                    : `No es posible cerrar el remito: aún quedan ${bultosPendientes} bulto(s) sin verificar o rechazar. Todos los bultos deben tener su control individual completado para habilitar el cierre formal.`}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de verificación individual de precinto */}
      <Modal
        open={verificarModal.open}
        onClose={verificarModal.onClose}
        title="Control de precinto de bulto"
        subtitle={`Bulto #${targetBulto?.id || ""} · Remito: ${activeRemito?.numero || ""}`}
        footer={
          <div className="row justify-between w-full">
            <Button variant="ghost" onClick={verificarModal.onClose} disabled={verificando}>
              Cancelar
            </Button>
            <Button
              variant={estaIntacto ? "primary" : "danger"}
              onClick={handleSubmitVerificar}
              loading={verificando}
              loadingLabel="Registrando control..."
            >
              {estaIntacto ? "Acreditar como verificado" : "Rechazar bulto por merma"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitVerificar} className="stack gap-4">
          {verifError && (
            <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
              {verifError}
            </div>
          )}

          <div className="p-3 rounded bg-surface-muted stack gap-1">
            <span className="text-xs text-muted">Precinto esperado según remito</span>
            <span className="font-mono text-sm font-medium">
              {targetBulto?.codigoPrecinto || "Sin código registrado"}
            </span>
          </div>

          <FormField
            label="Código de precinto físico observado"
            required
            hint="Debe coincidir exactamente con el código grabado en la faja plástica."
          >
            <TextInput
              mono
              value={codigoIngresado}
              onChange={(e) => setCodigoIngresado(e.target.value)}
              placeholder="p. ej. PRC-2026-0001"
              required
            />
          </FormField>

          <Switch
            checked={estaIntacto}
            onChange={setEstaIntacto}
            label="Faja de seguridad y precinto intactos"
            description="Si la faja fue vulnerada, cortada o el precinto no coincide, marque como violado para rechazar el bulto."
          />

          <div className="erp-callout">
            <span className="text-sm text-secondary">
              {estaIntacto
                ? "Bulto conforme: Al cerrar el remito, las unidades de este bulto se acreditarán al stock vendible del local comercial."
                : "Regla de merma: Al rechazar el bulto por precinto violado, la mercadería se registrará formalmente como merma y NO se acreditará al stock vendible."}
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default RecepcionPage;

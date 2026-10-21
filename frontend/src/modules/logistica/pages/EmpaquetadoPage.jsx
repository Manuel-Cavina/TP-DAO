import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { useDisclosure } from "../../../shared/hooks";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useOrdenes } from "../hooks/useOrdenes";
import { logisticaService } from "../services";
import { mapBultoToUI } from "../mappers/logisticaMappers";
import { ConsolidarModal } from "../components/ConsolidarModal";

export function EmpaquetadoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ordenes, loading: loadingOrd, reload: reloadOrd } = useOrdenes();
  const { ubicaciones } = useUbicaciones();

  const queryOrdenId = searchParams.get("ordenId");
  const [selectedOrdenId, setSelectedOrdenId] = useState(queryOrdenId || "");

  const [bultos, setBultos] = useState([]);
  const [loadingBultos, setLoadingBultos] = useState(false);

  // Estado para armar bulto
  const [selectedProdId, setSelectedProdId] = useState("");
  const [cantidadBulto, setCantidadBulto] = useState("");
  const [creandoBulto, setCreandoBulto] = useState(false);
  const [errorBulto, setErrorBulto] = useState("");

  // Estado para precintar bulto
  const [precintoInputs, setPrecintoInputs] = useState({});
  const [precintandoId, setPrecintandoId] = useState(null);
  const [errorPrecinto, setErrorPrecinto] = useState("");

  const remitoModal = useDisclosure(false);
  const [generandoRemito, setGenerandoRemito] = useState(false);

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );

  // Ordenes en preparacion o pendientes
  const ordenesDisponibles = useMemo(() => {
    return ordenes.filter(
      (o) => o.estado === "PENDIENTE" || o.estado === "EN_PREPARACION"
    );
  }, [ordenes]);

  // Sincronizar selectedOrdenId con URL o primera disponible
  useEffect(() => {
    if (queryOrdenId) {
      setSelectedOrdenId(queryOrdenId);
    } else if (!selectedOrdenId && ordenesDisponibles.length > 0) {
      const firstId = String(ordenesDisponibles[0].id);
      setSelectedOrdenId(firstId);
      setSearchParams({ ordenId: firstId });
    }
  }, [queryOrdenId, ordenesDisponibles]);

  const activeOrden = useMemo(() => {
    return ordenes.find((o) => String(o.id) === String(selectedOrdenId)) || null;
  }, [ordenes, selectedOrdenId]);

  // Cargar bultos de la orden activa
  const loadBultos = async () => {
    if (!selectedOrdenId) return;
    setLoadingBultos(true);
    try {
      const res = await logisticaService.listarBultosPorOrden(selectedOrdenId);
      const list = Array.isArray(res) ? res : res?.data || [];
      setBultos(list.map(mapBultoToUI));
    } catch {
      setBultos([]);
    } finally {
      setLoadingBultos(false);
    }
  };

  useEffect(() => {
    loadBultos();
  }, [selectedOrdenId]);

  // Calculo de cantidades pendientes de empaquetar por articulo
  const itemsPendientes = useMemo(() => {
    if (!activeOrden?.detalles) return [];
    return activeOrden.detalles.map((det) => {
      const empaquetado = bultos.reduce((acc, b) => {
        const itemInB = b.detalles?.find((d) => d.productoId === det.productoId);
        return acc + (itemInB?.cantidad || 0);
      }, 0);
      const restante = Math.max(0, det.cantidadSolicitada - empaquetado);
      return {
        productoId: det.productoId,
        solicitado: det.cantidadSolicitada,
        empaquetado,
        restante,
      };
    });
  }, [activeOrden, bultos]);

  // Crear nuevo bulto en preparacion
  const handleCrearBulto = async (e) => {
    e.preventDefault();
    setErrorBulto("");
    const pid = Number(selectedProdId || itemsPendientes[0]?.productoId);
    const cant = Number(cantidadBulto);

    if (!pid || cant <= 0) {
      setErrorBulto("Debe indicar un producto y cantidad valida mayor a 0.");
      return;
    }

    const itemObj = itemsPendientes.find((it) => it.productoId === pid);
    if (itemObj && cant > itemObj.restante) {
      setErrorBulto(
        `La cantidad supera las unidades pendientes de empaquetar (${itemObj.restante} u.).`
      );
      return;
    }

    setCreandoBulto(true);
    try {
      await logisticaService.crearBulto(selectedOrdenId, [
        { producto_id: pid, cantidad: cant },
      ]);
      setCantidadBulto("");
      await loadBultos();
      await reloadOrd();
    } catch (err) {
      setErrorBulto(err.message || "Error al crear el bulto.");
    } finally {
      setCreandoBulto(false);
    }
  };

  // Precintar bulto con codigo unico
  const handlePrecintarBulto = async (bultoId) => {
    setErrorPrecinto("");
    const codigo = (precintoInputs[bultoId] || "").trim();
    if (!codigo) {
      setErrorPrecinto(`Debe ingresar un codigo de precinto para el bulto #${bultoId}.`);
      return;
    }

    setPrecintandoId(bultoId);
    try {
      // Registrar precinto si es nuevo
      try {
        await logisticaService.registrarPrecinto(codigo);
      } catch {
        // Puede ya existir registrado y disponible
      }
      await logisticaService.precintarBulto(bultoId, codigo);
      setPrecintoInputs((prev) => ({ ...prev, [bultoId]: "" }));
      await loadBultos();
    } catch (err) {
      setErrorPrecinto(err.message || "Error al precintar el bulto.");
    } finally {
      setPrecintandoId(null);
    }
  };

  // Generar remito con bultos precintados
  const handleEmitirRemito = async ({ numero, bultosIds }) => {
    setGenerandoRemito(true);
    try {
      const res = await logisticaService.generarRemito(selectedOrdenId, {
        numero,
        bultosIds,
      });
      remitoModal.onClose();
      await reloadOrd();
      const num = res?.numero || numero;
      navigate(`/logistica/remitos/${encodeURIComponent(num)}`);
      return { ok: true };
    } catch (err) {
      setErrorPrecinto(err.message || "Error al generar el remito.");
      return { ok: false, error: err.message };
    } finally {
      setGenerandoRemito(false);
    }
  };

  const bultosPrecintados = useMemo(
    () => bultos.filter((b) => b.estado === "PRECINTADO"),
    [bultos]
  );

  const bultoColumns = [
    { key: "id", header: "ID Bulto", mono: true },
    {
      key: "contenido",
      header: "Contenido",
      render: (_, row) => {
        const lineas = row.detalles || [];
        return (
          <div className="stack gap-1">
            {lineas.map((d) => (
              <span key={d.productoId} className="text-sm">
                Producto #{d.productoId} · {d.cantidad} u.
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "estado",
      header: "Estado",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "precinto",
      header: "Precinto / Accion",
      render: (_, row) => {
        if (row.estado === "PRECINTADO") {
          return (
            <span className="font-mono text-sm text-secondary">
              Precinto: <strong>{row.codigoPrecinto}</strong>
            </span>
          );
        }
        if (row.estado === "PREPARADO") {
          return (
            <div className="row gap-2 align-center">
              <TextInput
                size="sm"
                mono
                placeholder="Codigo precinto"
                value={precintoInputs[row.id] || ""}
                onChange={(e) =>
                  setPrecintoInputs((prev) => ({ ...prev, [row.id]: e.target.value }))
                }
              />
              <Button
                variant="primary"
                size="sm"
                loading={precintandoId === row.id}
                onClick={() => handlePrecintarBulto(row.id)}
              >
                Precintar
              </Button>
            </div>
          );
        }
        return <span className="text-xs text-muted">{row.estado}</span>;
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
              onClick={() => navigate("/logistica/ordenes")}
            >
              Distribución
            </span>
            <span>·</span>
            <span>Empaquetado y precintado</span>
          </div>
          <h1 className="text-xl">Armado y precintado de bultos por orden</h1>
        </div>

        {/* Siguiente accion: Generar remito con bultos precintados */}
        {bultosPrecintados.length > 0 && (
          <Button
            variant="primary"
            iconRight="arrow-right"
            onClick={remitoModal.onOpen}
          >
            Generar remito ({bultosPrecintados.length} bultos precintados)
          </Button>
        )}
      </div>

      {/* Selector de orden activa */}
      <div className="card p-4 row justify-between align-center wrap gap-3">
        <div className="flex-1 min-w-64">
          <FormField label="Seleccionar orden de reposición a empaquetar">
            <Select
              options={ordenesDisponibles.map((o) => ({
                value: String(o.id),
                label: `Orden #${o.id} · Destino: ${ubicMap.get(o.destinoId) || `#${o.destinoId}`} (${o.estado})`,
              }))}
              value={selectedOrdenId}
              onChange={(val) => {
                setSelectedOrdenId(val);
                setSearchParams({ ordenId: val });
              }}
              placeholder="Seleccionar orden pendiente"
            />
          </FormField>
        </div>

        {activeOrden && (
          <div className="row gap-4 align-center pt-2">
            <div>
              <span className="text-xs text-muted block">Origen (CD)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(activeOrden.origenId) || `CD #${activeOrden.origenId}`}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block">Destino (Local)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(activeOrden.destinoId) || `Local #${activeOrden.destinoId}`}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block">Estado</span>
              <StatusBadge status={activeOrden.estado} />
            </div>
          </div>
        )}
      </div>

      {errorBulto && (
        <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
          {errorBulto}
        </div>
      )}
      {errorPrecinto && (
        <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
          {errorPrecinto}
        </div>
      )}

      {/* Subflujo: Armar bulto */}
      {activeOrden && (
        <div className="grid-2 gap-4">
          {/* Panel de articulos pendientes */}
          <div className="card p-4 stack gap-3">
            <h2 className="text-md">Artículos de la orden por empaquetar</h2>
            <div className="stack gap-2">
              {itemsPendientes.map((it) => (
                <div
                  key={it.productoId}
                  className="row justify-between align-center p-3 rounded bg-surface-muted text-sm"
                >
                  <div>
                    <span className="font-mono">Producto #{it.productoId}</span>
                    <span className="text-xs text-secondary block">
                      Solicitado: {it.solicitado} u. · Empaquetado: {it.empaquetado} u.
                    </span>
                  </div>
                  <span
                    className={`tabular-nums font-medium ${
                      it.restante === 0 ? "text-success" : "text-primary"
                    }`}
                  >
                    {it.restante === 0 ? "Completado" : `${it.restante} u. pendientes`}
                  </span>
                </div>
              ))}
            </div>

            {/* Formulario para armar nuevo bulto */}
            <form onSubmit={handleCrearBulto} className="stack gap-3 pt-3 border-t">
              <span className="text-sm font-medium">Armar nuevo bulto</span>
              <div className="grid-2 gap-2">
                <FormField label="Artículo">
                  <Select
                    options={itemsPendientes
                      .filter((it) => it.restante > 0)
                      .map((it) => ({
                        value: String(it.productoId),
                        label: `Producto #${it.productoId} (${it.restante} rest.)`,
                      }))}
                    value={selectedProdId || (itemsPendientes.find((i) => i.restante > 0)?.productoId ? String(itemsPendientes.find((i) => i.restante > 0).productoId) : "")}
                    onChange={setSelectedProdId}
                    placeholder="Elegir producto"
                  />
                </FormField>
                <FormField label="Cantidad a colocar">
                  <TextInput
                    type="number"
                    min="1"
                    placeholder="Cantidad"
                    value={cantidadBulto}
                    onChange={(e) => setCantidadBulto(e.target.value)}
                  />
                </FormField>
              </div>
              <Button
                variant="secondary"
                iconLeft="package"
                onClick={handleCrearBulto}
                loading={creandoBulto}
                loadingLabel="Armando bulto..."
                disabled={itemsPendientes.every((i) => i.restante === 0)}
              >
                Crear bulto en preparación
              </Button>
            </form>
          </div>

          {/* Panel de bultos armados y precintado */}
          <div className="card p-4 stack gap-3">
            <div className="row justify-between align-center">
              <h2 className="text-md">Bultos de esta orden ({bultos.length})</h2>
              <span className="text-xs text-secondary">
                {bultosPrecintados.length} precintados
              </span>
            </div>

            <SortableDataTable
              columns={bultoColumns}
              data={bultos}
              rowKey="id"
              loading={loadingBultos}
              emptyTitle="Sin bultos creados"
              emptyDescription="Seleccione un artículo de la orden y presione Crear bulto para comenzar."
            />
          </div>
        </div>
      )}

      {/* Modal de remito restringido a esta orden */}
      {activeOrden && (
        <ConsolidarModal
          open={remitoModal.open}
          onClose={remitoModal.onClose}
          orden={activeOrden}
          bultos={bultosPrecintados}
          onSubmit={handleEmitirRemito}
          pending={generandoRemito}
        />
      )}
    </div>
  );
}

export default EmpaquetadoPage;

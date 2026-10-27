import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  SegmentedControl,
  FilterToolbar,
  SortableDataTable,
  Button,
  StatusBadge,
  MetricCard,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useSede } from "../../../app/providers/SedeProvider";
import { useRemitos } from "../hooks/useRemitos";
import { useOrdenes } from "../hooks/useOrdenes";
import { useNecesidades } from "../hooks/useNecesidades";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { ConsolidarModal } from "../components/ConsolidarModal";
import { TrazabilidadDrawer } from "../components/TrazabilidadDrawer";
import { NecesidadesTab } from "../components/NecesidadesTab";

export function LogisticaPage({ initialTab = "remitos" }) {
  const navigate = useNavigate();
  const { sedeId } = useSede();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [listScope, setListScope] = useState("activos");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    setListScope("activos");
  }, [activeTab]);

  const [search, setSearch] = useState("");
  const [selectedNecKeys, setSelectedNecKeys] = useState([]);

  const consolidarModal = useDisclosure(false);
  const trazabilidadDrawer = useDisclosure(false);

  const [selectedTrazab, setSelectedTrazab] = useState({ id: null, estado: null, precinto: null });

  const { ubicaciones } = useUbicaciones();
  const { productos } = useProductos({ activos: true });
  const { remitos, loading: loadingRem, error: errorRem, reload: reloadRem } = useRemitos();
  const { ordenes, loading: loadingOrd, error: errorOrd, reload: reloadOrd } = useOrdenes();
  const { necesidades, loading: loadingNec, error: errorNec, reload: reloadNec, consolidar, consolidarPending } = useNecesidades();

  const ubicMap = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones]);
  const productoMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const locales = useMemo(
    () => ubicaciones.filter((u) => u.tipo === "LOCAL" && u.activo),
    [ubicaciones]
  );

  const remitosRows = useMemo(() => {
    return remitos.map((r) => ({
      numero: r.numero,
      origen: ubicMap.get(r.origenId) || `Sede #${r.origenId}`,
      destino: ubicMap.get(r.destinoId) || `Sede #${r.destinoId}`,
      fecha: r.fechaEmision ? new Date(r.fechaEmision).toLocaleDateString("es-AR") : "-",
      estado: r.estado,
      bultosIds: r.bultosIds || [],
      bultosResumen: r.bultosResumen || [],
      ordenId: r.bultosResumen?.[0]?.ordenId || null,
      progresoTexto: r.progresoOperacional?.resumenTexto || `${r.totalBultos || 0} bultos`,
      totalBultos: r.totalBultos || 0,
      bultosPendientes: r.bultosPendientes || 0,
    }));
  }, [remitos, ubicMap]);

  const filteredRemitos = useMemo(() => {
    if (!search.trim()) return remitosRows;
    const q = search.toLowerCase();
    return remitosRows.filter(
      (r) => r.numero.toLowerCase().includes(q) || r.destino.toLowerCase().includes(q)
    );
  }, [remitosRows, search]);

  const remitosEnVista = useMemo(
    () => filteredRemitos.filter((remito) => listScope === "historial" ? remito.estado === "CERRADO" : remito.estado !== "CERRADO"),
    [filteredRemitos, listScope]
  );
  const ordenesEnVista = useMemo(
    () => ordenes.filter((orden) => listScope === "historial" ? orden.estado === "CERRADA" : orden.estado !== "CERRADA"),
    [ordenes, listScope]
  );

  const remitoColumns = [
    { key: "numero", header: "Número de remito", mono: true, sortable: true },
    { key: "origen", header: "Origen (CD)", sortable: true },
    { key: "destino", header: "Destino (Local)", sortable: true },
    { key: "fecha", header: "Fecha emisión" },
    {
      key: "estado",
      header: "Estado",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "progresoTexto",
      header: "Progreso bultos",
      render: (v) => <span className="text-xs text-secondary">{v}</span>,
    },
    {
      key: "acciones",
      header: "Acción principal",
      align: "right",
      sortable: false,
      render: (_, row) => (
        <div className="row gap-2 justify-end align-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(row.ordenId ? `/logistica/ordenes/${row.ordenId}?tab=despacho` : `/logistica/remitos/${encodeURIComponent(row.numero)}`)}
          >
            Ver detalle
          </Button>

          {row.estado === "EMITIDO" && (
            <Button
              variant="primary"
              size="sm"
              iconLeft="truck"
              onClick={() => navigate(row.ordenId ? `/logistica/ordenes/${row.ordenId}?tab=despacho` : `/logistica/remitos/${encodeURIComponent(row.numero)}`)}
            >
              Despachar
            </Button>
          )}

          {row.estado === "DESPACHADO" && (
            <Button
              variant="primary"
              size="sm"
              iconLeft="package"
              onClick={() => navigate(row.ordenId ? `/logistica/ordenes/${row.ordenId}?tab=recepcion` : `/logistica/recepcion?remito=${encodeURIComponent(row.numero)}`)}
            >
              Gestionar recepción
            </Button>
          )}

          {row.bultosResumen?.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const firstB = row.bultosResumen[0];
                setSelectedTrazab({
                  id: firstB.id,
                  estado: firstB.estado,
                  precinto: firstB.codigoPrecinto || "Sin asignar",
                });
                trazabilidadDrawer.onOpen();
              }}
            >
              Trazabilidad
            </Button>
          )}
        </div>
      ),
    },
  ];

  const ordenColumns = [
    { key: "id", header: "ID Orden", mono: true, sortable: true },
    {
      key: "origenId",
      header: "Origen (CD)",
      render: (v) => ubicMap.get(v) || `#${v}`,
    },
    {
      key: "destinoId",
      header: "Destino (Local)",
      render: (v) => ubicMap.get(v) || `#${v}`,
    },
    {
      key: "estado",
      header: "Estado",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "detalles",
      header: "Renglones",
      render: (v) => <span className="tabular-nums">{v?.length || 0} ítems</span>,
    },
    {
      key: "acciones",
      header: "Acción",
      align: "right",
      sortable: false,
      render: (_, row) => (
        <div className="row gap-2 justify-end align-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/logistica/ordenes/${row.id}`)}
          >
            Ver orden
          </Button>
          {(row.estado === "PENDIENTE" || row.estado === "EN_PREPARACION") && (
            <Button
              variant="primary"
              size="sm"
              iconLeft="package"
              onClick={() => navigate(`/logistica/ordenes/${row.id}?tab=empaque`)}
            >
              Empaquetar
            </Button>
          )}
        </div>
      ),
    },
  ];

  const pageTitle = activeTab === "ordenes" ? "Distribución de órdenes" : activeTab === "necesidades" ? "Reposición pendiente" : "Remitos y despacho";
  const pageSubtitle = activeTab === "ordenes" ? "Órdenes activas e historial por destino" : activeTab === "necesidades" ? "Necesidades que aún no se convirtieron en una orden" : "Emisión, tránsito e historial de remitos";

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Logística y distribución</span>
            <span>·</span>
            <span>{pageSubtitle}</span>
          </div>
          <h1 className="text-xl">{pageTitle}</h1>
        </div>
        <div className="row gap-2">
          <Button
            variant="primary"
            iconLeft="plus"
            onClick={() => navigate("/logistica/ordenes/nueva")}
          >
            Nueva orden
          </Button>
        </div>
      </div>

      <div className="grid-4 gap-3">
        <MetricCard
          label="Remitos emitidos"
          value={remitos.length}
          subtext="Histórico total"
        />
        <MetricCard
          label="En tránsito"
          value={remitos.filter((r) => r.estado === "EN_TRANSITO" || r.estado === "DESPACHADO").length}
          subtext="Hacia locales"
          badgeTone="warning"
        />
        <MetricCard
          label="Órdenes de reposición"
          value={ordenes.length}
          subtext="Total registradas"
        />
        <MetricCard
          label="Necesidades pendientes"
          value={necesidades.length}
          subtext="Disparadas por Observer"
          badgeTone={necesidades.length > 0 ? "danger" : "success"}
        />
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "remitos", label: "Remitos y despacho", count: remitos.length },
            { value: "ordenes", label: "Órdenes de reposición", count: ordenes.length },
            { value: "necesidades", label: "Necesidades pendientes", count: necesidades.length },
          ]}
        />
        {activeTab === "remitos" && (
          <FilterToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por número o destino..."
          />
        )}
      </div>

      {activeTab !== "necesidades" && (
        <SegmentedControl
          value={listScope}
          onChange={setListScope}
          options={[
            { value: "activos", label: activeTab === "remitos" ? "En gestión" : "Activas", count: activeTab === "remitos" ? remitos.filter((r) => r.estado !== "CERRADO").length : ordenes.filter((o) => o.estado !== "CERRADA").length },
            { value: "historial", label: "Historial", count: activeTab === "remitos" ? remitos.filter((r) => r.estado === "CERRADO").length : ordenes.filter((o) => o.estado === "CERRADA").length },
          ]}
        />
      )}

      {activeTab === "remitos" && (
        <SortableDataTable
          columns={remitoColumns}
          data={remitosEnVista}
          rowKey="numero"
          loading={loadingRem}
          error={errorRem}
          onRetry={reloadRem}
          emptyTitle="Sin remitos generados"
          emptyDescription="Cree una orden de reposición, empaquete los bultos y emita un remito para comenzar el despacho."
        />
      )}

      {activeTab === "ordenes" && (
        <SortableDataTable
          columns={ordenColumns}
          data={ordenesEnVista}
          rowKey="id"
          loading={loadingOrd}
          error={errorOrd}
          onRetry={reloadOrd}
          emptyTitle="Sin órdenes de reposición"
          emptyDescription="Cree una nueva orden en 3 pasos para abastecer un local destino."
        />
      )}

      {activeTab === "necesidades" && (
        <NecesidadesTab
          necesidades={necesidades}
          loading={loadingNec}
          error={errorNec}
          onRetry={reloadNec}
          locales={locales}
          ubicMap={ubicMap}
          productoMap={productoMap}
          navigate={navigate}
          selectedKeys={selectedNecKeys}
          onSelectionChange={setSelectedNecKeys}
        />
      )}

      <ConsolidarModal
        open={consolidarModal.open}
        onClose={consolidarModal.onClose}
        locales={ubicaciones}
        cdId={sedeId}
        onSubmit={async (dto) => {
          const res = await consolidar(dto);
          if (res?.ok) reloadOrd();
          return res;
        }}
        pending={consolidarPending}
      />

      <TrazabilidadDrawer
        open={trazabilidadDrawer.open}
        onClose={trazabilidadDrawer.onClose}
        bultoId={selectedTrazab.id}
        bultoEstado={selectedTrazab.estado}
        precintoCodigo={selectedTrazab.precinto}
      />
    </div>
  );
}

export default LogisticaPage;

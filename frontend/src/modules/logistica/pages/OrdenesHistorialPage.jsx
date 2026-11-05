import "../logistics-workbench.css";
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  MetricCard,
  SortableDataTable,
  StatusBadge,
  Select,
  TextInput,
  Icon,
} from "../../../shared";
import { useOrdenes } from "../hooks/useOrdenes";
import { useRemitos } from "../hooks/useRemitos";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { useAuth } from "../../../app/auth/AuthProvider";

export function OrdenesHistorialPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ordenes, loading: loadingOrd, reload: reloadOrd } = useOrdenes();
  const { remitos, loading: loadingRem } = useRemitos();
  const { ubicaciones } = useUbicaciones();
  const { productos } = useProductos({ activos: false });

  // Estados de filtros inteligentes
  const [search, setSearch] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );

  const prodMap = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos]
  );

  const remitosByOrden = useMemo(() => {
    const map = new Map();
    for (const r of remitos) {
      if (r.ordenId) {
        map.set(r.ordenId, r);
      } else if (r.bultosResumen?.length > 0) {
        const oId = r.bultosResumen.find((b) => b.ordenId)?.ordenId;
        if (oId) map.set(oId, r);
      }
    }
    return map;
  }, [remitos]);

  const destinosOptions = useMemo(() => {
    return [
      { value: "", label: "Todas las sucursales" },
      ...ubicaciones
        .filter((u) => u.tipo === "LOCAL")
        .map((u) => ({ value: String(u.id), label: u.nombre })),
    ];
  }, [ubicaciones]);

  const estadosOptions = [
    { value: "todos", label: "Todos los estados" },
    { value: "activas", label: "Órdenes en curso (activas)" },
    { value: "PENDIENTE", label: "Pendiente de empaque" },
    { value: "EN_PREPARACION", label: "En preparación" },
    { value: "DESPACHADA", label: "En tránsito / Despachada" },
    { value: "CERRADA", label: "Cerrada / Concluida" },
  ];

  const periodosOptions = [
    { value: "todos", label: "Todo el historial" },
    { value: "hoy", label: "Registradas hoy" },
    { value: "semana", label: "Últimos 7 días" },
    { value: "mes", label: "Últimos 30 días" },
  ];

  // Consolidación de filas para la tabla histórica
  const ordenesRows = useMemo(() => {
    return ordenes.map((o) => {
      const remito = remitosByOrden.get(o.id);
      const totalUnidades = (o.detalles || []).reduce(
        (acc, d) => acc + (d.cantidadSolicitada || d.cantidad_solicitada || 0),
        0
      );
      const renglonesCount = o.detalles?.length || 0;
      const totalBultos =
        remito?.bultosResumen?.length || remito?.totalBultos || 0;

      const fechaObj = o.fecha ? new Date(o.fecha) : null;
      const fechaStr = fechaObj
        ? fechaObj.toLocaleDateString("es-AR", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
          })
        : "-";
      const horaStr = fechaObj
        ? fechaObj.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      return {
        id: o.id,
        rawFecha: fechaObj,
        fechaStr,
        horaStr,
        origenId: o.origenId,
        origenNombre: ubicMap.get(o.origenId) || `Sede #${o.origenId}`,
        destinoId: o.destinoId,
        destinoNombre: ubicMap.get(o.destinoId) || `Sede #${o.destinoId}`,
        estado: o.estado,
        totalUnidades,
        totalBultos,
        renglonesCount,
        remitoNumero: remito?.numero || null,
        remitoEstado: remito?.estado || null,
        responsable: o.creador || "Administrador Stocky",
        detalles: o.detalles || [],
      };
    });
  }, [ordenes, remitosByOrden, ubicMap]);

  // Filtrado reactivo multidimensional
  const filteredRows = useMemo(() => {
    const now = new Date();
    const hoyInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hace7Dias = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace30Dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const q = search.toLowerCase().trim();

    return ordenesRows.filter((r) => {
      // 1. Filtro Destino
      if (filtroDestino && String(r.destinoId) !== filtroDestino) {
        return false;
      }

      // 2. Filtro Estado
      if (filtroEstado === "activas") {
        if (r.estado === "CERRADA") return false;
      } else if (filtroEstado !== "todos") {
        if (r.estado !== filtroEstado) return false;
      }

      // 3. Filtro Temporal
      if (filtroPeriodo !== "todos" && r.rawFecha) {
        if (filtroPeriodo === "hoy" && r.rawFecha < hoyInicio) return false;
        if (filtroPeriodo === "semana" && r.rawFecha < hace7Dias) return false;
        if (filtroPeriodo === "mes" && r.rawFecha < hace30Dias) return false;
      }

      // 4. Búsqueda por texto (ID, Remito, Local, Producto)
      if (q) {
        const matchesId = String(r.id).includes(q) || `#${r.id}`.includes(q);
        const matchesRemito = r.remitoNumero?.toLowerCase().includes(q);
        const matchesDestino = r.destinoNombre?.toLowerCase().includes(q);
        const matchesOrigen = r.origenNombre?.toLowerCase().includes(q);
        const matchesProducto = r.detalles.some((d) => {
          const prod = prodMap.get(d.productoId || d.producto_id);
          return (
            prod?.nombre?.toLowerCase().includes(q) ||
            prod?.codigo?.toLowerCase().includes(q)
          );
        });

        if (
          !matchesId &&
          !matchesRemito &&
          !matchesDestino &&
          !matchesOrigen &&
          !matchesProducto
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    ordenesRows,
    search,
    filtroDestino,
    filtroEstado,
    filtroPeriodo,
    prodMap,
  ]);

  const hayFiltrosActivos = Boolean(
    search.trim() ||
      filtroDestino ||
      filtroEstado !== "todos" ||
      filtroPeriodo !== "todos"
  );

  const handleResetFilters = () => {
    setSearch("");
    setFiltroDestino("");
    setFiltroEstado("todos");
    setFiltroPeriodo("todos");
  };

  // Métricas agregadas
  const kpis = useMemo(() => {
    const total = filteredRows.length;
    const activas = filteredRows.filter((r) => r.estado !== "CERRADA").length;
    const cerradas = filteredRows.filter((r) => r.estado === "CERRADA").length;
    const unidades = filteredRows.reduce((acc, r) => acc + r.totalUnidades, 0);
    return { total, activas, cerradas, unidades };
  }, [filteredRows]);

  const columns = [
    {
      key: "id",
      header: "Orden",
      mono: true,
      sortable: true,
      render: (v) => (
        <span
          className="font-mono text-sm font-medium text-accent cursor-pointer"
          onClick={() => navigate(`/logistica/ordenes/${v}`)}
        >
          #{v}
        </span>
      ),
    },
    {
      key: "fechaStr",
      header: "Fecha de solicitud",
      sortable: true,
      render: (_, r) => (
        <div className="stack gap-0.5">
          <span className="text-xs font-medium">{r.fechaStr}</span>
          <span className="text-xs text-secondary font-mono">{r.horaStr}</span>
        </div>
      ),
    },
    {
      key: "destinoNombre",
      header: "Itinerario",
      sortable: true,
      render: (_, r) => (
        <div className="stack gap-0.5">
          <span className="text-xs text-secondary">
            Origen: <span className="text-primary font-medium">{r.origenNombre}</span>
          </span>
          <span className="text-xs">
            Destino: <span className="font-medium text-accent">{r.destinoNombre}</span>
          </span>
        </div>
      ),
    },
    {
      key: "remitoNumero",
      header: "Remito formal",
      mono: true,
      sortable: true,
      render: (v, r) =>
        v ? (
          <div className="stack gap-0.5">
            <span
              className="font-mono text-xs font-medium text-primary cursor-pointer hover:underline"
              onClick={() =>
                navigate(
                  `/logistica/ordenes/${r.id}?tab=${
                    r.estado === "DESPACHADA" ? "recepcion" : "despacho"
                  }`
                )
              }
            >
              {v}
            </span>
            <span className="text-xs text-muted">
              {r.remitoEstado ? `Estado: ${r.remitoEstado}` : ""}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted">Sin emitir (en preparación)</span>
        ),
    },
    {
      key: "totalUnidades",
      header: "Carga y bultos",
      sortable: true,
      render: (_, r) => (
        <div className="stack gap-0.5">
          <span className="tabular-nums text-sm font-medium">
            {r.totalUnidades} u.
          </span>
          <span className="text-xs text-secondary tabular-nums font-mono">
            {r.totalBultos > 0
              ? `${r.totalBultos} bulto${r.totalBultos === 1 ? "" : "s"}`
              : "0 bultos"}
          </span>
        </div>
      ),
    },
    {
      key: "renglonesCount",
      header: "Renglones",
      render: (v) => (
        <span className="text-xs tabular-nums font-mono">
          {v} artículo{v === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      key: "responsable",
      header: "Responsable",
      render: (v) => <span className="text-xs text-secondary">{v}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      sortable: true,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "acciones",
      header: "Acción",
      align: "right",
      sortable: false,
      render: (_, r) => (
        <div className="row gap-2 justify-end align-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/logistica/ordenes/${r.id}`)}
          >
            Ver detalle
          </Button>

          {(r.estado === "PENDIENTE" || r.estado === "EN_PREPARACION") && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft="package"
              onClick={() => navigate(`/logistica/ordenes/${r.id}?tab=empaque`)}
            >
              Empacar
            </Button>
          )}

          {r.estado === "DESPACHADA" && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft="truck"
              onClick={() => navigate(`/logistica/ordenes/${r.id}?tab=recepcion`)}
            >
              Recibir
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="logistics-workbench stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span
              className="cursor-pointer text-secondary"
              onClick={() => navigate("/logistica/operaciones")}
            >
              Operaciones
            </span>
            <span>·</span>
            <span>Historial y registro de órdenes</span>
          </div>
          <h1 className="text-xl">Historial de órdenes de reposición</h1>
          <p className="text-sm text-secondary">
            Registro integral de transferencias entre CD y sucursales, remitos formales y estado de abastecimiento.
          </p>
        </div>

        <div className="row gap-2">
          {user?.role === "ADMIN" && (
            <Button
              variant="primary"
              iconLeft="plus"
              onClick={() => navigate("/logistica/ordenes/nueva")}
            >
              Nueva orden de reposición
            </Button>
          )}
        </div>
      </div>

      <div className="grid-4 gap-3">
        <MetricCard
          label="Total órdenes"
          value={kpis.total}
          subtext="En el registro filtrado"
        />
        <MetricCard
          label="En preparación / Tránsito"
          value={kpis.activas}
          subtext="Órdenes activas en curso"
          badgeTone={kpis.activas > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Concluidas"
          value={kpis.cerradas}
          subtext="Recepción y cierre formal"
          badgeTone={kpis.cerradas > 0 ? "success" : "neutral"}
        />
        <MetricCard
          label="Volumen total"
          value={`${kpis.unidades} u.`}
          subtext="Artículos transferidos"
        />
      </div>

      <div className="card p-4 stack gap-3">
        <div className="row justify-between align-center wrap gap-3">
          <div className="flex-1 min-w-0">
            <TextInput
              id="ordenes-search"
              placeholder="Buscar por orden (#13), remito, sucursal o artículo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="row gap-2 wrap align-center">
            <Select
              id="filtro-destino"
              value={filtroDestino}
              onChange={setFiltroDestino}
              options={destinosOptions}
            />
            <Select
              id="filtro-estado"
              value={filtroEstado}
              onChange={setFiltroEstado}
              options={estadosOptions}
            />
            <Select
              id="filtro-periodo"
              value={filtroPeriodo}
              onChange={setFiltroPeriodo}
              options={periodosOptions}
            />

            {hayFiltrosActivos && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Restablecer filtros
              </Button>
            )}
          </div>
        </div>

        <SortableDataTable
          columns={columns}
          data={filteredRows}
          rowKey="id"
          loading={loadingOrd || loadingRem}
          emptyTitle="Sin órdenes en el historial"
          emptyDescription={
            hayFiltrosActivos
              ? "No hay órdenes que coincidan con los filtros seleccionados."
              : "No se registran órdenes de reposición en el sistema."
          }
        />
      </div>
    </div>
  );
}

export default OrdenesHistorialPage;

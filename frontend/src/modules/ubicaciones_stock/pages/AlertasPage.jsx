import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  SortableDataTable,
  FilterToolbar,
  SegmentedControl,
  Button,
  Badge,
  MetricCard,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useAlertasStock } from "../hooks/useAlertasStock";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { IngresoCdModal } from "../components/IngresoCdModal";

/**
 * Vista dedicada de alertas de reposicion por stock bajo minimo (/stock/alertas).
 * Cumple US2 / T030:
 * - Botones explicitos de resolucion ("Marcar leida", "Reponer", "Ingresar stock").
 * - Preservacion del filtro en la URL y en la navegacion hacia destino.
 * - Exactamente una accion primaria visible a nivel contexto (FR-043).
 */
export function AlertasPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Preservacion de filtros via URL query params
  const urgenciaFiltro = searchParams.get("urgencia") || "todas";
  const estadoFiltro = searchParams.get("estado") || "pendientes";
  const search = searchParams.get("q") || "";
  const ubicacionIdParam = searchParams.get("ubicacionId");
  const productoIdParam = searchParams.get("productoId");

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "todas") {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const ingresoModal = useDisclosure(false);
  const [modalCdId, setModalCdId] = useState(undefined);
  const [modalProdId, setModalProdId] = useState(undefined);

  const {
    alertas,
    loading: loadingAlertas,
    error: errorAlertas,
    reload: reloadAlertas,
    marcarLeida,
    marcarPending,
  } = useAlertasStock();

  const { ubicaciones } = useUbicaciones({ activas: false });
  const { productos } = useProductos();

  // Mapear alertas enriquecidas con producto y ubicacion
  const enrichedAlertas = useMemo(() => {
    const prodMap = new Map((productos || []).map((p) => [p.id, p]));
    const ubicMap = new Map((ubicaciones || []).map((u) => [u.id, u]));

    return (alertas || []).map((a) => {
      const prod = prodMap.get(a.productoId);
      const ubic = ubicMap.get(a.ubicacionId);

      const cant = a.disponible;
      const min = a.nivelMinimo;
      const isCD = ubic?.tipo === "CD" || ubic?.scope === "CD";

      let urgenciaTexto = "Alta: por debajo del mínimo";
      let urgenciaTone = "warning";
      let urgenciaKey = "alta";

      if (cant === 0) {
        urgenciaTexto = "Crítica: stock agotado";
        urgenciaTone = "danger";
        urgenciaKey = "critica";
      } else if (cant === min) {
        urgenciaTexto = "Media: en nivel mínimo";
        urgenciaTone = "info";
        urgenciaKey = "media";
      }

      return {
        id: a.id,
        stockId: a.stockId,
        productoId: a.productoId,
        ubicacionId: a.ubicacionId,
        codigo: prod?.codigo || `SKU-${a.productoId}`,
        productoNombre: prod?.nombre || "Producto sin denominación",
        categoria: prod?.categoriaNombre || "General",
        ubicacionNombre: ubic?.nombre || `Sede #${a.ubicacionId}`,
        ubicacionTipo: isCD ? "CD" : "LOCAL",
        ubicacionLabel: isCD ? "Centro de distribución" : "Local comercial",
        cantidadDisponible: cant,
        nivelMinimo: min,
        deficit: Math.max(0, min - cant),
        urgenciaTexto,
        urgenciaTone,
        urgenciaKey,
        isCD,
        leida: a.leida,
        estadoTexto: a.leida ? "Resuelta" : "Pendiente de atención",
        fechaEmision: a.fechaEmision
          ? new Date(a.fechaEmision).toLocaleString([], {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Reciente",
      };
    });
  }, [alertas, productos, ubicaciones]);

  // Filtrado compuesto con preservacion en navegacion
  const filteredAlertas = useMemo(() => {
    let result = enrichedAlertas;

    if (estadoFiltro === "pendientes") {
      result = result.filter((a) => !a.leida);
    } else if (estadoFiltro === "resueltas") {
      result = result.filter((a) => a.leida);
    }

    if (urgenciaFiltro === "critica") {
      result = result.filter((a) => a.urgenciaKey === "critica");
    } else if (urgenciaFiltro === "alta") {
      result = result.filter((a) => a.urgenciaKey === "alta");
    } else if (urgenciaFiltro === "media") {
      result = result.filter((a) => a.urgenciaKey === "media");
    }

    if (ubicacionIdParam) {
      result = result.filter((a) => String(a.ubicacionId) === String(ubicacionIdParam));
    }

    if (productoIdParam) {
      result = result.filter((a) => String(a.productoId) === String(productoIdParam));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.codigo.toLowerCase().includes(q) ||
          a.productoNombre.toLowerCase().includes(q) ||
          a.ubicacionNombre.toLowerCase().includes(q) ||
          a.urgenciaTexto.toLowerCase().includes(q)
      );
    }

    return result;
  }, [enrichedAlertas, estadoFiltro, urgenciaFiltro, ubicacionIdParam, productoIdParam, search]);

  const totalCriticas = useMemo(
    () => enrichedAlertas.filter((a) => a.urgenciaKey === "critica" && !a.leida).length,
    [enrichedAlertas]
  );
  const totalAltas = useMemo(
    () => enrichedAlertas.filter((a) => a.urgenciaKey === "alta" && !a.leida).length,
    [enrichedAlertas]
  );
  const totalPendientes = useMemo(
    () => enrichedAlertas.filter((a) => !a.leida).length,
    [enrichedAlertas]
  );

  const handleOpenIngresoModal = (alerta) => {
    setModalCdId(alerta.ubicacionId);
    setModalProdId(alerta.productoId);
    ingresoModal.onOpen();
  };

  const handleNavigateCrearOrden = (alerta) => {
    const returnPath = `/stock/alertas?${searchParams.toString()}`;
    navigate(
      `/logistica/ordenes/crear?productoId=${alerta.productoId}&destinoId=${alerta.ubicacionId}`,
      { state: { returnTo: returnPath } }
    );
  };

  const columns = [
    {
      key: "urgenciaTexto",
      header: "Nivel de urgencia",
      sortable: true,
      render: (v, r) => (
        <Badge tone={r.urgenciaTone} dot={!r.leida}>
          {v}
        </Badge>
      ),
    },
    {
      key: "codigo",
      header: "Producto / SKU",
      sortable: true,
      render: (_, r) => (
        <div className="stack gap-1">
          <span className="font-mono text-xs">{r.codigo}</span>
          <span className="text-sm font-medium">{r.productoNombre}</span>
        </div>
      ),
    },
    {
      key: "ubicacionNombre",
      header: "Ubicación afectada",
      sortable: true,
      render: (v, r) => (
        <div className="row align-center gap-2">
          <span>{v}</span>
          <Badge tone={r.ubicacionTipo === "CD" ? "cd" : "local"}>
            {r.ubicacionTipo}
          </Badge>
        </div>
      ),
    },
    {
      key: "cantidadDisponible",
      header: "Stock actual",
      align: "right",
      sortable: true,
      render: (v, r) => (
        <span
          className={`tabular-nums font-medium ${
            v === 0 ? "text-danger" : "text-warning"
          }`}
        >
          {v} u.
        </span>
      ),
    },
    {
      key: "nivelMinimo",
      header: "Mínimo requerido",
      align: "right",
      render: (v, r) => (
        <div className="text-right tabular-nums">
          <span className="text-secondary">{v} u.</span>
          {r.deficit > 0 && (
            <span className="text-xs text-danger block">
              Faltan {r.deficit} u.
            </span>
          )}
        </div>
      ),
    },
    {
      key: "accionSugerida",
      header: "Acción de reposición",
      render: (_, r) => {
        if (r.isCD) {
          return (
            <Button
              variant="secondary"
              size="sm"
              iconRight="arrow-right"
              onClick={() => handleOpenIngresoModal(r)}
            >
              Ingresar stock
            </Button>
          );
        }
        return (
          <Button
            variant="secondary"
            size="sm"
            iconRight="arrow-right"
            onClick={() => handleNavigateCrearOrden(r)}
          >
            Reponer
          </Button>
        );
      },
    },
    {
      key: "resolucion",
      header: "Gestión de alerta",
      align: "right",
      render: (_, r) => {
        if (!r.leida) {
          return (
            <Button
              variant="ghost"
              size="sm"
              iconLeft="check"
              onClick={() => marcarLeida(r.id)}
              disabled={marcarPending}
            >
              Marcar leída
            </Button>
          );
        }
        return (
          <Badge tone="success">
            Resuelta
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Inventario</span>
            <span>·</span>
            <span>Monitor de existencias</span>
          </div>
          <h1 className="text-xl font-medium">Alertas de Stock Bajo Mínimo</h1>
        </div>
        <div className="row gap-2 align-center">
          <Button
            variant="secondary"
            iconLeft="refresh"
            onClick={reloadAlertas}
          >
            Actualizar
          </Button>
          <Button
            variant="primary"
            iconLeft="plus"
            onClick={() => {
              setModalCdId(undefined);
              setModalProdId(undefined);
              ingresoModal.onOpen();
            }}
          >
            Ingresar mercadería en CD
          </Button>
        </div>
      </div>

      <div className="grid-4 gap-3">
        <MetricCard
          label="Alertas pendientes"
          value={totalPendientes}
          subtext="Requieren abastecimiento"
          badgeTone={totalPendientes > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Críticas: stock agotado"
          value={totalCriticas}
          subtext="Existencias en cero (0 u.)"
          badgeTone={totalCriticas > 0 ? "danger" : "neutral"}
        />
        <MetricCard
          label="Altas: bajo mínimo"
          value={totalAltas}
          subtext="Perforaron el nivel umbral"
          badgeTone={totalAltas > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Historial total"
          value={enrichedAlertas.length}
          subtext="Eventos disparados por Observer"
        />
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <div className="row align-center gap-3 wrap">
          <SegmentedControl
            value={estadoFiltro}
            onChange={(v) => updateParam("estado", v)}
            options={[
              { value: "pendientes", label: "Pendientes", count: totalPendientes },
              { value: "resueltas", label: "Resueltas" },
              { value: "todas", label: "Todas" },
            ]}
          />

          <SegmentedControl
            value={urgenciaFiltro}
            onChange={(v) => updateParam("urgencia", v)}
            options={[
              { value: "todas", label: "Cualquier urgencia" },
              { value: "critica", label: "Crítica", count: totalCriticas },
              { value: "alta", label: "Alta", count: totalAltas },
            ]}
          />

          {(ubicacionIdParam || productoIdParam) && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft="x"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("ubicacionId");
                next.delete("productoId");
                setSearchParams(next, { replace: true });
              }}
            >
              Limpiar filtro específico
            </Button>
          )}
        </div>

        <FilterToolbar
          searchValue={search}
          onSearchChange={(v) => updateParam("q", v)}
          searchPlaceholder="Buscar por SKU, producto o sede..."
        />
      </div>

      <SortableDataTable
        columns={columns}
        data={filteredAlertas}
        rowKey="id"
        loading={loadingAlertas}
        error={errorAlertas}
        onRetry={reloadAlertas}
        emptyTitle="Sin alertas de reposición pendientes"
        emptyDescription="Todas las existencias en centros y locales comerciales se encuentran por encima de sus niveles mínimos."
      />

      <IngresoCdModal
        open={ingresoModal.open}
        onClose={ingresoModal.onClose}
        defaultCdId={modalCdId}
        defaultProductoId={modalProdId}
        onSuccess={() => reloadAlertas()}
      />
    </div>
  );
}

export default AlertasPage;

import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  FilterToolbar,
  SegmentedControl,
  Button,
  Badge,
  StatusBadge,
  Icon,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useUbicaciones } from "../hooks/useUbicaciones";
import { UbicacionModal } from "../components/UbicacionModal";
import { useSede } from "../../../app/providers/SedeProvider";

export function UbicacionesPage() {
  const [filterView, setFilterView] = useState("todas");
  const [search, setSearch] = useState("");
  const { reloadSedes } = useSede();

  // Solicitamos todas las ubicaciones para poder gestionar activas e inactivas
  const {
    ubicaciones,
    loading,
    error,
    reload,
    crearCD,
    crearLocal,
    actualizar,
    darDeBaja,
    reactivar,
    pendingCrear,
    actualizarPending,
    darDeBajaPending,
    reactivarPending,
    fieldErrors,
  } = useUbicaciones({ activas: false });

  const modalDisclosure = useDisclosure(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedUbicacion, setSelectedUbicacion] = useState(null);

  const filteredUbicaciones = useMemo(() => {
    let result = ubicaciones;

    if (filterView === "cd") {
      result = result.filter((u) => u.tipo === "CD");
    } else if (filterView === "local") {
      result = result.filter((u) => u.tipo === "LOCAL");
    } else if (filterView === "inactivas") {
      result = result.filter((u) => !u.activo);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.nombre.toLowerCase().includes(q) ||
          u.direccion.toLowerCase().includes(q) ||
          (u.telefono && u.telefono.toLowerCase().includes(q))
      );
    }

    return result;
  }, [ubicaciones, filterView, search]);

  const handleOpenCreate = () => {
    setSelectedUbicacion(null);
    setModalMode("create");
    modalDisclosure.onOpen();
  };

  const handleOpenEdit = (ubicacion) => {
    setSelectedUbicacion(ubicacion);
    setModalMode("edit");
    modalDisclosure.onOpen();
  };

  const handleOpenDeactivate = (ubicacion) => {
    setSelectedUbicacion(ubicacion);
    setModalMode("deactivate");
    modalDisclosure.onOpen();
  };

  const handleSubmitModal = async ({ tipo, dto, id }) => {
    let res;
    if (modalMode === "edit" && id) {
      res = await actualizar({ id, dto });
    } else if (tipo === "CD") {
      res = await crearCD(dto);
    } else {
      res = await crearLocal(dto);
    }
    if (res?.ok !== false) {
      await reloadSedes();
    }
    return res;
  };

  const handleDeactivate = async (id) => {
    const res = await darDeBaja(id);
    if (res?.ok !== false) {
      await reloadSedes();
    }
    return res;
  };

  const handleReactivar = async (id) => {
    const res = await reactivar(id);
    if (res?.ok !== false) {
      await reloadSedes();
    }
  };

  const columns = [
    { key: "id", header: "ID", mono: true, sortable: true },
    {
      key: "tipo",
      header: "Tipo de sede",
      sortable: true,
      render: (tipo) => {
        const isCD = tipo === "CD";
        return (
          <div className="row align-center gap-1">
            <Icon name={isCD ? "warehouse" : "store"} size={14} />
            <Badge tone={isCD ? "cd" : "local"}>
              {isCD ? "CD Central" : "Local Minorista"}
            </Badge>
          </div>
        );
      },
    },
    { key: "nombre", header: "Nombre comercial", sortable: true },
    { key: "direccion", header: "Dirección física" },
    {
      key: "telefono",
      header: "Teléfono",
      render: (v) => v || <span className="text-muted">No informado</span>,
    },
    {
      key: "rolLogistico",
      header: "Capacidad logística",
      render: (_, row) => {
        const isCD = row.tipo === "CD";
        return (
          <div className="stack text-xs">
            <span className="font-medium text-primary">
              {isCD ? "Origen de despachos" : "Destino de reposición"}
            </span>
            <span className="text-secondary">
              {isCD ? "Recepción de proveedores" : "Punto de venta y recepción"}
            </span>
          </div>
        );
      },
    },
    {
      key: "activo",
      header: "Estado",
      render: (activo) => (
        <StatusBadge status={activo ? "Activo" : "Inactivo"} />
      ),
    },
    {
      key: "acciones",
      header: "Acciones",
      align: "right",
      sortable: false,
      render: (_, row) => (
        <div className="row gap-2 justify-end align-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenEdit(row)}
          >
            Editar
          </Button>
          {row.activo && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleOpenDeactivate(row)}
            >
              Desactivar
            </Button>
          )}
          {!row.activo && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleReactivar(row.id)}
              loading={reactivarPending}
            >
              Reactivar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span>Red logística</span>
            <span>·</span>
            <span>Centros y Locales</span>
          </div>
          <h1 className="text-xl">Administración de Red Logística</h1>
          <p className="text-sm text-secondary">
            Nodos operativos habilitados como orígenes o destinos para reposición, despacho y ventas.
          </p>
        </div>
        <div>
          <Button variant="primary" iconLeft="plus" onClick={handleOpenCreate}>
            Nueva sede / ubicación
          </Button>
        </div>
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <SegmentedControl
          value={filterView}
          onChange={(val) => {
            setFilterView(val);
            setSearch("");
          }}
          options={[
            { value: "todas", label: "Todas", count: ubicaciones.length },
            {
              value: "cd",
              label: "Centros (CD)",
              count: ubicaciones.filter((u) => u.tipo === "CD").length,
            },
            {
              value: "local",
              label: "Locales",
              count: ubicaciones.filter((u) => u.tipo === "LOCAL").length,
            },
            {
              value: "inactivas",
              label: "Inactivas",
              count: ubicaciones.filter((u) => !u.activo).length,
            },
          ]}
        />

        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nombre, dirección o teléfono..."
        />
      </div>

      <SortableDataTable
        columns={columns}
        data={filteredUbicaciones}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={reload}
        emptyTitle="Sin ubicaciones registradas"
        emptyDescription="Registra un Centro de Distribución o sucursales locales para iniciar la red."
      />

      <UbicacionModal
        open={modalDisclosure.isOpen}
        onClose={modalDisclosure.onClose}
        mode={modalMode}
        ubicacion={selectedUbicacion}
        onSubmit={handleSubmitModal}
        onDeactivate={handleDeactivate}
        pending={pendingCrear || actualizarPending || darDeBajaPending}
        fieldErrors={fieldErrors}
      />
    </div>
  );
}

export default UbicacionesPage;

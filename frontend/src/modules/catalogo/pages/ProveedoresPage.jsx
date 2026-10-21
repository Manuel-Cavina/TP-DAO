import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  FilterToolbar,
  SegmentedControl,
  Button,
  StatusBadge,
  ConfirmMorph,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useProveedores } from "../hooks/useProveedores";
import { ProveedorModal } from "../components/ProveedorModal";

export function ProveedoresPage() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("activos");
  const [selectedProveedor, setSelectedProveedor] = useState(null);

  const {
    proveedores,
    loading: loadingProv,
    error: errorProv,
    reload: reloadProv,
    crear: crearProv,
    crearPending: pendingProv,
    crearFieldErrors: errorsProv,
    actualizar: actualizarProv,
    actualizarPending: pendingEditProv,
    darDeBaja: darDeBajaProv,
  } = useProveedores({ activos: filterEstado !== "inactivos" });

  const provModal = useDisclosure(false);

  const filteredProveedores = useMemo(() => {
    let result = proveedores;

    if (filterEstado === "inactivos") {
      result = result.filter((p) => !p.activo);
    } else if (filterEstado === "activos") {
      result = result.filter((p) => p.activo);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.razonSocial.toLowerCase().includes(q) ||
          p.cuit.includes(q) ||
          (p.email && p.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [proveedores, filterEstado, search]);

  const handleOpenCreate = () => {
    setSelectedProveedor(null);
    provModal.onOpen();
  };

  const handleOpenEdit = (proveedor) => {
    setSelectedProveedor(proveedor);
    provModal.onOpen();
  };

  const columns = [
    { key: "cuit", header: "CUIT", mono: true, sortable: true },
    { key: "razonSocial", header: "Razón social", sortable: true },
    {
      key: "telefono",
      header: "Teléfono",
      render: (v) => v || <span className="text-muted">No informado</span>,
    },
    {
      key: "email",
      header: "Correo electrónico",
      render: (v) => v || <span className="text-muted">No informado</span>,
    },
    {
      key: "activo",
      header: "Estado",
      render: (v) => <StatusBadge status={v ? "Activo" : "Inactivo"} />,
    },
    {
      key: "acciones",
      header: "Acciones",
      align: "right",
      sortable: false,
      render: (_, row) => (
        <div className="row gap-2 justify-end align-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(row)}
          >
            Editar
          </Button>
          {row.activo && (
            <ConfirmMorph
              triggerLabel="Baja"
              confirmTitle="¿Dar de baja proveedor?"
              onConfirm={() => darDeBajaProv(row.cuit)}
            />
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
            <span>Catálogo</span>
            <span>·</span>
            <span>Proveedores</span>
          </div>
          <h1 className="text-xl">Proveedores Comerciales</h1>
          <p className="text-sm text-secondary">
            Empresas y fabricantes autorizados para ingreso de mercadería en centros de distribución.
          </p>
        </div>
        <div>
          <Button variant="primary" iconLeft="plus" onClick={handleOpenCreate}>
            Nuevo proveedor
          </Button>
        </div>
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <SegmentedControl
          value={filterEstado}
          onChange={setFilterEstado}
          options={[
            { value: "activos", label: "Activos" },
            { value: "todos", label: "Todos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
        />

        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por CUIT o razón social..."
        />
      </div>

      <SortableDataTable
        columns={columns}
        data={filteredProveedores}
        rowKey="cuit"
        loading={loadingProv}
        error={errorProv}
        onRetry={reloadProv}
        emptyTitle="Sin proveedores"
        emptyDescription="Registra proveedores comerciales con su CUIT y datos de contacto."
      />

      <ProveedorModal
        open={provModal.isOpen}
        onClose={provModal.onClose}
        proveedor={selectedProveedor}
        onSubmit={selectedProveedor ? (dto) => actualizarProv({ cuit: selectedProveedor.cuit, dto }) : crearProv}
        pending={pendingProv || pendingEditProv}
        fieldErrors={errorsProv}
      />
    </div>
  );
}

export default ProveedoresPage;

import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  FilterToolbar,
  Button,
  StatusBadge,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useCategorias } from "../hooks/useCategorias";
import { CategoriaModal } from "../components/CategoriaModal";

export function CategoriasPage() {
  const [search, setSearch] = useState("");
  const {
    categorias,
    loading: loadingCat,
    error: errorCat,
    reload: reloadCat,
    crear: crearCat,
    crearPending: pendingCat,
    crearFieldErrors: errorsCat,
    actualizar: actualizarCat,
    actualizarPending: pendingEditCat,
    actualizarFieldErrors: errorsEditCat,
    darDeBaja: darDeBajaCat,
    darDeBajaPending: pendingBajaCat,
  } = useCategorias();

  const catModal = useDisclosure(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedCategoria, setSelectedCategoria] = useState(null);

  const filteredCategorias = useMemo(() => {
    if (!search.trim()) return categorias;
    const q = search.toLowerCase();
    return categorias.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [categorias, search]);

  const handleOpenCreate = () => {
    setSelectedCategoria(null);
    setModalMode("create");
    catModal.onOpen();
  };

  const handleOpenEdit = (categoria) => {
    setSelectedCategoria(categoria);
    setModalMode("edit");
    catModal.onOpen();
  };

  const handleOpenDeactivate = (categoria) => {
    setSelectedCategoria(categoria);
    setModalMode("deactivate");
    catModal.onOpen();
  };

  const handleSubmitModal = async (payload) => {
    if (modalMode === "edit") {
      return await actualizarCat(payload);
    }
    return await crearCat(payload);
  };

  const handleDeactivate = async (id) => {
    return await darDeBajaCat(id);
  };

  const columns = [
    { key: "id", header: "ID", mono: true, sortable: true },
    { key: "nombre", header: "Nombre de categoría", sortable: true },
    {
      key: "activo",
      header: "Estado",
      render: (v) => <StatusBadge status={v !== false ? "Activo" : "Inactivo"} />,
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
          {row.activo !== false && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleOpenDeactivate(row)}
            >
              Desactivar
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
            <span>Catálogo</span>
            <span>·</span>
            <span>Categorías</span>
          </div>
          <h1 className="text-xl">Categorías de Catálogo</h1>
          <p className="text-sm text-secondary">
            Familias y agrupaciones para organización taxonómica de los artículos comerciales.
          </p>
        </div>
        <div>
          <Button variant="primary" iconLeft="plus" onClick={handleOpenCreate}>
            Nueva categoría
          </Button>
        </div>
      </div>

      <div className="row justify-between align-center wrap gap-3">
        <span className="text-xs text-secondary font-medium">
          {categorias.length} {categorias.length === 1 ? "categoría registrada" : "categorías registradas"}
        </span>
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nombre de categoría..."
        />
      </div>

      <SortableDataTable
        columns={columns}
        data={filteredCategorias}
        rowKey="id"
        loading={loadingCat}
        error={errorCat}
        onRetry={reloadCat}
        emptyTitle="Sin categorías"
        emptyDescription="Registra la primera categoría para organizar los productos del catálogo."
      />

      <CategoriaModal
        open={catModal.isOpen}
        onClose={catModal.onClose}
        mode={modalMode}
        categoria={selectedCategoria}
        onSubmit={handleSubmitModal}
        onDeactivate={handleDeactivate}
        pending={pendingCat || pendingEditCat || pendingBajaCat}
        fieldErrors={{ ...errorsCat, ...errorsEditCat }}
      />
    </div>
  );
}

export default CategoriasPage;

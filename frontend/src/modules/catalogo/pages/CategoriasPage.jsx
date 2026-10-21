import React, { useState, useMemo } from "react";
import {
  SortableDataTable,
  FilterToolbar,
  Button,
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
  } = useCategorias();

  const catModal = useDisclosure(false);

  const filteredCategorias = useMemo(() => {
    if (!search.trim()) return categorias;
    const q = search.toLowerCase();
    return categorias.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [categorias, search]);

  const columns = [
    { key: "id", header: "ID", mono: true, sortable: true },
    { key: "nombre", header: "Nombre de categoría", sortable: true },
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
          <Button variant="primary" iconLeft="plus" onClick={catModal.onOpen}>
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
        onSubmit={crearCat}
        pending={pendingCat}
        fieldErrors={errorsCat}
      />
    </div>
  );
}

export default CategoriasPage;

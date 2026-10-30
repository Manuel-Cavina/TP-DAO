export function filterProducts(products, { estado = "todos", categoriaId = "todas", search = "" } = {}) {
  const query = search.trim().toLowerCase();
  return products.filter((product) => {
    if (estado === "activos" && !product.activo) return false;
    if (estado === "inactivos" && product.activo) return false;
    if (categoriaId !== "todas" && String(product.categoriaId) !== String(categoriaId)) return false;
    return !query || [product.codigo, product.nombre].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

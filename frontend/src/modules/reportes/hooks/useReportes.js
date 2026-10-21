import { useState, useEffect, useCallback } from "react";
import { reportesService } from "../services/reportesService";

export function useReportes() {
  const [activeReport, setActiveReport] = useState("r1"); // "r1" | "r2"

  // Filtros R1
  const [r1UbicacionId, setR1UbicacionId] = useState("");
  const [r1CategoriaId, setR1CategoriaId] = useState("");
  const [r1SoloBajoMinimo, setR1SoloBajoMinimo] = useState(false);

  // Filtros R2
  const [r2FechaInicio, setR2FechaInicio] = useState("");
  const [r2FechaFin, setR2FechaFin] = useState("");
  const [r2LocalDestinoId, setR2LocalDestinoId] = useState("");

  // Opciones de selección
  const [ubicaciones, setUbicaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);

  // Datos R1
  const [r1Data, setR1Data] = useState(null);
  const [loadingR1, setLoadingR1] = useState(true);
  const [errorR1, setErrorR1] = useState(null);

  // Datos R2
  const [r2Data, setR2Data] = useState(null);
  const [loadingR2, setLoadingR2] = useState(true);
  const [errorR2, setErrorR2] = useState(null);

  // Drill-down R1
  const [selectedProductoId, setSelectedProductoId] = useState(null);
  const [r1DrillDownData, setR1DrillDownData] = useState(null);
  const [loadingR1DrillDown, setLoadingR1DrillDown] = useState(false);
  const [isR1ModalOpen, setIsR1ModalOpen] = useState(false);

  // Drill-down R2
  const [selectedBultoId, setSelectedBultoId] = useState(null);
  const [r2DrillDownData, setR2DrillDownData] = useState(null);
  const [loadingR2DrillDown, setLoadingR2DrillDown] = useState(false);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);

  // Cargar maestros de catálogo y stock
  useEffect(() => {
    let active = true;
    Promise.all([reportesService.getUbicaciones(), reportesService.getCategorias()]).then(
      ([ubics, cats]) => {
        if (!active) return;
        setUbicaciones(ubics || []);
        setCategorias(cats || []);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  // Cargar R1
  const fetchR1 = useCallback(async () => {
    setLoadingR1(true);
    setErrorR1(null);
    try {
      const params = {};
      if (r1UbicacionId) params.ubicacion_id = Number(r1UbicacionId);
      if (r1CategoriaId) params.categoria_id = Number(r1CategoriaId);
      if (r1SoloBajoMinimo) params.solo_bajo_minimo = true;

      const res = await reportesService.getR1StockValorizacion(params);
      setR1Data(res);
    } catch (err) {
      console.error("Error al cargar R1:", err);
      setErrorR1(err);
    } finally {
      setLoadingR1(false);
    }
  }, [r1UbicacionId, r1CategoriaId, r1SoloBajoMinimo]);

  // Cargar R2
  const fetchR2 = useCallback(async () => {
    setLoadingR2(true);
    setErrorR2(null);
    try {
      const params = {};
      if (r2FechaInicio) params.fecha_inicio = r2FechaInicio;
      if (r2FechaFin) params.fecha_fin = r2FechaFin;
      if (r2LocalDestinoId) params.local_destino_id = Number(r2LocalDestinoId);

      const res = await reportesService.getR2MermasPrecinto(params);
      setR2Data(res);
    } catch (err) {
      console.error("Error al cargar R2:", err);
      setErrorR2(err);
    } finally {
      setLoadingR2(false);
    }
  }, [r2FechaInicio, r2FechaFin, r2LocalDestinoId]);

  useEffect(() => {
    fetchR1();
  }, [fetchR1]);

  useEffect(() => {
    fetchR2();
  }, [fetchR2]);

  // Manejo de Drill-Down R1
  const openR1DrillDown = async (productoId) => {
    setSelectedProductoId(productoId);
    setIsR1ModalOpen(true);
    setLoadingR1DrillDown(true);
    try {
      const detail = await reportesService.getR1DrillDown(productoId);
      setR1DrillDownData(detail);
    } catch (err) {
      console.error("Error cargando drill-down R1:", err);
    } finally {
      setLoadingR1DrillDown(false);
    }
  };

  const closeR1DrillDown = () => {
    setIsR1ModalOpen(false);
    setSelectedProductoId(null);
    setR1DrillDownData(null);
  };

  // Manejo de Drill-Down R2
  const openR2DrillDown = async (bultoId) => {
    setSelectedBultoId(bultoId);
    setIsR2ModalOpen(true);
    setLoadingR2DrillDown(true);
    try {
      const detail = await reportesService.getR2DrillDown(bultoId);
      setR2DrillDownData(detail);
    } catch (err) {
      console.error("Error cargando drill-down R2:", err);
    } finally {
      setLoadingR2DrillDown(false);
    }
  };

  const closeR2DrillDown = () => {
    setIsR2ModalOpen(false);
    setSelectedBultoId(null);
    setR2DrillDownData(null);
  };

  const reloadAll = () => {
    fetchR1();
    fetchR2();
  };

  return {
    activeReport,
    setActiveReport,

    // R1
    r1Data,
    loadingR1,
    errorR1,
    r1UbicacionId,
    setR1UbicacionId,
    r1CategoriaId,
    setR1CategoriaId,
    r1SoloBajoMinimo,
    setR1SoloBajoMinimo,

    // R2
    r2Data,
    loadingR2,
    errorR2,
    r2FechaInicio,
    setR2FechaInicio,
    r2FechaFin,
    setR2FechaFin,
    r2LocalDestinoId,
    setR2LocalDestinoId,

    // Opciones
    ubicaciones,
    categorias,

    // Drill down R1
    isR1ModalOpen,
    selectedProductoId,
    r1DrillDownData,
    loadingR1DrillDown,
    openR1DrillDown,
    closeR1DrillDown,

    // Drill down R2
    isR2ModalOpen,
    selectedBultoId,
    r2DrillDownData,
    loadingR2DrillDown,
    openR2DrillDown,
    closeR2DrillDown,

    // Global
    reloadAll,
  };
}

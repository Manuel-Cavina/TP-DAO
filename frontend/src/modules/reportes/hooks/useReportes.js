import { useState, useEffect, useCallback, useRef } from "react";
import { reportesService } from "../services/reportesService";

export function useReportes() {
  const [activeReport, setActiveReport] = useState("r1");
  const [r1UbicacionId, setR1UbicacionId] = useState("");
  const [r1CategoriaId, setR1CategoriaId] = useState("");
  const [r1SoloBajoMinimo, setR1SoloBajoMinimo] = useState(false);
  const [r2FechaInicio, setR2FechaInicio] = useState("");
  const [r2FechaFin, setR2FechaFin] = useState("");
  const [r2LocalDestinoId, setR2LocalDestinoId] = useState("");
  const [ubicaciones, setUbicaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mastersError, setMastersError] = useState(null);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [r1Data, setR1Data] = useState(null);
  const [loadingR1, setLoadingR1] = useState(true);
  const [errorR1, setErrorR1] = useState(null);
  const [r2Data, setR2Data] = useState(null);
  const [loadingR2, setLoadingR2] = useState(true);
  const [errorR2, setErrorR2] = useState(null);
  const [selectedProductoId, setSelectedProductoId] = useState(null);
  const [r1DrillDownData, setR1DrillDownData] = useState(null);
  const [loadingR1DrillDown, setLoadingR1DrillDown] = useState(false);
  const [errorR1DrillDown, setErrorR1DrillDown] = useState(null);
  const [isR1ModalOpen, setIsR1ModalOpen] = useState(false);
  const [selectedBultoId, setSelectedBultoId] = useState(null);
  const [r2DrillDownData, setR2DrillDownData] = useState(null);
  const [loadingR2DrillDown, setLoadingR2DrillDown] = useState(false);
  const [errorR2DrillDown, setErrorR2DrillDown] = useState(null);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);
  const generations = useRef({ masters: 0, r1: 0, r2: 0, d1: 0, d2: 0 });
  useEffect(() => () => { Object.keys(generations.current).forEach((key) => generations.current[key]++); }, []);

  const reloadMasters = useCallback(async () => {
    const request = ++generations.current.masters;
    setMastersLoading(true); setMastersError(null);
    try {
      const [locations, categories] = await Promise.all([reportesService.getUbicaciones(), reportesService.getCategorias()]);
      if (request !== generations.current.masters) return;
      setUbicaciones(locations); setCategorias(categories);
    } catch (error) { if (request === generations.current.masters) setMastersError(error); }
    finally { if (request === generations.current.masters) setMastersLoading(false); }
  }, []);
  useEffect(() => { reloadMasters(); }, [reloadMasters]);

  const fetchR1 = useCallback(async () => {
    const request = ++generations.current.r1;
    setLoadingR1(true); setErrorR1(null); setR1Data(null);
    try {
      const params = { ubicacion_id: r1UbicacionId ? Number(r1UbicacionId) : undefined, categoria_id: r1CategoriaId ? Number(r1CategoriaId) : undefined, solo_bajo_minimo: r1SoloBajoMinimo };
      const data = await reportesService.getR1StockValorizacion(params);
      if (request === generations.current.r1) setR1Data({ ...data, fetched_at: new Date().toISOString() });
    } catch (error) { if (request === generations.current.r1) setErrorR1(error); }
    finally { if (request === generations.current.r1) setLoadingR1(false); }
  }, [r1UbicacionId, r1CategoriaId, r1SoloBajoMinimo]);
  const fetchR2 = useCallback(async () => {
    const request = ++generations.current.r2;
    setLoadingR2(true); setErrorR2(null); setR2Data(null);
    try {
      const data = await reportesService.getR2MermasPrecinto({ fecha_inicio: r2FechaInicio, fecha_fin: r2FechaFin, local_destino_id: r2LocalDestinoId ? Number(r2LocalDestinoId) : undefined });
      if (request === generations.current.r2) setR2Data({ ...data, fetched_at: new Date().toISOString() });
    } catch (error) { if (request === generations.current.r2) setErrorR2(error); }
    finally { if (request === generations.current.r2) setLoadingR2(false); }
  }, [r2FechaInicio, r2FechaFin, r2LocalDestinoId]);
  useEffect(() => { fetchR1(); return () => { generations.current.r1++; }; }, [fetchR1]);
  useEffect(() => { fetchR2(); return () => { generations.current.r2++; }; }, [fetchR2]);

  const openR1DrillDown = async (productoId) => {
    const request = ++generations.current.d1;
    setSelectedProductoId(productoId); setIsR1ModalOpen(true); setLoadingR1DrillDown(true); setR1DrillDownData(null); setErrorR1DrillDown(null);
    try { const data = await reportesService.getR1DrillDown(productoId); if (request === generations.current.d1) setR1DrillDownData(data); }
    catch (error) { if (request === generations.current.d1) setErrorR1DrillDown(error); }
    finally { if (request === generations.current.d1) setLoadingR1DrillDown(false); }
  };
  const closeR1DrillDown = () => { generations.current.d1++; setIsR1ModalOpen(false); setSelectedProductoId(null); setR1DrillDownData(null); setErrorR1DrillDown(null); };
  const openR2DrillDown = async (bultoId) => {
    const request = ++generations.current.d2;
    setSelectedBultoId(bultoId); setIsR2ModalOpen(true); setLoadingR2DrillDown(true); setR2DrillDownData(null); setErrorR2DrillDown(null);
    try { const row = r2Data?.bultos_rechazados.find((item) => item.bulto_id === bultoId); const data = await reportesService.getR2DrillDown(bultoId, row); if (request === generations.current.d2) setR2DrillDownData(data); }
    catch (error) { if (request === generations.current.d2) setErrorR2DrillDown(error); }
    finally { if (request === generations.current.d2) setLoadingR2DrillDown(false); }
  };
  const closeR2DrillDown = () => { generations.current.d2++; setIsR2ModalOpen(false); setSelectedBultoId(null); setR2DrillDownData(null); setErrorR2DrillDown(null); };
  const reloadAll = () => { fetchR1(); fetchR2(); reloadMasters(); };
  return {
    activeReport, setActiveReport, r1Data, loadingR1, errorR1, r1UbicacionId, setR1UbicacionId, r1CategoriaId, setR1CategoriaId, r1SoloBajoMinimo, setR1SoloBajoMinimo,
    r2Data, loadingR2, errorR2, r2FechaInicio, setR2FechaInicio, r2FechaFin, setR2FechaFin, r2LocalDestinoId, setR2LocalDestinoId,
    ubicaciones, categorias, mastersError, mastersLoading, reloadMasters,
    isR1ModalOpen, selectedProductoId, r1DrillDownData, loadingR1DrillDown, errorR1DrillDown, openR1DrillDown, closeR1DrillDown,
    isR2ModalOpen, selectedBultoId, r2DrillDownData, loadingR2DrillDown, errorR2DrillDown, openR2DrillDown, closeR2DrillDown, reloadAll,
  };
}

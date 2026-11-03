import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../../shared/feedback/ToastContext";
import { useUbicaciones } from "../../../modules/ubicaciones_stock/hooks/useUbicaciones";
import { useRemitos } from "../../../modules/logistica/hooks/useRemitos";
import { useProductos } from "../../../modules/catalogo/hooks/useProductos";
import { logisticaService } from "../../../modules/logistica/services";
import { mapBultoToUI } from "../../../modules/logistica/mappers/logisticaMappers";

export function useOperatorDashboard() {
  const { user, scope, logout } = useAuth();
  const {
    ubicaciones,
    loading: loadingLocations,
    error: locationsError,
    reload: reloadLocations,
  } = useUbicaciones();
  const {
    remitos,
    loading: loadingRemitos,
    error: remitosError,
    reload: reloadRemitos,
  } = useRemitos();
  const { productos } = useProductos({ activos: false });
  const { notifySuccess, notifyError } = useToast();

  // 4 etapas claras: "trabajo" | "armar" | "despachar" | "controlar"
  const [activeTab, setActiveTab] = useState("trabajo");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [ordenes, setOrdenes] = useState([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [todosBultosMap, setTodosBultosMap] = useState({});

  const [sheetControlOpen, setSheetControlOpen] = useState(false);
  const [activeRemitoDetalle, setActiveRemitoDetalle] = useState(null);
  const [loadingRemitoDetalle, setLoadingRemitoDetalle] = useState(false);

  const [sheetArmadoOpen, setSheetArmadoOpen] = useState(false);
  const [targetOrdenForArmado, setTargetOrdenForArmado] = useState(null);

  const loading = loadingRemitos || loadingLocations;
  const loadError = remitosError || locationsError;

  const reload = useCallback(() => {
    reloadLocations();
    reloadRemitos();
  }, [reloadLocations, reloadRemitos]);

  const isAdmin = user?.role === "ADMIN";
  const authorisedIds = useMemo(
    () => scope?.authorised_branch_ids || scope?.branch_ids || [],
    [scope]
  );

  const branches = useMemo(() => {
    const locales = ubicaciones.filter((item) => item.tipo === "LOCAL" || !item.tipo);
    if (isAdmin) return locales.length ? locales : ubicaciones;
    return locales.filter((item) =>
      authorisedIds.some((id) => String(id) === String(item.id))
    );
  }, [ubicaciones, isAdmin, authorisedIds]);

  useEffect(() => {
    if (!branches.some((branch) => String(branch.id) === selectedBranchId)) {
      setSelectedBranchId(branches[0] ? String(branches[0].id) : "");
    }
  }, [branches, selectedBranchId]);

  const currentLocal = branches.find(
    (branch) => String(branch.id) === String(selectedBranchId)
  );

  const reportingCd = useMemo(
    () =>
      ubicaciones.find((item) => item.id === scope?.reporting_cd_id)?.nombre ||
      ubicaciones.find((item) => item.tipo === "CD")?.nombre ||
      "Centro de distribución central",
    [scope, ubicaciones]
  );

  const userName = user?.displayName || user?.name || "Operador";
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const productoMap = useMemo(() => {
    const map = new Map();
    for (const p of productos) {
      map.set(p.id, p);
    }
    return map;
  }, [productos]);

  // Cargar órdenes activas y sus bultos estructurados con mapBultoToUI
  const fetchOrdenesActivas = useCallback(async () => {
    setLoadingOrdenes(true);
    try {
      const resp = await logisticaService.listarOrdenes();
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      const activas = items.filter(
        (o) =>
          o.estado === "PENDIENTE" ||
          o.estado === "EN_PREPARACION" ||
          o.estado === "APROBADA"
      );
      setOrdenes(activas);

      const bMap = {};
      await Promise.all(
        activas.map(async (ord) => {
          try {
            const bRes = await logisticaService.listarBultosPorOrden(ord.id);
            const bList = Array.isArray(bRes) ? bRes : bRes?.data || [];
            bMap[ord.id] = bList
              .map(mapBultoToUI)
              .filter((b) => b && b.estado !== "RECHAZADO");
          } catch (e) {
            bMap[ord.id] = [];
          }
        })
      );
      setTodosBultosMap(bMap);
    } catch (e) {
      setOrdenes([]);
    } finally {
      setLoadingOrdenes(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdenesActivas();
  }, [fetchOrdenesActivas]);

  // Calcular items y progreso operacional por cada orden activa
  const ordenesDetalladas = useMemo(() => {
    return ordenes.map((ord) => {
      const bultos = todosBultosMap[ord.id] || [];
      const embaladosMap = new Map();
      for (const b of bultos) {
        if (b.estado === "RECHAZADO") continue;
        for (const det of b.detalles || []) {
          const pid = det.productoId || det.producto_id;
          const cant = Number(det.cantidad) || 0;
          embaladosMap.set(pid, (embaladosMap.get(pid) || 0) + cant);
        }
      }

      const items = (ord.detalles || []).map((det) => {
        const pid = det.productoId || det.producto_id;
        const solicitado = Number(det.cantidadSolicitada || det.cantidad_solicitada) || 0;
        const embalado = embaladosMap.get(pid) || 0;
        const restante = Math.max(0, solicitado - embalado);
        return {
          id: det.id || pid,
          productoId: pid,
          solicitado,
          embalado,
          restante,
        };
      });

      const restanteTotal = items.reduce((acc, it) => acc + it.restante, 0);
      const solicitadoTotal = items.reduce((acc, it) => acc + it.solicitado, 0);
      const embaladoTotal = items.reduce((acc, it) => acc + it.embalado, 0);

      return {
        ...ord,
        items,
        restanteTotal,
        solicitadoTotal,
        embaladoTotal,
        bultos,
      };
    });
  }, [ordenes, todosBultosMap]);

  // Órdenes con items pendientes de embalar (restanteTotal > 0)
  const ordenesPorEmbalar = useMemo(() => {
    return ordenesDetalladas.filter((o) => o.restanteTotal > 0);
  }, [ordenesDetalladas]);

  // Bultos clasificados por su estado procesable directo
  const {
    bultosSinPrecinto,
    bultosPorAprobar,
    bultosAprobadosSinRemito,
    gruposBultosPorEmitirRemito,
  } = useMemo(() => {
    const sinPrecinto = [];
    const porAprobar = [];
    const aprobadosSinRem = [];
    const gruposMap = new Map();
    // el DTO de bulto no trae el remito: se deduce de los remitos emitidos
    const enRemito = new Set(remitos.flatMap((r) => r.bultosIds || []));

    for (const ord of ordenesDetalladas) {
      for (const b of ord.bultos) {
        if (b.estado === "RECHAZADO" || b.remitoNumero || enRemito.has(b.id)) continue;

        const bultoMeta = {
          ...b,
          ordenId: ord.id,
          destinoId: ord.destino_id || ord.destinoId,
        };

        // 1. Solo PREPARADO sin precinto puede precintarse
        if (b.estado === "PREPARADO" && !b.codigoPrecinto) {
          sinPrecinto.push(bultoMeta);
        }
        // 2. Solo PRECINTADO sin aprobar puede aprobarse
        else if (b.estado === "PRECINTADO" && !b.aprobado) {
          porAprobar.push(bultoMeta);
        }
        // 3. Solo APROBADO sin remito puede emitirse a remito
        else if (b.estado === "APROBADO" || b.aprobado) {
          aprobadosSinRem.push(bultoMeta);
          if (!gruposMap.has(ord.id)) {
            gruposMap.set(ord.id, {
              ordenId: ord.id,
              destinoId: bultoMeta.destinoId,
              bultos: [],
            });
          }
          gruposMap.get(ord.id).bultos.push(bultoMeta);
        }
      }
    }

    return {
      bultosSinPrecinto: sinPrecinto,
      bultosPorAprobar: porAprobar,
      bultosAprobadosSinRemito: aprobadosSinRem,
      gruposBultosPorEmitirRemito: Array.from(gruposMap.values()),
    };
  }, [ordenesDetalladas, remitos]);

  // Remitos listos para salir a transporte
  const remitosPorDespachar = useMemo(() => {
    return remitos.filter(
      (r) =>
        r.estado === "GENERADO" ||
        r.estado === "EN_PREPARACION" ||
        r.estado === "EMITIDO"
    );
  }, [remitos]);

  // Remitos activos en destino para control
  const remitosActivosControl = useMemo(() => {
    if (!selectedBranchId) return [];
    return remitos.filter(
      (r) =>
        String(r.destinoId) === String(selectedBranchId) &&
        r.estado !== "CERRADO"
    );
  }, [remitos, selectedBranchId]);

  const inTransit = useMemo(
    () =>
      remitosActivosControl.filter(
        (item) => item.estado === "DESPACHADO" || item.estado === "EN_TRANSITO"
      ),
    [remitosActivosControl]
  );

  const pendingControl = useMemo(
    () =>
      remitosActivosControl.filter(
        (item) =>
          item.estado === "RECIBIDO" &&
          (item.bultosPendientes > 0 || item.progresoOperacional?.pendientes > 0)
      ),
    [remitosActivosControl]
  );

  const closable = useMemo(
    () =>
      remitosActivosControl.filter(
        (item) =>
          item.estado === "RECIBIDO" &&
          item.totalBultos > 0 &&
          (item.bultosPendientes === 0 || item.progresoOperacional?.pendientes === 0)
      ),
    [remitosActivosControl]
  );

  // Conteo de trabajo: CADA UNIDAD REPRESENTA UNA TARJETA PARA ACTUAR
  const work = useMemo(() => {
    const porArmar =
      ordenesPorEmbalar.length + bultosSinPrecinto.length + bultosPorAprobar.length;
    const porDespachar =
      gruposBultosPorEmitirRemito.length + remitosPorDespachar.length;
    const porControlar = inTransit.length + pendingControl.length + closable.length;
    const total = porArmar + porDespachar + porControlar;

    return {
      porArmar,
      porDespachar,
      porControlar,
      inTransit,
      pending: pendingControl,
      closable,
      total,
    };
  }, [
    ordenesPorEmbalar.length,
    bultosSinPrecinto.length,
    bultosPorAprobar.length,
    gruposBultosPorEmitirRemito.length,
    remitosPorDespachar.length,
    inTransit,
    pendingControl,
    closable,
  ]);

  // Acciones operativas directas: toast de éxito o de error, nunca alert del navegador
  const ok = (title, msg) => notifySuccess(title, msg);
  const fail = (err, action) => notifyError(err, { entity: "Operación", action });
  // Si el servidor rechaza, lo más probable es que el dato esté desactualizado: recargar
  const refresh = async () => {
    reload();
    await fetchOrdenesActivas();
  };

  const handleRecibirRemito = async (numero) => {
    try {
      await logisticaService.recibirRemito(numero);
      ok("Arribo registrado", `Remito ${numero} recibido. Ya podés controlar los precintos.`);
      reload();
    } catch (err) {
      fail(err, "registrar el arribo");
      reload();
    }
  };

  const handleOpenRemitoControl = async (remitoNumero) => {
    try {
      setLoadingRemitoDetalle(true);
      const data = await logisticaService.obtenerRemito(remitoNumero);
      setActiveRemitoDetalle(data);
      setSheetControlOpen(true);
    } catch (err) {
      fail(err, "cargar el remito");
    } finally {
      setLoadingRemitoDetalle(false);
    }
  };

  const handleSaveControlBulto = async ({ bultoId, precintoLeido, estaIntacto, motivoRechazo }) => {
    await logisticaService.verificarBulto(bultoId, {
      codigoPrecintoRecibido: precintoLeido,
      estaIntacto,
      motivoRechazo,
    });
    if (activeRemitoDetalle?.numero) {
      const refreshed = await logisticaService.obtenerRemito(activeRemitoDetalle.numero);
      setActiveRemitoDetalle(refreshed);
    }
    ok(
      estaIntacto ? "Bulto verificado" : "Merma registrada",
      estaIntacto ? `Bulto #${bultoId} verificado correctamente.` : `Bulto #${bultoId} marcado como merma.`
    );
    reload();
  };

  const handleCerrarRemito = async (numero) => {
    try {
      const res = await logisticaService.cerrarRemito(numero);
      setSheetControlOpen(false);
      ok(
        "Remito cerrado",
        `Remito ${numero}: stock acreditado ${res.unidades_acreditadas || 0} u, mermas ${res.unidades_merma || 0} u.`
      );
      reload();
    } catch (err) {
      fail(err, "cerrar el remito");
    }
  };

  const handleCrearBulto = async (ordenId, items) => {
    try {
      await logisticaService.crearBulto(ordenId, items);
      ok("Bulto armado", `Bulto armado para la orden #${ordenId}.`);
      await fetchOrdenesActivas();
    } catch (err) {
      fail(err, "armar el bulto");
      await refresh();
      throw err;
    }
  };

  const handlePrecintarBulto = async (bultoId, precintoCodigo) => {
    const codigo = precintoCodigo?.trim();
    if (!codigo) {
      const err = new Error("Ingresá el código del precinto físico.");
      fail(err, "precintar");
      throw err;
    }
    try {
      // igual que el admin: el precinto se da de alta y solo se tolera "ya existe" (409)
      try {
        await logisticaService.registrarPrecinto(codigo);
      } catch (e) {
        if (e?.status !== 409) throw e;
      }
      await logisticaService.precintarBulto(bultoId, codigo);
      ok("Precinto colocado", `Precinto ${codigo} colocado en el bulto #${bultoId}.`);
      await fetchOrdenesActivas();
    } catch (err) {
      fail(err, "precintar el bulto");
      await refresh();
      throw err;
    }
  };

  // ejecuta una acción simple: toast de éxito o error y recarga en ambos casos
  const run = async (action, title, msg, fn) => {
    try {
      await fn();
      ok(title, msg);
    } catch (err) {
      fail(err, action);
    }
    await refresh();
  };

  const handleAprobarBulto = (id) =>
    run("aprobar el bulto", "Bulto aprobado", `Bulto #${id} aprobado para despacho.`, () =>
      logisticaService.aprobarBulto(id));

  const handleGenerarRemito = (ordenId, bultosIds) =>
    run("emitir el remito", "Remito emitido", "Remito generado, listo para despachar.", () =>
      logisticaService.generarRemito(ordenId, { bultosIds }));

  const handleDespacharRemito = (numero) =>
    run("despachar el remito", "Remito despachado", `Remito ${numero} salió a transporte.`, () =>
      logisticaService.despacharRemito(numero));

  return {
    user,
    scope,
    logout,
    isAdmin,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    currentLocal,
    reportingCd,
    userName,
    initials,
    work,
    loading,
    loadError,
    reload,
    activeTab,
    setActiveTab,
    logoutOpen,
    setLogoutOpen,
    loggingOut,
    setLoggingOut,
    ordenesDetalladas,
    ordenesPorEmbalar,
    bultosSinPrecinto,
    bultosPorAprobar,
    bultosAprobadosSinRemito,
    gruposBultosPorEmitirRemito,
    remitosPorDespachar,
    remitosActivosControl,
    inTransit,
    pendingControl,
    closable,
    loadingOrdenes,
    productoMap,
    sheetControlOpen,
    setSheetControlOpen,
    activeRemitoDetalle,
    loadingRemitoDetalle,
    sheetArmadoOpen,
    setSheetArmadoOpen,
    targetOrdenForArmado,
    setTargetOrdenForArmado,
    handleRecibirRemito,
    handleOpenRemitoControl,
    handleSaveControlBulto,
    handleCerrarRemito,
    handleCrearBulto,
    handlePrecintarBulto,
    handleAprobarBulto,
    handleGenerarRemito,
    handleDespacharRemito,
  };
}

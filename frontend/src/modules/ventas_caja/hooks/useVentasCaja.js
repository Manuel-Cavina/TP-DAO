import { useAsync, useMutation } from "../../../shared/hooks";
import { ventasService } from "../services";

function dateISO(daysFromToday = 0) {
  const today = new Date();
  today.setDate(today.getDate() + daysFromToday);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(day, days) {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(year, month - 1, date + days);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
}

// La API publica fechas locales sin zona: comparar el día evita convertirlas a UTC.
const inPeriod = (item, start, end) => {
  const day = String(item.fecha || "").slice(0, 10);
  return day >= start && day <= end;
};

export function useVentasCaja({ localId, enabled = true, desde, hasta } = {}) {
  const periodStart = desde || dateISO(-30);
  const periodEnd = hasta || dateISO();
  const today = dateISO();
  const eligibilityStart = shiftDate(today, -30);
  // Una devolución del período puede pertenecer a una venta de hasta 30 días antes.
  // También se incluyen las ventas devolvibles hoy, independientemente del filtro de caja.
  const historyStart = shiftDate(periodStart < today ? periodStart : today, -30);
  const historyEnd = periodEnd > today ? periodEnd : today;
  const canLoad = enabled && Number.isSafeInteger(Number(localId)) && Number(localId) > 0;

  const {
    data,
    status,
    error,
    reload,
    loading,
  } = useAsync(
    async ({ signal }) => {
      const historialVentas = await ventasService.listarVentas(
        { localId, desde: `${historyStart}T00:00:00`, hasta: `${historyEnd}T23:59:59.999999` },
        { signal }
      );
      const [devolucionesPrevias, caja] = await Promise.all([
        ventasService.listarDevoluciones({ ventas: historialVentas }, { signal }),
        ventasService.consultarCaja(
          { localId, desde: periodStart, hasta: periodEnd },
          { signal }
        ),
      ]);
      return {
        localId: Number(localId), periodStart, periodEnd,
        ventas: historialVentas.filter((venta) => inPeriod(venta, periodStart, periodEnd)),
        // El backend valida el plazo exacto de 30 días y el saldo acumulado al confirmar.
        ventasParaDevolver: historialVentas.filter((venta) => inPeriod(venta, eligibilityStart, today)),
        devoluciones: devolucionesPrevias.filter((devolucion) => inPeriod(devolucion, periodStart, periodEnd)),
        devolucionesPrevias,
        caja,
      };
    },
    [localId, periodStart, periodEnd, today],
    { enabled: canLoad }
  );

  const ventaMutation = useMutation(
    (dto) => ventasService.procesarVenta(dto),
    { successMessage: "Venta cobrada y comprobante emitido", onSuccess: reload }
  );

  const devolucionMutation = useMutation(
    (dto) => ventasService.registrarDevolucion(dto),
    { successMessage: "Devolución registrada", onSuccess: reload }
  );

  const comprobanteMutation = useMutation((ventaId) =>
    ventasService.obtenerComprobante(ventaId)
  );

  const currentData = canLoad && data?.localId === Number(localId)
    && data.periodStart === periodStart && data.periodEnd === periodEnd ? data : null;
  const caja = currentData?.caja || {
    cantidadVentas: 0,
    totalVentas: 0,
    cantidadDevoluciones: 0,
    totalDevoluciones: 0,
    saldo: 0,
  };

  return {
    ventas: currentData?.ventas || [],
    devoluciones: currentData?.devoluciones || [],
    ventasParaDevolver: currentData?.ventasParaDevolver || [],
    devolucionesPrevias: currentData?.devolucionesPrevias || [],
    caja,
    hasData: Boolean(currentData),
    periodo: { desde: periodStart, hasta: periodEnd },
    status,
    error,
    loading,
    reload,
    procesarVenta: ventaMutation.mutate,
    ventaPending: ventaMutation.pending,
    ventaError: ventaMutation.error,
    registrarDevolucion: devolucionMutation.mutate,
    devPending: devolucionMutation.pending,
    devError: devolucionMutation.error,
    obtenerComprobante: comprobanteMutation.mutate,
    comprobantePending: comprobanteMutation.pending,
  };
}

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

export function useVentasCaja({ localId, enabled = true, desde, hasta } = {}) {
  const periodStart = desde || dateISO(-30);
  const periodEnd = hasta || dateISO();
  const canLoad = enabled && Number.isSafeInteger(Number(localId)) && Number(localId) > 0;

  const {
    data,
    status,
    error,
    reload,
    loading,
  } = useAsync(
    async ({ signal }) => {
      const ventas = await ventasService.listarVentas(
        { localId, desde: `${periodStart}T00:00:00`, hasta: `${periodEnd}T23:59:59.999999` },
        { signal }
      );
      const [devoluciones, caja] = await Promise.all([
        ventasService.listarDevoluciones({ ventas }, { signal }),
        ventasService.consultarCaja(
          { localId, desde: periodStart, hasta: periodEnd },
          { signal }
        ),
      ]);
      return { localId: Number(localId), ventas, devoluciones, caja };
    },
    [localId, periodStart, periodEnd],
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

  const currentData = data?.localId === Number(localId) ? data : null;
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

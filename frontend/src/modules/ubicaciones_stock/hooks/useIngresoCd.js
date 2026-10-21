import { useState, useCallback } from "react";
import { useMutation } from "../../../shared/hooks";
import { stockService } from "../services";

/**
 * Hook para la gestión del ingreso de mercadería a CD y cálculo de impacto de stock.
 */
export function useIngresoCd({ onSuccess } = {}) {
  const [lastMovement, setLastMovement] = useState(null);

  const consultarSaldoAnterior = useCallback(async (cdId, productoId) => {
    if (!cdId || !productoId) return 0;
    try {
      const resp = await stockService.consultarDisponible({
        ubicacionId: Number(cdId),
        productoId: Number(productoId),
      });
      const data = resp?.data || resp;
      return Number(data?.cantidad_disponible) || 0;
    } catch {
      return 0;
    }
  }, []);

  const calcularImpacto = useCallback((saldoAnterior, cantidad) => {
    const saldo = Number(saldoAnterior) || 0;
    const cant = Number(cantidad) || 0;
    return {
      saldoAnterior: saldo,
      cantidadIngresada: cant,
      nuevoSaldoProyectado: saldo + cant,
    };
  }, []);

  const mutation = useMutation(
    async (payload) => {
      const {
        cdId,
        cdNombre,
        proveedorId,
        proveedorNombre,
        productoId,
        productoNombre,
        cantidad,
        comprobante,
        saldoAnterior = 0,
      } = payload;

      const dto = {
        cd_id: Number(cdId),
        producto_id: Number(productoId),
        cantidad: Number(cantidad),
        comprobante: comprobante?.trim() || undefined,
      };

      const resp = await stockService.ingresoCD(dto);

      const movementInfo = {
        cdId: Number(cdId),
        cdNombre: cdNombre || `CD #${cdId}`,
        proveedorId: proveedorId || null,
        proveedorNombre: proveedorNombre || "Proveedor registrado",
        productoId: Number(productoId),
        productoNombre: productoNombre || `Producto #${productoId}`,
        saldoAnterior: Number(saldoAnterior),
        cantidad: Number(cantidad),
        nuevoSaldo: Number(saldoAnterior) + Number(cantidad),
        comprobante: comprobante?.trim() || "Sin comprobante",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setLastMovement(movementInfo);
      if (onSuccess) {
        onSuccess(movementInfo);
      }
      return resp;
    },
    { successMessage: "Mercadería ingresada exitosamente al Centro de Distribución" }
  );

  const clearLastMovement = useCallback(() => {
    setLastMovement(null);
  }, []);

  return {
    ingresar: mutation.mutate,
    pending: mutation.pending,
    fieldErrors: mutation.fieldErrors,
    error: mutation.error,
    lastMovement,
    clearLastMovement,
    consultarSaldoAnterior,
    calcularImpacto,
  };
}

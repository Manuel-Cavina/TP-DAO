from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel

from modules.reportes.application import Resultado_Reporte
from modules.reportes.domain import Existencia, Merma_Bulto, Producto_Vendido, Tiempo_Transito_Local, Ventas_Por_Medio_Pago
from modules.reportes.dto import (
    Existencia_DTO,
    Merma_DTO,
    Producto_Vendido_DTO,
    Reporte_DTO,
    Tiempo_Transito_DTO,
    Ventas_Medio_Pago_DTO,
)

Fila = TypeVar("Fila")
Fila_DTO = TypeVar("Fila_DTO", bound=BaseModel)


class Reportes_Mapper:
    """Conversor de los resultados de reportes (filas de dominio + totales + gráfico) a DTOs."""

    @staticmethod
    def a_dto(resultado: Resultado_Reporte[Fila], convertir: Callable[[Fila], Fila_DTO]) -> Reporte_DTO[Fila_DTO]:
        return Reporte_DTO(
            filas=[convertir(fila) for fila in resultado.filas],
            totales=resultado.totales,
            grafico=resultado.grafico,
        )

    @staticmethod
    def ventas(f: Ventas_Por_Medio_Pago) -> Ventas_Medio_Pago_DTO:
        return Ventas_Medio_Pago_DTO(
            local_id=f.local_id,
            local_nombre=f.local_nombre,
            medio_pago=f.medio_pago,
            cantidad_ventas=f.cantidad_ventas,
            total_bruto=f.total_bruto,
            cantidad_devoluciones=f.cantidad_devoluciones,
            total_devoluciones=f.total_devoluciones,
            total_neto=f.total_neto,
        )

    @staticmethod
    def producto(f: Producto_Vendido) -> Producto_Vendido_DTO:
        return Producto_Vendido_DTO(
            producto_id=f.producto_id,
            codigo=f.codigo,
            nombre=f.nombre,
            unidades_vendidas=f.unidades_vendidas,
            unidades_devueltas=f.unidades_devueltas,
            unidades_netas=f.unidades_netas,
            ingresos=f.ingresos,
            costo=f.costo,
            margen=f.margen,
            margen_porcentaje=f.margen_porcentaje,
            margen_negativo=f.margen_negativo,
        )

    @staticmethod
    def existencia(f: Existencia) -> Existencia_DTO:
        return Existencia_DTO(
            producto_id=f.producto_id,
            codigo=f.codigo,
            nombre=f.nombre,
            ubicacion_id=f.ubicacion_id,
            ubicacion_nombre=f.ubicacion_nombre,
            cantidad_disponible=f.cantidad_disponible,
            cantidad_en_transito=f.cantidad_en_transito,
            nivel_minimo_existencia=f.nivel_minimo_existencia,
            faltante=f.faltante,
            en_o_bajo_minimo=f.en_o_bajo_minimo,
            valorizacion=f.valorizacion,
        )

    @staticmethod
    def merma(f: Merma_Bulto) -> Merma_DTO:
        return Merma_DTO(
            bulto_id=f.bulto_id,
            remito_numero=f.remito_numero,
            local_id=f.local_id,
            local_nombre=f.local_nombre,
            fecha_rechazo=f.fecha_rechazo,
            unidades_perdidas=f.unidades_perdidas,
            valor_perdido=f.valor_perdido,
            productos=list(f.productos),
        )

    @staticmethod
    def transito(f: Tiempo_Transito_Local) -> Tiempo_Transito_DTO:
        return Tiempo_Transito_DTO(
            local_id=f.local_id,
            local_nombre=f.local_nombre,
            cantidad_bultos=f.cantidad_bultos,
            promedio_horas=f.promedio_horas,
            minimo_horas=f.minimo_horas,
            maximo_horas=f.maximo_horas,
        )

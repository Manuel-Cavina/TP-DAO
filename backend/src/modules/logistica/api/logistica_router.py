from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Query, Request, status

from modules.logistica.application import (
    Despacho_Service,
    Empaquetado_Service,
    Recepcion_Service,
    Reposicion_Service,
    Trazabilidad_Service,
)
from modules.logistica.dto import (
    Aprobar_Bulto_Request_DTO,
    Aprobar_Elegibles_Response_DTO,
    Bulto_DTO,
    Busqueda_Logistica_Response_DTO,
    Cierre_Remito_Response_DTO,
    Consolidar_Orden_Request_DTO,
    Control_Bultos_Batch_Request_DTO,
    Control_Bultos_Batch_Response_DTO,
    Crear_Bulto_Request_DTO,
    Crear_Orden_Manual_Request_DTO,
    Evento_Trazabilidad_DTO,
    Generar_Remito_Request_DTO,
    Item_Control_Bulto_Request_DTO,
    Item_Control_Bulto_Response_DTO,
    Item_Precintar_Bulto_DTO,
    Necesidad_Reposicion_DTO,
    Orden_Reposicion_DTO,
    Precintar_Bulto_Request_DTO,
    Precintar_Lote_Request_DTO,
    Precinto_DTO,
    Registrar_Necesidad_Request_DTO,
    Registrar_Precinto_Request_DTO,
    Remito_DTO,
    Resumen_Remito_Trazabilidad_Response_DTO,
    Trazabilidad_Bulto_Response_DTO,
    Trazabilidad_Orden_Response_DTO,
    Verificar_Bulto_Request_DTO,
)
from modules.logistica.infrastructure import Stock_Logistica_Adapter
from modules.logistica.mappers import (
    Bulto_Mapper,
    Orden_Reposicion_Mapper,
    Precinto_Mapper,
    Remito_Mapper,
)
from modules.seguridad.api.dependencies import (
    obtener_usuario_actual,
    requerir_rol,
    validar_alcance_operador,
)
from modules.seguridad.domain.usuario import ROL_ADMIN, ROL_OPERADOR, Usuario

router = APIRouter(
    prefix="/api/logistica",
    tags=["Logística y Trazabilidad de Bultos"],
    dependencies=[Depends(requerir_rol(ROL_OPERADOR))],
)
# Crear órdenes y cargar necesidades a mano es tarea del Administrador (CU 11).
Solo_Admin = [Depends(requerir_rol(ROL_ADMIN))]

Id_Path = Annotated[int, Path(gt=0, le=2**63 - 1)]


# Inyeccion de dependencias desacoplada para FastAPI. Las rutas no capturan BusinessError:
# el handler global traduce cada excepcion tipada a 400, 404 o 409.
# Al publicar Integrante 1 su Stock_Service, solo se reemplaza el adaptador aqui.
def get_reposicion_service() -> Reposicion_Service:
    return Reposicion_Service(Stock_Logistica_Adapter())


def get_empaquetado_service() -> Empaquetado_Service:
    return Empaquetado_Service(Stock_Logistica_Adapter())


def get_despacho_service() -> Despacho_Service:
    return Despacho_Service(Stock_Logistica_Adapter())


def get_recepcion_service() -> Recepcion_Service:
    return Recepcion_Service(Stock_Logistica_Adapter())


def get_trazabilidad_service() -> Trazabilidad_Service:
    return Trazabilidad_Service()


# -------------------------------------------------------------------------
# Necesidades de Reposición y Órdenes (P3)
# -------------------------------------------------------------------------


@router.post(
    "/necesidades",
    status_code=status.HTTP_201_CREATED,
    summary="Registrar necesidad de reposicion (usado por Observer de Stock o carga manual)",
    dependencies=Solo_Admin,
)
def registrar_necesidad(
    req: Registrar_Necesidad_Request_DTO,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> dict[str, Any]:
    nid = service.registrar_necesidad(
        producto_id=req.producto_id,
        local_id=req.local_id,
        cantidad=req.cantidad,
    )
    return {
        "mensaje": (
            "Necesidad registrada correctamente."
            if nid
            else "Ya existia una necesidad pendiente para ese producto y local."
        ),
        "id": nid,
    }


@router.get(
    "/necesidades",
    response_model=list[Necesidad_Reposicion_DTO],
    summary="Listar necesidades pendientes",
)
def listar_necesidades(
    local_id: int | None = Query(None, gt=0, le=2**63 - 1, description="Filtrar por local destino"),
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> list[Necesidad_Reposicion_DTO]:
    pendientes = service.listar_necesidades_pendientes(local_id)
    return [
        Necesidad_Reposicion_DTO(
            id=p["id"],
            producto_id=p["producto_id"],
            local_id=p["local_id"],
            cantidad=p["cantidad"],
            estado=p["estado"],
            fecha_registro=p["fecha_registro"],
        )
        for p in pendientes
    ]


@router.post(
    "/ordenes/consolidar",
    response_model=Orden_Reposicion_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Consolidar necesidades pendientes en una Orden de Reposicion (P3)",
    dependencies=Solo_Admin,
)
def consolidar_orden(
    req: Consolidar_Orden_Request_DTO,
    request: Request,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> Orden_Reposicion_DTO:
    actor = getattr(request.state, "usuario", None)
    actor_login = actor.login if actor else None
    orden = service.consolidar_necesidades_en_orden(
        local_destino_id=req.local_destino_id,
        origen_id=req.origen_id,
        necesidad_ids=req.necesidad_ids,
        validar_stock=req.validar_stock,
        actor=actor_login,
    )
    return Orden_Reposicion_Mapper.a_dto(orden)


@router.post(
    "/ordenes",
    response_model=Orden_Reposicion_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una orden de reposicion manualmente",
    dependencies=Solo_Admin,
)
def crear_orden_manual(
    req: Crear_Orden_Manual_Request_DTO,
    request: Request,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> Orden_Reposicion_DTO:
    actor = getattr(request.state, "usuario", None)
    actor_login = actor.login if actor else None
    orden = service.crear_orden_manual(
        origen_id=req.origen_id,
        destino_id=req.destino_id,
        items=[it.model_dump() for it in req.items],
        necesidad_ids=req.necesidad_ids,
        validar_stock=req.validar_stock,
        actor=actor_login,
    )
    return Orden_Reposicion_Mapper.a_dto(orden)


@router.get(
    "/ordenes",
    response_model=list[Orden_Reposicion_DTO],
    summary="Listar ordenes de reposicion",
)
def listar_ordenes(
    estado: str | None = Query(None, description="Filtrar por estado"),
    destino_id: int | None = Query(None, gt=0, le=2**63 - 1, description="Filtrar por local destino"),
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> list[Orden_Reposicion_DTO]:
    if destino_id is not None:
        validar_alcance_operador(usuario, destino_id)
    ordenes = service.listar_ordenes(estado)
    if destino_id is not None:
        ordenes = [o for o in ordenes if o.destino_id == destino_id]
    elif usuario.rol == ROL_OPERADOR:
        if usuario.asignacion is not None:
            ordenes = [
                o
                for o in ordenes
                if usuario.asignacion.puede_operar(o.destino_id)
                or usuario.asignacion.puede_operar(o.origen_id)
            ]
        else:
            ordenes = []
    return [Orden_Reposicion_Mapper.a_dto(o) for o in ordenes]


@router.get(
    "/ordenes/{orden_id}",
    response_model=Orden_Reposicion_DTO,
    summary="Obtener una orden de reposicion por ID",
)
def obtener_orden(
    orden_id: Id_Path,
    service: Reposicion_Service = Depends(get_reposicion_service),
) -> Orden_Reposicion_DTO:
    orden = service.obtener_orden(orden_id)
    return Orden_Reposicion_Mapper.a_dto(orden)


@router.get(
    "/ordenes/{orden_id}/bultos",
    response_model=list[Bulto_DTO],
    summary="Listar bultos armados para una orden",
)
def listar_bultos_por_orden(
    orden_id: Id_Path,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> list[Bulto_DTO]:
    bultos = service.listar_bultos_por_orden(orden_id)
    return [Bulto_Mapper.a_dto(b) for b in bultos]


# -------------------------------------------------------------------------
# Empaquetado, Precintado y Aprobación (P4 / US4)
# -------------------------------------------------------------------------


@router.post(
    "/precintos",
    response_model=Precinto_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un nuevo precinto disponible",
)
def registrar_precinto(
    req: Registrar_Precinto_Request_DTO,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Precinto_DTO:
    precinto = service.registrar_precinto(req.codigo)
    return Precinto_Mapper.a_dto(precinto)


@router.post(
    "/ordenes/{orden_id}/bultos",
    response_model=Bulto_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Empaquetar mercaderia en un nuevo bulto en preparacion (P4)",
)
def crear_bulto(
    orden_id: Id_Path,
    req: Crear_Bulto_Request_DTO,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Bulto_DTO:
    bulto = service.crear_bulto(
        orden_id=orden_id,
        items=[it.model_dump() for it in req.items],
    )
    return Bulto_Mapper.a_dto(bulto)


@router.post(
    "/bultos/{bulto_id}/precintar",
    response_model=Bulto_DTO,
    summary="Precintar bulto individual (State: PREPARADO -> PRECINTADO)",
)
def precintar_bulto(
    bulto_id: Id_Path,
    req: Precintar_Bulto_Request_DTO,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Bulto_DTO:
    bulto = service.precintar_bulto(
        bulto_id=bulto_id,
        codigo_precinto=req.codigo_precinto,
    )
    return Bulto_Mapper.a_dto(bulto)


@router.post(
    "/ordenes/{orden_id}/bultos/precintar",
    response_model=list[Bulto_DTO],
    summary="Precintar lote de bultos revisado (US4 / T044)",
)
def precintar_bultos_lote(
    orden_id: Id_Path,
    payload: list[Item_Precintar_Bulto_DTO] | Precintar_Lote_Request_DTO,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> list[Bulto_DTO]:
    items_raw = payload.items if isinstance(payload, Precintar_Lote_Request_DTO) else payload
    items = [{"bulto_id": it.bulto_id, "codigo_precinto": it.codigo_precinto} for it in items_raw]
    bultos = service.precintar_bultos_lote(orden_id=orden_id, items=items)
    return [Bulto_Mapper.a_dto(b) for b in bultos]


@router.post(
    "/bultos/{bulto_id}/aprobar",
    response_model=Bulto_DTO,
    summary="Aprobar bulto precintado individualmente para remito (US4 / T042, T043)",
)
def aprobar_bulto(
    bulto_id: Id_Path,
    request: Request,
    req: Aprobar_Bulto_Request_DTO | None = None,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Bulto_DTO:
    actor_req = getattr(request.state, "usuario", None)
    actor_login = actor_req.login if actor_req else (req.actor if req else None)
    observacion = req.observacion if (req and req.observacion) else ""
    bulto = service.aprobar_bulto(
        bulto_id=bulto_id,
        actor=actor_login,
        observacion=observacion,
    )
    return Bulto_Mapper.a_dto(bulto)


@router.post(
    "/ordenes/{orden_id}/bultos/aprobar-elegibles",
    response_model=Aprobar_Elegibles_Response_DTO,
    summary="Evaluar y aprobar bultos elegibles de una orden (US4 / T043)",
)
def aprobar_bultos_elegibles(
    orden_id: Id_Path,
    request: Request,
    req: Aprobar_Bulto_Request_DTO | None = None,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Aprobar_Elegibles_Response_DTO:
    actor_req = getattr(request.state, "usuario", None)
    actor_login = actor_req.login if actor_req else (req.actor if req else None)
    observacion = req.observacion if (req and req.observacion) else ""
    resultado = service.aprobar_bultos_elegibles(
        orden_id=orden_id,
        actor=actor_login,
        observacion=observacion,
    )
    return Aprobar_Elegibles_Response_DTO(**resultado)


@router.get(
    "/bultos/{bulto_id}",
    response_model=Bulto_DTO,
    summary="Obtener un bulto por su ID",
)
def obtener_bulto(
    bulto_id: Id_Path,
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Bulto_DTO:
    bulto = service.obtener_bulto(bulto_id)
    return Bulto_Mapper.a_dto(bulto)


# -------------------------------------------------------------------------
# Remitos y Despacho (P4 y P5 / US4)
# -------------------------------------------------------------------------


@router.post(
    "/remitos",
    response_model=Remito_DTO,
    status_code=status.HTTP_201_CREATED,
    summary="Generar remito (US4 / T047)",
)
def generar_remito(
    orden_id: int = Query(..., gt=0, le=2**63 - 1, description="ID de la orden de reposicion"),
    req: Generar_Remito_Request_DTO = ...,
    validar_aprobacion: bool = Query(False, description="Validar que todos los bultos esten aprobados"),
    service: Empaquetado_Service = Depends(get_empaquetado_service),
) -> Remito_DTO:
    es_estricto = req.validar_aprobacion or validar_aprobacion
    remito = service.generar_remito(
        numero=req.numero,
        orden_id=orden_id,
        bultos_ids=req.bultos_ids,
        validar_aprobacion=es_estricto,
    )
    return Remito_Mapper.a_dto(remito)


@router.get(
    "/remitos",
    response_model=list[Remito_DTO],
    summary="Listar todos los remitos",
)
def listar_remitos(
    destino_id: int | None = Query(None, gt=0, le=2**63 - 1, description="Filtrar por local destino"),
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Despacho_Service = Depends(get_despacho_service),
) -> list[Remito_DTO]:
    if destino_id is not None:
        validar_alcance_operador(usuario, destino_id)
    remitos = service.listar_remitos()
    if destino_id is not None:
        remitos = [r for r in remitos if r.destino_id == destino_id]
    elif usuario.rol == ROL_OPERADOR:
        if usuario.asignacion is not None:
            remitos = [
                r
                for r in remitos
                if usuario.asignacion.puede_operar(r.destino_id)
                or usuario.asignacion.puede_operar(r.origen_id)
            ]
        else:
            remitos = []
    return [Remito_Mapper.a_dto(r) for r in remitos]


@router.get(
    "/remitos/{numero}",
    response_model=Remito_DTO,
    summary="Obtener un remito por su numero",
)
def obtener_remito(
    numero: str,
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Despacho_Service = Depends(get_despacho_service),
) -> Remito_DTO:
    remito = service.obtener_remito(numero)
    if usuario.rol == ROL_OPERADOR:
        if not (
            usuario.asignacion is not None
            and (
                usuario.asignacion.puede_operar(remito.destino_id)
                or usuario.asignacion.puede_operar(remito.origen_id)
            )
        ):
            validar_alcance_operador(usuario, remito.destino_id)
    return Remito_Mapper.a_dto(remito)


@router.post(
    "/remitos/{numero}/despachar",
    response_model=Remito_DTO,
    summary="Despachar remito completo (P5, bultos a EN_TRANSITO)",
)
def despachar_remito(
    numero: str,
    service: Despacho_Service = Depends(get_despacho_service),
) -> Remito_DTO:
    remito = service.despachar_remito(numero)
    return Remito_Mapper.a_dto(remito)


# -------------------------------------------------------------------------
# Recepción, Verificación y Cierre de Remito (P6 y Regla V1)
# -------------------------------------------------------------------------


@router.post(
    "/remitos/{numero}/recibir",
    response_model=Remito_DTO,
    summary="Registrar recepcion de remito en destino (P6, bultos a RECIBIDO)",
)
def recibir_remito(
    numero: str,
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Recepcion_Service = Depends(get_recepcion_service),
) -> Remito_DTO:
    remito_prev = service.obtener_remito(numero)
    validar_alcance_operador(usuario, remito_prev.destino_id)
    remito = service.recibir_remito(numero)
    return Remito_Mapper.a_dto(remito)


@router.post(
    "/bultos/{bulto_id}/verificar",
    response_model=Bulto_DTO,
    summary="Verificar precinto fisico de un bulto (State: RECIBIDO -> VERIFICADO o RECHAZADO)",
)
def verificar_bulto(
    bulto_id: Id_Path,
    req: Verificar_Bulto_Request_DTO,
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Recepcion_Service = Depends(get_recepcion_service),
) -> Bulto_DTO:
    destino_id = service.obtener_destino_bulto(bulto_id)
    if destino_id is not None:
        validar_alcance_operador(usuario, destino_id)

    bulto = service.verificar_bulto(
        bulto_id=bulto_id,
        codigo_precinto_recibido=req.codigo_precinto_recibido,
        esta_intacto=req.esta_intacto,
        codigo_esperado=req.codigo_esperado,
        codigo_leido=req.codigo_leido,
        resultado_precinto=req.resultado,
        motivo_rechazo=req.motivo_rechazo,
        actor=usuario.login,
        ubicacion_id=destino_id,
        version=req.version,
    )
    return Bulto_Mapper.a_dto(bulto)


@router.post(
    "/remitos/{numero}/controlar-bultos",
    response_model=Control_Bultos_Batch_Response_DTO,
    summary="Control de precintos por lote atomico en recepcion (US5 / T057)",
)
def controlar_bultos_batch(
    numero: str,
    req: Control_Bultos_Batch_Request_DTO,
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Recepcion_Service = Depends(get_recepcion_service),
) -> Control_Bultos_Batch_Response_DTO:
    remito_prev = service.obtener_remito(numero)
    validar_alcance_operador(usuario, remito_prev.destino_id)
    resultado = service.controlar_bultos_batch(
        remito_numero=numero,
        items=req.items,
        actor=usuario.login,
        ubicacion_id=remito_prev.destino_id,
    )
    return Control_Bultos_Batch_Response_DTO(**resultado)


@router.post(
    "/remitos/{numero}/cerrar",
    response_model=Cierre_Remito_Response_DTO,
    summary="Cerrar remito e impactar stock vendible o merma (Regla V1)",
)
def cerrar_remito(
    numero: str,
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Recepcion_Service = Depends(get_recepcion_service),
) -> Cierre_Remito_Response_DTO:
    remito_prev = service.obtener_remito(numero)
    validar_alcance_operador(usuario, remito_prev.destino_id)
    resultado = service.cerrar_remito(numero)
    return Cierre_Remito_Response_DTO(**resultado)


# -------------------------------------------------------------------------
# Trazabilidad Inmutable (Regla V2 / US3, US5)
# -------------------------------------------------------------------------


@router.get(
    "/trazabilidad/recientes",
    response_model=list[Evento_Trazabilidad_DTO],
    summary="Listar evidencia operativa reciente para Dashboard y Trazabilidad",
)
def listar_eventos_recientes(
    limite: int = Query(12, ge=1, le=50),
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Trazabilidad_Service = Depends(get_trazabilidad_service),
) -> list[Evento_Trazabilidad_DTO]:
    eventos = service.listar_eventos_recientes(limite)
    if usuario.rol == ROL_OPERADOR:
        if usuario.asignacion is None:
            return []
        eventos = [
            evento
            for evento in eventos
            if (evento.origen_id is not None and usuario.asignacion.puede_operar(evento.origen_id))
            or (evento.destino_id is not None and usuario.asignacion.puede_operar(evento.destino_id))
        ]
    return [
        Evento_Trazabilidad_DTO(
            id=evento.id,
            tipo_entidad=evento.tipo_entidad,
            entidad_id=evento.entidad_id,
            accion=evento.accion,
            estado_anterior=evento.estado_anterior,
            estado_nuevo=evento.estado_nuevo,
            actor=evento.actor,
            origen_id=evento.origen_id,
            destino_id=evento.destino_id,
            registros_asociados=evento.registros_asociados,
            motivo_o_evidencia=evento.motivo_o_evidencia,
            fecha_hora=evento.fecha_hora.isoformat(),
        )
        for evento in eventos
    ]


@router.get(
    "/trazabilidad/buscar",
    response_model=Busqueda_Logistica_Response_DTO,
    summary="Busqueda global de entidades logisticas (US5 / T061)",
)
def buscar_logistica(
    termino: str = Query(..., min_length=1, description="Termino de busqueda (ID o codigo)"),
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Trazabilidad_Service = Depends(get_trazabilidad_service),
) -> Busqueda_Logistica_Response_DTO:
    resultados = service.buscar_logistica(termino)
    if usuario.rol == ROL_OPERADOR:
        if usuario.asignacion is None:
            return Busqueda_Logistica_Response_DTO(ordenes=[], remitos=[], bultos=[])
        ordenes_filtradas = [
            o
            for o in resultados["ordenes"]
            if usuario.asignacion.puede_operar(o["origen_id"])
            or usuario.asignacion.puede_operar(o["destino_id"])
        ]
        remitos_filtrados = [
            r
            for r in resultados["remitos"]
            if usuario.asignacion.puede_operar(r["origen_id"])
            or usuario.asignacion.puede_operar(r["destino_id"])
        ]
        bultos_filtrados = [
            b
            for b in resultados["bultos"]
            if (b.get("origen_id") is not None and usuario.asignacion.puede_operar(b["origen_id"]))
            or (b.get("destino_id") is not None and usuario.asignacion.puede_operar(b["destino_id"]))
        ]
        return Busqueda_Logistica_Response_DTO(
            ordenes=ordenes_filtradas,
            remitos=remitos_filtrados,
            bultos=bultos_filtrados,
        )
    return Busqueda_Logistica_Response_DTO(**resultados)


@router.get(
    "/trazabilidad/remitos/{numero}",
    response_model=Resumen_Remito_Trazabilidad_Response_DTO,
    summary="Consultar resumen y trazabilidad completa de un remito (US5 / T061)",
)
def consultar_resumen_remito(
    numero: str,
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: Trazabilidad_Service = Depends(get_trazabilidad_service),
) -> Resumen_Remito_Trazabilidad_Response_DTO:
    resumen = service.consultar_resumen_remito(numero)
    validar_alcance_operador(usuario, resumen["destino_id"])
    return Resumen_Remito_Trazabilidad_Response_DTO(**resumen)


@router.get(
    "/bultos/{bulto_id}/trazabilidad",
    response_model=Trazabilidad_Bulto_Response_DTO,
    summary="Consultar trazabilidad inmutable y linea de tiempo de un bulto (V2)",
)
def consultar_trazabilidad(
    bulto_id: Id_Path,
    service: Trazabilidad_Service = Depends(get_trazabilidad_service),
) -> Trazabilidad_Bulto_Response_DTO:
    resumen = service.consultar_resumen_trazabilidad(bulto_id)
    return Trazabilidad_Bulto_Response_DTO(**resumen)


@router.get(
    "/ordenes/{orden_id}/trazabilidad",
    response_model=Trazabilidad_Orden_Response_DTO,
    summary="Consultar trazabilidad inmutable y linea de tiempo de una orden (US3)",
)
def consultar_trazabilidad_orden(
    orden_id: Id_Path,
    service: Trazabilidad_Service = Depends(get_trazabilidad_service),
) -> Trazabilidad_Orden_Response_DTO:
    resumen = service.consultar_resumen_orden(orden_id)
    return Trazabilidad_Orden_Response_DTO(**resumen)

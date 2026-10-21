# Stocky Interface Contracts

This file defines the target release contract. The official Sales/Cash endpoints from `main` are integrated now; the missing authentication, idempotency and external-payment controls are tracked explicitly in T083-T089 and block production approval.

All mutations require an authenticated session, authoritative role/scope validation, typed backend validation, and atomic persistence. Errors use the existing application error envelope and field-level details where applicable.

## Authentication and authorization

### `POST /api/seguridad/login`

Input: `{ "login": string, "password": string }`.

Success sets an HttpOnly SameSite=Strict session cookie (`Secure` outside local development) and returns a session-bound CSRF token for the in-memory frontend client:

```json
{
  "user": { "id": 1, "name": "Ana Admin", "role": "ADMIN" },
  "scope": { "reporting_cd_id": null, "branch_ids": [] },
  "csrf_token": "opaque-session-bound-token"
}
```

Invalid credentials return one generic authentication error. Inactive users cannot sign in.

### `GET /api/seguridad/me` and `POST /api/seguridad/logout`

`me` returns the same user/scope shape. `logout` revokes the server session and clears the cookie.

`/api/auth/*` remains as a compatibility alias; the frontend uses `/api/seguridad/*`.

Every non-idempotent request sends `X-CSRF-Token`; missing, incorrect, or cross-session tokens are rejected before business logic.

Permission rules:

- `ADMIN`: every Administrator and Operator action.
- `OPERADOR`: assigned logistics reads/actions only; no master-data, sales, report, user, or unrestricted location mutation.
- Every scoped backend query and mutation verifies the requested origin/destination against the authenticated assignment.

## Shared UI surfaces

- Master create/edit opens a right drawer and preserves the underlying list filters/selection.
- Blocking modal/drawer is portalled outside route transitions, traps focus, closes with Escape unless a mutation is committing, restores trigger focus, locks background scroll, and keeps header/footer reachable.
- A task context renders at most one `primary` action. Alternative, filter, export, and destructive actions use `secondary`, `ghost`, and `danger` respectively.
- Successful mutations show a specific toast containing entity and result. Validation stays at field level; global toast does not replace field errors.

## Searchable relationship selector

- Up to seven meaningful options may render directly.
- More than seven uses keyboard-accessible search with 20 results per page, a loading state, no-results state, retry state, selected-record summary, and clear action.
- Search keys: product code/name, category id/name, provider CUIT/name, location id/name, user id/name.
- The submitted value is the stable entity identifier, never the display label.

## Live operational read

Every active list/detail response exposes `version` or `updated_at`. The UI:

- refreshes immediately after a local mutation and every 15 seconds while visible;
- displays `Actualizado hace ...` and the exact timestamp on demand;
- keeps last known data when refresh fails and labels it stale;
- disables confirmation until a fresh version is retrieved;
- sends the observed version with a mutation; a conflict reloads data and explains what changed.

## Catalog bulk update

### Preview

Frontend selection supports one rule per confirmation:

- fixed price;
- increase current price by percentage;
- decrease current price by percentage;
- fixed minimum, category, provider, or active state.

The preview shows product code/name, prior value, rule, percentage when applicable, monetary difference, proposed value, and row validation.

### Commit

`POST /api/catalogo/productos/actualizacion-masiva` sends explicit final values plus an operation descriptor. The backend revalidates every selected product and commits all or none. One invalid or stale product returns row errors and changes nothing.

## Package approval

### Individual

`POST /api/logistica/bultos/{id}/aprobar`

Input: `{ "version": string, "observation": string|null }`.

Eligible only when the package is `PRECINTADO`, complete, within order quantities, and not already approved. Success writes one immutable approval event and returns refreshed package/eligibility data.

### Batch

`POST /api/logistica/ordenes/{id}/bultos/aprobar-elegibles`

Input: `{ "package_versions": [{"id": 1, "version": "..."}], "observation": null }`.

Output contains `approved[]` and `blocked[]`, with one explicit reason per blocked package. It never reports a blocked package as approved and writes one event per approved package.

### Seal assignment

Individual sealing uses `POST /api/logistica/bultos/{id}/precintar`. Reviewed batch sealing uses `POST /api/logistica/ordenes/{id}/bultos/precintar` with one package id/version and one unique seal code per row. Any missing, duplicate, used, or invalid code rejects the whole batch without partial sealing. Package approval occurs after sealing.

## Complete delivery note and dispatch

`POST /api/logistica/ordenes/{id}/remito` does not accept a package subset. It validates:

- no delivery note already exists for the order;
- packaged quantities exactly equal ordered quantities;
- every package belongs to the order, has a current approval, and is `PRECINTADO`;
- origin/destination equal the order route.

Success creates exactly one delivery note containing every order package. Dispatch acts on that complete delivery note only.

## Receipt and seal control

### Individual control

`POST /api/logistica/bultos/{id}/verificar` requires observed version, expected seal, read seal, result `INTACTO|VIOLADO`, and a reason for `VIOLADO`. It writes one seal-control/traceability event and returns `VERIFICADO` or `RECHAZADO`.

### Batch control

`POST /api/logistica/remitos/{numero}/controlar-bultos`

Input contains one row for every selected unresolved package with package id/version, expected seal, read seal, result, and reason. Missing or invalid rows reject the whole request. Success returns one outcome per package and never infers intact status.

Delivery-note closure is enabled only after every package is `VERIFICADO` or `RECHAZADO`; its confirmation lists stock accreditation and loss totals before committing.

## Detail and traceability reads

Global search accepts an exact/partial order id, delivery-note number, or package id and returns typed results. Order, delivery-note, and package detail responses share:

- entity id/type, current state, version/freshness;
- origin, destination, responsible actor;
- related order, delivery note, and package links;
- contents and quantities;
- blockers and one next valid action;
- stock impact;
- immutable timeline with actor, timestamp, location, evidence/reason, related documents, and stock movement.

Opening a related record preserves the originating query/filter in navigation state.

## Operations Kanban

- Preparation/dispatch declares entity type Replenishment order; reception/control declares entity type Delivery note. A board never mixes types.
- Every stage column remains rendered, including empty columns.
- Card schema: order id, origin -> destination, stage/state badges, units/products/packages progress, blocker, responsible avatar/name, freshness, and one action.
- Drag applies a visual tilt only. Drop opens the exact required modal/drawer/page; cancellation restores the card; confirmation refreshes server state before moving it.
- List view exposes the same records, filters, and actions without drag.

## Dashboard, alerts, and notifications

Administrator home combines actionable alerts, pending work, lifecycle workload, recent movements, and trend indicators. Every alert includes severity, entity, age, reason, and a concrete resolution action opening an already-filtered destination.

Notification control opens a panel with unread/read state, category, timestamp, related entity, and direct action. It is not a navigation-only button.

Operator home shows reporting CD, current assignment/branch, shift label, actionable work ordered by urgency/age, and at most one primary next action per card.

Trend indicators state metric, value, comparison window, numeric delta, direction text, and favourable/unfavourable/neutral meaning; color is supplementary.

## Sales and Cash contract

- `POST /api/ventas`: persists one branch sale with `local_id`, `items[{producto_id,cantidad}]`, and one discriminated payment: `EFECTIVO{monto_recibido}`, `TARJETA{numero_tarjeta,cuotas}`, or `TRANSFERENCIA{cbu_o_alias,codigo_transaccion}`.
- `GET /api/ventas?local_id=&desde=&hasta=` and `GET /api/ventas/{venta_id}`: list or retrieve persisted sales.
- `GET /api/ventas/{venta_id}/comprobante`: retrieves the correlated receipt, payment detail, surcharge and change.
- `POST|GET /api/ventas/{venta_id}/devoluciones`: persists and lists returns linked to the original sale; the request contains `local_id`, `motivo`, and `items`.
- `GET /api/caja/{local_id}?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`: returns sales, refunds and net cash for the inclusive period.

The frontend maps these snake_case DTOs at the service boundary, requests all payment fields required by the selected Strategy, never sends client-calculated prices or totals as authority, and reports success only after a successful response. The legacy unregistered files `ventas_caja_router.py`, `ventas_dto.py`, `ventas_mapper.py`, and `estrategias_pago.py` are not part of this contract.

## Formal reports and PDF

R1 and R2 use one validated snapshot for interactive totals, CSV/JSON, and PDF.

`POST /api/reportes/{r1|r2}/pdf` accepts validated filters and returns `application/pdf` with a deterministic filename. The document includes Stocky identity, report/version, filters, issue timestamp, freshness, actor, findings, static visuals, detail rows, page number/count, and landscape appendices where needed. It excludes application navigation and interactive controls.

PDF tests must extract title, filters, actor, boundary rows, and page metadata, and render representative portrait/landscape pages without clipping.

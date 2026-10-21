# Stocky UX and Operational Data Model

This document defines the data required by the approved UI. Existing domain models remain authoritative; new records are introduced only where authentication or immutable action evidence is missing.

## Identity and scope

| Entity | Required fields | Rules |
|---|---|---|
| User | id, display name, login, password hash, role, active | Role is `ADMIN` or `OPERADOR`; login is unique and normalised; inactive users cannot authenticate |
| Session | hashed opaque token, user id, created at, expires at, revoked at | Raw token exists only in the HttpOnly cookie; logout/revocation invalidates it |
| Operator assignment | user id, reporting CD id, authorised branch ids, shift/label, active | Operator actions and selectors are restricted to this scope; Administrators bypass assignment restrictions |

Development seed data must create at least one Administrator and one Operator from environment-provided passwords. Passwords are never committed or returned by an API.

## Master and stock entities

| Entity | Required UI information | Relationship and validation |
|---|---|---|
| Location | numeric id, name, type `CD|LOCAL`, active | Logistics origin is an active CD; destination is an active Local; inactive records remain visible historically |
| Category | id, name, active | Search by id/name; inactive categories cannot be selected for new products |
| Provider | id, CUIT, legal name, active | CUIT and name searchable; inactive providers cannot be assigned to new products |
| Product | code, name, category, provider, cost, price, minimum, active | Code is unique; monetary values are positive decimals; minimum is a positive integer |
| Stock position | product, location, quantity, minimum, freshness | Quantity and minimum are non-negative; state is derived as healthy/low/out |
| Stock movement | id, product, location, signed quantity, reason, source entity, actor, timestamp | Immutable and linked to the operation that caused it |

## Catalog bulk proposal

A bulk update is a transient proposal containing:

- selected product codes;
- exactly one intended attribute/rule per confirmation;
- rule `SET_FIXED`, `INCREASE_PERCENT`, or `DECREASE_PERCENT` for price;
- validated percentage greater than 0 and at most 100 for percentage rules;
- prior value, proposed value, monetary difference, and validation result per product;
- one atomic confirmation id/version.

If any row is invalid, no product is updated. The backend recalculates and validates the final values inside one transaction.

## Logistics entities

| Entity | Required UI information | Relationship and rule |
|---|---|---|
| Need | id, product, destination branch, quantity, status, created at | Only needs for one destination enter an order |
| Replenishment order | id, origin CD, destination Local, lines, status, responsible, version, timestamps | One origin and destination; exactly one delivery note; requested quantities must be fully packaged |
| Package | id, order id, contents, state, seal, approval evidence, history | Contents cannot exceed remaining order quantities; complete sealed packages require approval evidence before delivery-note emission |
| Package approval event | id, package id, actor, timestamp, package version/content hash, result, observation | Immutable; eligible package is complete and sealed; batch approval writes one event per eligible package |
| Seal | code, intact flag, package association | Code unique; derived UI condition is Available, Assigned, Conforming, or Incident; it is not a package lifecycle state |
| Seal-control event | id, package id, expected code, read code, result, reason, actor, location, timestamp | Result is `INTACTO|VIOLADO`; violation requires a reason; one event per package |
| Delivery note | number, order id, origin, destination, package ids, document state, version, timestamps | Unique order id; contains every package for that order; partial emission/dispatch forbidden |
| Traceability event | id, entity type/id, action, prior/resulting state, actor, location, timestamp, related records, reason/evidence, stock movement id | Immutable and returned oldest-to-newest for detail timelines |

## Canonical state machines

### Need

`PENDIENTE -> CONSOLIDADA`

- `PENDIENTE`: actionable for its destination branch.
- `CONSOLIDADA`: linked to exactly one replenishment order.

### Replenishment order

`PENDIENTE -> EN_PREPARACION -> DESPACHADA -> CERRADA`

- `PENDIENTE`: created, no package work started.
- `EN_PREPARACION`: package work exists or has begun.
- `DESPACHADA`: its unique complete delivery note was dispatched.
- `CERRADA`: its delivery note was received, every package controlled, and stock/loss posted.

### Package

`PREPARADO -> PRECINTADO -> EN_TRANSITO -> RECIBIDO -> VERIFICADO|RECHAZADO`

- Approval does not add a state. It is required evidence while the package remains `PRECINTADO`, before delivery-note emission.
- `VERIFICADO` and `RECHAZADO` are terminal.
- `VERIFICADO` credits sellable destination stock on delivery-note closure.
- `RECHAZADO` records loss and never credits sellable stock.

### Delivery note

`EMITIDO -> DESPACHADO -> RECIBIDO -> CERRADO`

- Transit is derived from package state `EN_TRANSITO`; the UI must not label it as an additional persisted delivery-note state.
- Legacy persisted `EN_TRANSITO` delivery-note values, if found, are read as `DESPACHADO` and must not be written again.

### Seal

`AVAILABLE -> ASSIGNED -> CONFORMING|INCIDENT` is a derived UI lifecycle:

- `AVAILABLE`: intact and not assigned.
- `ASSIGNED`: attached to a prepared/sealed package before destination control.
- `CONFORMING`: related package finished as `VERIFICADO` with matching code.
- `INCIDENT`: seal was reported violated, missing, or mismatched; evidence lives in the seal-control event.

## Derived operational stages for Kanban

These are presentation stages, not persisted states:

- Preparation/dispatch, entity `Order`: `POR_PREPARAR`, `EMPAQUETANDO`, `FALTA_PRECINTAR`, `PENDIENTE_APROBACION`, `PARA_REMITO`, `PARA_DESPACHO`.
- Reception/control, entity `Delivery note`: `EN_TRANSITO`, `POR_RECIBIR`, `PENDIENTE_CONTROL`, `CON_INCIDENCIA`, `CERRADA`.

Each card exposes one next valid action. A drop selects an intended action and opens its confirmation/data-entry surface. Boards never mix Order and Delivery-note cards.

## Report snapshot

| Field | Meaning |
|---|---|
| report id/version | Identifies R1 or R2 and its schema version |
| filters | Exact location, product/category/provider, and date filters |
| issued at / freshness | Snapshot and source-data timestamps |
| actor | Authenticated Administrator producing the document |
| summary/findings | Deterministic totals and prioritised exceptions |
| detail rows | Boundary-complete records used by the PDF and raw export |
| denominator | For R2, package population filtered to the same period as rejected packages |

The PDF, CSV, and JSON export consume the same validated snapshot so totals cannot diverge.

# Implementation Plan: Stocky Operational UX

**Branch**: `001-stocky-operational-ux`  
**Date**: 2026-10-20  
**Specification**: [spec.md](./spec.md)  
**Approved visual baseline**: [../../docs/prototipo_wireframes_stocky.html](../../docs/prototipo_wireframes_stocky.html)

## Summary

Complete the existing React/FastAPI application as one role-aware Stocky ERP experience. Preserve the current catalog, stock, logistics, operational Sales/Cash, and reporting modules; close the remaining gaps instead of replacing them. The implementation must provide an Administrator workspace, a focused mobile-first Operator workspace, complete order/package/delivery-note traceability, individual and batch package/seal controls, one complete delivery note per order, professional PDF exports, and a consistent graphite visual system with one primary action per task context.

The approved prototype and supporting UX documents define presentation and interaction intent. `spec.md` remains the authority for behavior and acceptance.

## Technical Context

**Frontend**: Node.js 22, JavaScript, React 18, React Router 6, Vite 6, existing shared Stocky components and CSS tokens  
**Backend**: Python 3.14, FastAPI, SQLAlchemy 2, existing modular services/repositories and request-scoped transaction middleware  
**Storage**: SQLite through existing SQLAlchemy models and repositories  
**Authentication**: opaque server-side sessions in an HttpOnly, SameSite=Strict cookie (`Secure` outside local development), session-bound CSRF token for mutations, PBKDF2-HMAC-SHA256 password hashes using the Python standard library, and roles `ADMIN`/`OPERADOR`  
**PDF**: ReportLab for deterministic server-generated documents; pypdf in tests for machine-readable assertions  
**Testing**: pytest, `frontend/scripts/check_frontend.mjs`, production build, focused component/service checks, and the manual responsive scenarios in [quickstart.md](./quickstart.md)  
**Target**: responsive web application; Administrator desktop-first, Operator mobile-first; supported validation widths 320 px, 390 px, 1366 px, 1606 px, and 1759 px  
**Refresh contract**: visible operational lists/details refresh at most every 15 seconds, display freshness, retain last known data on failure, and disable state-changing confirmation while stale  
**Scale contract**: multiple distribution centers and branches; bulk catalog preview for at least 50 products; one order may contain multiple products and packages  
**Scope boundary**: The existing Sales and Cash backend merged from `main` is authoritative and may receive only compatibility/integration corrections required by this branch. A second router, persistence model, or accounting subsystem is forbidden. Authentication, authorization, idempotency, logistics traceability, and PDF endpoints remain explicit implementation work required before production release.

No unresolved clarification remains.

## Integration baseline and ownership

| Area | Source of truth | Local treatment | Current state |
|---|---|---|---|
| Git history | `origin/main` at `85f8587` | merged into `CayetanoAmaro/feautere-1`; upstream branch is not rewritten or pushed | Integrated |
| Sales/Cash backend | `backend/src/modules/ventas_caja/` from `main` | preserve official routes, DTOs, models and transaction semantics | Integrated |
| Stock/replenishment bridge | existing Stock and Logistics application services | adapt the Sales/Cash stock port so a sale updates stock, alert and replenishment need | Integrated |
| Sales/Cash frontend | this feature branch | map official snake_case DTOs, remove demo storage, enforce local stock and cumulative-return limits | Integrated |
| Production controls | this feature specification | add session scope, authorization, idempotency and honest external-payment state | Pending; blocks production |

The merge is local to the feature branch. No command in this implementation modifies `origin/main`; future upstream changes enter only through another reviewed merge.

## Constitution Check

The repository constitution is an unfilled template, so it imposes no active project principles. This plan still applies the repository's existing constraints:

- reuse existing modules and shared components before adding new abstractions;
- keep business validation authoritative in backend services;
- keep request writes atomic through the existing request-scoped transaction;
- add dependencies only where the requirement cannot be met reliably with the platform (`reportlab` and test-only `pypdf` for formal PDF output);
- do not add a workflow engine, global form store, component library, or new frontend state framework.

## Approved Decisions

### Roles and operational scope

- `ADMIN` can access every administrative and Operator action.
- `OPERADOR` sees only assigned/actionable logistics work and authorised centers/branches.
- Every operational page shows active role, reporting distribution center, selected assigned branch when applicable, and origin/destination for the current task.
- Backend authorization is authoritative; hidden navigation is not a permission boundary.

### Navigation and page composition

- Administrator shell: control panel, Operation, Management, Traceability, Reports, and Sales/Cash UI groups.
- Operator shell: My work, Preparation, Dispatch, Receipt, and Traceability.
- Creation/edit of master records uses a right-side drawer. Short confirmations use a modal. Multi-step or time-separated work uses a full page.
- Each task context has exactly one visually primary action. Alternatives use secondary, ghost, or danger hierarchy.

### Package approval, seal control, and delivery note

- Package lifecycle remains `PREPARADO -> PRECINTADO -> EN_TRANSITO -> RECIBIDO -> VERIFICADO|RECHAZADO`.
- Approving a complete sealed package is an immutable audit event, not a package state. Every package must have individual approval evidence before it can enter the order's delivery note.
- `Approve all` processes only currently eligible packages, records one event per package, and returns explicit blocked-package reasons.
- Receipt control records expected seal, read seal, `INTACTO|VIOLADO`, actor, timestamp, and required reason for violations. Batch control still requires an explicit result per package.
- An order has exactly one delivery note. It is emitted only when all ordered quantities are packaged, all packages are approved and sealed, and every package in the order is included. Partial delivery notes and partial dispatch are rejected by the backend.

### State and traceability model

- Order: `PENDIENTE -> EN_PREPARACION -> DESPACHADA -> CERRADA`.
- Delivery note: `EMITIDO -> DESPACHADO -> RECIBIDO -> CERRADO`. Package `EN_TRANSITO` supplies transit progress; the UI does not invent a delivery-note transit state.
- Need: `PENDIENTE -> CONSOLIDADA`.
- Seal condition and assignment are displayed separately from package state.
- Every state/action event includes entity, prior/resulting state or action, actor, timestamp, location, related records, evidence/reason, and stock movement when applicable.

### Live UI and Kanban

- Preparation/dispatch Kanban cards are replenishment orders; reception/control Kanban cards are delivery notes. A board never mixes entity types, and columns are derived operational stages rather than new persisted states.
- All columns remain visible through a horizontally scrollable board. Dragging a card rotates it approximately 3 degrees and opens the exact modal/drawer/page needed for the target action; dropping never persists directly.
- List view is functionally equivalent and keyboard accessible.

### Formal reporting

- R1 covers stock health, shortages, transit, and valuation by location/product.
- R2 covers rejected packages, seal incidents, economic impact, and a rejection denominator filtered to the same period.
- PDF generation uses a validated server snapshot, deterministic pagination, static graphics/tables, one Stocky header, filters, version, issued-at, actor, freshness, and page numbers.

## Project Structure

```text
backend/src/modules/
├── seguridad/                 # new authenticated users, sessions, roles, assignments
├── catalogo/                  # existing catalog and atomic bulk updates
├── ubicaciones_stock/         # existing locations, stock, alerts and movements
├── logistica/                 # existing lifecycle plus approvals and unified traceability
├── reportes/                  # existing report data plus deterministic PDF generation
└── ventas_caja/               # official persisted API merged from main

frontend/src/
├── app/
│   ├── auth/                  # new provider, route guards and login page
│   ├── dashboard/             # new Administrator and Operator homes
│   └── layout/                # role-aware shell composition
├── modules/
│   ├── catalogo/
│   ├── ubicaciones_stock/
│   ├── logistica/
│   ├── reportes/
│   └── ventas_caja/           # client and UI for the official API
└── shared/                    # overlays, search selectors, live state, notifications, tokens
```

## Delivery Phases

1. **Foundation**: authentication, authorization, role-aware shells, navigation, shared overlays, searchable selectors, validation/toasts, action hierarchy, and live-data contract.
2. **Approved visual baseline**: encode the approved graphite/Apple-like tokens and interaction rules; do not reopen design direction.
3. **Masters**: locations and catalog drawers, validated searchable relationships, fixed/percentage bulk updates, atomic backend validation, and previews.
4. **Inventory and control panel**: stock, incoming stock, actionable alerts, notifications, pending work, recent movements, trend indicators, and filtered deep links.
5. **Distribution**: needs, order wizard, package approval, sealing, one complete delivery note, dispatch, receipt, individual/batch seal control, closure, Kanban/list, and full detail traceability.
6. **Sales and Cash**: persisted sale, payment, receipt, cash, and linked return experience over `/api/ventas` and `/api/caja`, with contract mapping and honest failure states.
7. **Audit and PDF**: R1/R2 operational views, validated snapshots, professional server-generated PDFs, and raw CSV/JSON exports.
8. **Acceptance**: backend/frontend checks, role and permission tests, responsive visual inspection, keyboard/accessibility checks, stale/concurrency/error cases, and full business journey validation.
9. **Sales/Cash production hardening**: authenticated branch scope, mutation idempotency, minimized payment evidence, explicit external payment/refund status, bounded reads, and a final security/reconciliation gate.

Phases 1 and 2 block feature completion. Masters and report work may proceed in parallel after Foundation. Distribution must be implemented in lifecycle order. Acceptance starts per story and ends with the complete journey.

| Approved delivery phase | Executable task phase(s) |
|---|---|
| 1. Foundation | Tasks Phase 1-2 |
| 2. Approved visual baseline | Tasks Phase 2 and Phase 10 visual acceptance |
| 3. Masters | Tasks Phase 3 / US1 |
| 4. Inventory and control panel | Tasks Phase 4 / US2 |
| 5. Distribution | Tasks Phases 5-7 / US3-US5 |
| 6. Sales and Cash UI | Tasks Phase 8 / US6 |
| 7. Audit and PDF | Tasks Phase 9 / US7 |
| 8. Acceptance | Tasks Phase 10 |

## Quality Gates

- Every `FR-001` through `FR-044` maps to at least one task and acceptance scenario.
- Every state-changing UI action names the entity, resulting state/action, prerequisites, evidence, actor context, and stock consequence before confirmation.
- Every API mutation rejects unauthorised roles/scopes and invalid/stale input without partial writes.
- No screen exposes more than one primary action in the same task context.
- No blocking overlay clips or loses actions at the supported widths; keyboard focus is trapped/restored.
- One order cannot produce more than one delivery note or omit any eligible package.
- Every approved package and seal result has its own immutable event.
- Production frontend build, architecture check, backend tests, PDF extraction tests, and quickstart scenarios pass.

## Implementation Handoff

[tasks.md](./tasks.md) is the authoritative implementation backlog. Existing code is a baseline, not proof of completion: each task must verify the current behavior, retain conforming code, and implement only the stated gap. A task is complete only when its listed test or independent story check passes.

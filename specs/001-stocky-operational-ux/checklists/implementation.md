# Implementation evidence

**Last verified**: 2026-10-21  
**Feature branch**: `CayetanoAmaro/feautere-1`  
**Integrated upstream**: `origin/main` at `85f858745e0148a32b3a9a2e681a3dafb64cffde`  
**Local merge commit**: `55297ec`

## Integration boundary

- [x] `origin/main` is an ancestor of the feature branch; the upstream branch was not rewritten or pushed.
- [x] The official `modules/ventas_caja` routers, DTOs, models and services from `main` are the only Sales/Cash backend contract.
- [x] Parallel legacy router/DTO/mapper/payment files are absent from the active tree.
- [x] Existing feature work was restored after the merge; the pre-merge safety snapshot remains in stash `f649e744bbcd3096678e9dfa251bc93b87e54ad5`.

## Sales and Cash integration

- [x] Frontend persists sales through `POST /api/ventas` and reads receipts through `/api/ventas/{id}/comprobante`.
- [x] Cash uses `GET /api/caja/{local_id}` and returns use `/api/ventas/{id}/devoluciones`.
- [x] Cash, card and transfer payloads are discriminated and validated at the frontend boundary; the backend remains authoritative for prices and totals.
- [x] The POS is disabled for distribution centers, loads local stock, prevents selection over the displayed balance and refreshes stock after sale/return.
- [x] A successful sale remains successful if the subsequent receipt read fails, preventing a duplicate retry from the UI.
- [x] Returns cover the prior 30 days, subtract earlier returns per sale/product and leave final validation to the backend.
- [x] A sale that reaches minimum stock creates both an alert and a pending replenishment need through existing Stock/Logistics services.
- [x] Browser demo/localStorage persistence and the old mock flag are not used by Sales/Cash.

## User Story 2: Receive and monitor inventory (T027 - T034)

- [x] Dashboard unifies operational alerts, pending work, recent movements, lifecycle workload, and direct links without page duplication (FR-024).
- [x] Every live indicator states its comparison window, numeric direction, and operational meaning in text without color dependence (FR-044).
- [x] Dashboard alerts navigate to prefiltered destinations in exactly one action (FR-024, FR-026, SC-011).
- [x] Task contexts maintain at most one visually primary action at a time (FR-043, SC-022).
- [x] Operative notification panel with read/unread filtering, timestamp, category, linked entity and direct resolution (FR-024).
- [x] AlertasPage provides explicit resolution buttons ("Marcar leída", "Reponer", "Ingresar stock") and preserves filter state across navigation (FR-026).
- [x] StockPage and IngresoCdModal enforce 15-second live freshness, validate CD selection strictly for provider ingress, preview operational impact, and refresh state upon mutation (FR-020, FR-028, SC-014).

## Automated evidence

- [x] Modular structure check: passed.
- [x] Repository conventions check: passed.
- [x] Full backend suite: 147 tests passed.
- [x] Focused Sales/Cash suite: 112 tests passed, including alert plus replenishment need.
- [x] Frontend `npm run check`: passed, including Sales/Cash contract assertions.
- [x] Frontend production build: passed; 149 modules transformed.

## Required before production

- [ ] Complete T083-T084: authenticated session, CSRF, role authorization and branch isolation.
- [ ] Complete T085: idempotency for sale and return mutations.
- [ ] Complete T086-T087: minimize financial identifiers and represent external payment/refund confirmation honestly.
- [ ] Complete T088: bounded/paginated reads without one return request per sale.
- [ ] Complete T089 and record security/concurrency/reconciliation evidence.

## Manual evidence still pending

- [ ] Execute the complete quickstart journey against a running backend and seeded database.
- [ ] Verify the approved desktop and mobile viewports and attach screenshots.
- [ ] Verify keyboard/focus behavior and screen-reader names for the Sales/Cash journey.



## Requirements-to-tests Acceptance Manifest (T004)

### Functional Requirements Traceability (FR-001 - FR-044)

| Requirement | Primary tasks | Verification Status |
|---|---|---|
| FR-001 (Brand and navigation) | T003, T013, T017, T080 | Verified in shared tokens and AppShell |
| FR-002 (Task navigation hierarchy) | T013, T019, T026 | Verified in AppShell TASK_GROUPS |
| FR-003 (Locations CD and Local) | T020, T026 | Verified in UbicacionesPage and backend |
| FR-004 (Catalog master data) | T021-T024 | Verified in ProductosPage and drawers |
| FR-005 (Bulk updates preview and rollback) | T022-T025 | Verified in test_catalogo_bulk.py and UI |
| FR-006 (Origin and destination explicit) | T036, T038, T048, T050, T054, T058 | Verified in logistics flows |
| FR-007 (Sequential replenishment stages) | T035-T063 | Verified in order-packaging-dispatch-reception |
| FR-008 (Single destination constraint) | T035-T037, T040 | Verified in test_reposicion_workflow.py |
| FR-009 (Complete packaging and sealing before remit) | T042-T050, T057-T062 | Verified in logistics domain |
| FR-010 (Stock consequence intact vs violated seal) | T056-T059, T062 | Verified in test_recepcion_trazabilidad_workflow |
| FR-011 (Accessible keyboard navigation) | T014-T019, T076 | Verified in WireframeOverlays focus and Escape |
| FR-012 (Dialogs in viewport) | T014, T019, T076, T080 | Verified in motion.css and wireframe-tokens.css |
| FR-013 (Ventas y Caja official contract) | T064-T067, T083-T089 | Verified: 112 focused tests passed |
| FR-014 (Two audit views: action vs formal) | T068-T075 | Verified in ReportesPage and R1/R2 |
| FR-015 (Formal audit export layout) | T068-T072, T074-T075 | Verified in ReporteImprimiblePage |
| FR-016 (No clipping in long/wide tables) | T070, T072, T075 | Verified with landscape-appendix |
| FR-017 (Standard loading, empty and error states) | T018-T019, T077 | Verified in Feedback.jsx |
| FR-018 (Role-tailored experience Admin vs Operador) | T005-T013, T054-T055 | Verified in LoginPage and dashboards |
| FR-019 (Skeleton wireframes approved baseline) | T080 and prototype | Verified in prototipo_wireframes_stocky.html |
| FR-020 (Multi-CD network topology) | T035-T040 | Verified in backend location model |
| FR-021 (One delivery note per replenishment order) | T047-T050, T052 | Verified: unique order_id constraint |
| FR-022 (Desktop-first Admin, Mobile-first Operador) | T013, T019, T054, T063, T080 | Verified in responsive layouts |
| FR-023 (Operador home limited to assigned work) | T013, T054, T063 | Verified in OperatorDashboardPage |
| FR-024 (Admin control panel with actionable alerts) | T027-T034 | Verified in AdminDashboardPage |
| FR-025 (Traceability traversal across documents) | T038, T050, T060-T061 | Verified in TrazabilidadPage |
| FR-026 (Bidirectional navigation without lost filter) | T038, T050, T060 | Verified in logistics detail views |
| FR-027 (Distinct document vs package states) | T049-T050 | Verified: DESPACHADO vs EN_TRANSITO |
| FR-028 (15-second freshness and staleness block) | T016, T032, T077 | Verified in useLiveResource |
| FR-029 (Immutable traceability event schema) | T039, T042-T043, T056-T062 | Verified in evento_trazabilidad |
| FR-030 (Standardized detail view structure) | T038, T050, T060 | Verified in order, remito, bulto pages |
| FR-031 (Kanban drop opens confirmation without mutating) | T051, T053, T076 | Verified in KanbanPage |
| FR-032 (State-change panels with explicit evidence) | T016, T045, T050-T051, T058 | Verified in WireframeOverlays |
| FR-033 (Canonical state machines) | T039, T042, T049, T056, T061 | Verified in data-model.md |
| FR-034 (Deterministic R1/R2 exports) | T068-T072, T074-T075 | Verified in ReportesService |
| FR-035 (R1 stock health and R2 seal loss rates) | T068-T075 | Verified in ReporteStock and ReporteMermas |
| FR-036 (Server-enforced role permissions) | T005-T013, T055, T062, T083-T084 | In progress (Phase 2 backend auth) |
| FR-037 (Active operational scope displayed) | T005, T013, T054-T055, T063, T083-T084 | Verified in AppShell context strip |
| FR-038 (Dual validation: frontend UX + authoritative backend) | T018, T020-T025, T077 | Verified in form controls and API |
| FR-039 (Searchable paginated selectors for >7 options) | T015, T021, T064 | Verified in SearchableSelect |
| FR-040 (Bulk percentage pricing with preview) | T022-T025 | Verified in ActualizacionMasivaModal |
| FR-041 (Package approval evidence without extra state) | T042-T046, T052-T053 | Verified in empaquetado |
| FR-042 (Individual and batch seal verification) | T056-T063 | Verified in RecepcionPage and drawer |
| FR-043 (One visually primary action per task context) | T017, T024, T028, T045, T050-T051, T054, T073, T080 | Enforced in CSS and UI hierarchy |
| FR-044 (Text-based trend indicators with favorable meaning) | T031, T073, T080 | Verified in DomainWidgets trend chips |

### Success Criteria (SC-001 - SC-022)

| Criteria | Description | Verification Target |
|---|---|---|
| SC-001 | 2 navigation selections to any area | AppShell navigation groups |
| SC-002 | Location or product create in < 3 min | Modal and drawer entry |
| SC-003 | Replenishment order in < 8 min | CrearOrdenPage wizard |
| SC-004 | Receipt seal decision in < 2 min | BultoDetallePage verification |
| SC-005 | 100% dialogs usable at 320px-1759px | WireframeOverlays responsive checks |
| SC-006 | Formal exports unclipped with 1 header | ReporteImprimiblePage |
| SC-007 | First-attempt task discovery | Task groups and dashboard links |
| SC-008 | State transitions visible in detail | Trazabilidad timeline |
| SC-009 | Sales/returns identify stock and cash | POS and FacturaModal |
| SC-010 | Operator reaches state in <= 3 actions | OperatorDashboardPage cards |
| SC-011 | Dashboard alert deep links to filtered list | AdminDashboardPage alert actions |
| SC-012 | Bulk update review before confirmation | ActualizacionMasivaModal |
| SC-013 | Global search reaches history in <= 2 actions | Trazabilidad search |
| SC-014 | Freshness <= 15s, stale blocks confirmation | useLiveResource |
| SC-015 | Kanban drop recognized as intent | KanbanPage modal confirmation |
| SC-016 | State actions name consequence and record event | Action modals |
| SC-017 | PDF automated title, filters and boundaries | pypdf test assertions |
| SC-018 | Role isolation: Operator blocked from admin | Backend auth dependencies |
| SC-019 | Field correction before submit and in backend | FormControls and DTO validation |
| SC-020 | 50-product price percentage update with rollback | test_catalogo_bulk.py |
| SC-021 | Traceable package approvals and seal audits | Historial and trazabilidad |
| SC-022 | Primary action recognized in < 5s | Button visual hierarchy |

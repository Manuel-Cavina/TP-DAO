# Tasks: Stocky Operational UX

**Sources**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [UI contracts](./contracts/ui-contracts.md), and the approved [HTML prototype](../../docs/prototipo_wireframes_stocky.html).

**Status rule**: this is the authoritative remaining implementation backlog as of 2026-10-20. Existing code is a baseline. For each task, retain conforming behavior, implement the stated gap, and mark the task complete only after its verification passes. Previous completion marks were removed because they predated FR-040 through FR-044 and the final role/traceability decisions.

## Phase 1: Setup and executable quality gates

**Goal**: make the approved scope and its automated checks executable before feature work.

- [x] T001 Add ReportLab runtime and pypdf test dependencies with bounded versions in `backend/requirements.txt`
- [x] T002 Add non-secret Administrator/Operator seed identities and environment-supplied password handling in `backend/scripts/seed_demo.py` and `frontend/.env.example`
- [x] T003 Extend the frontend architecture guard for role routes, no inline styles, supported semantic button variants, and the approved report/export entry points in `frontend/scripts/check_frontend.mjs`
- [x] T004 Add a requirements-to-tests acceptance manifest covering FR-001 through FR-044 and SC-001 through SC-022 in `specs/001-stocky-operational-ux/checklists/implementation.md`

**Checkpoint**: dependencies install, demo identities can be seeded without committed passwords, and the acceptance manifest names a verification owner for every requirement.

## Phase 2: Foundational role, shell, interaction, and live-data contract

**Goal**: provide the blocking security and shared UI primitives required by every story.

- [x] T005 Define `ADMIN`/`OPERADOR` users, assignments, and opaque server sessions in `backend/src/modules/seguridad/domain/usuario.py` and `backend/src/modules/seguridad/infrastructure/models.py`
- [x] T006 Implement PBKDF2-HMAC password verification, hashed session tokens, expiry, revocation, and inactive-user rejection in `backend/src/modules/seguridad/application/auth_service.py`
- [x] T007 Implement login, current-session, logout, session-bound CSRF validation, and role/location-scope dependencies in `backend/src/modules/seguridad/api/seguridad_router.py` and `backend/src/modules/seguridad/api/dependencies.py`
- [x] T008 Register security models/routes and add additive SQLite schema initialization without destructive resets in `backend/src/config/database/model_registry.py`, `backend/src/config/database/legacy_schema_initializer.py`, and `backend/src/config/api/router_registry.py`
- [x] T009 [P] Verify valid/invalid login, revocation, expiry, inactive users, missing/wrong CSRF tokens, Administrator inheritance, and Operator scope rejection in `backend/tests/modules/seguridad/test_auth_api.py`
- [x] T010 Create session restoration, CSRF-aware mutations, login/logout actions, and authenticated user/scope state in `frontend/src/app/auth/AuthProvider.jsx` and `frontend/src/core/http/httpClient.js`
- [x] T011 Create the accessible Stocky login screen with specific field validation and generic credential failure in `frontend/src/app/auth/LoginPage.jsx`
- [x] T012 Protect application routes and redirect authenticated users to the correct role home in `frontend/src/app/auth/ProtectedRoute.jsx` and `frontend/src/app/router.jsx`
- [x] T013 Make navigation groups, route access, user avatar/role, notification control, and active scope role-aware while preserving Administrator access to Operator actions in `frontend/src/shared/components/AppShell.jsx` and `frontend/src/app/layout/AppLayout.jsx`
- [x] T014 Portal shared modal/drawer surfaces with scroll lock, Escape handling, focus trap/restoration, reachable sticky actions, and mutation-safe closing in `frontend/src/shared/components/Motion.jsx` and `frontend/src/shared/styles/motion.css`
- [x] T015 [P] Implement keyboard-accessible paginated relationship search and 20-row search APIs for product, category, provider, location, and user identifiers in `frontend/src/shared/components/SearchableSelect.jsx`, `backend/src/modules/catalogo/api/catalogo_router.py`, `backend/src/modules/ubicaciones_stock/api/stock_router.py`, and `backend/src/modules/seguridad/api/seguridad_router.py`
- [x] T016 [P] Implement the 15-second freshness/stale/conflict contract without clearing last known data in `frontend/src/shared/hooks/useLiveResource.jsx` and `frontend/src/shared/components/Feedback.jsx`
- [x] T017 Refine compact rounded button styling and enforce one primary action per task context with semantic secondary/ghost/danger variants in `frontend/src/shared/components/Button.jsx`, `frontend/src/shared/styles/tokens.css`, and `frontend/src/shared/styles/components-actions.css`
- [x] T018 Standardise field sanitisation, type/range/length messages, preserved valid input, and specific success/error toasts in `frontend/src/shared/components/FormControls.jsx` and `frontend/src/shared/feedback/ToastContext.jsx`
- [x] T019 Verify Foundation at 320 px, 390 px, 1366 px, 1606 px, and 1759 px using keyboard-only login/navigation/overlay scenarios in `specs/001-stocky-operational-ux/checklists/implementation.md`

**Checkpoint**: unauthenticated access is blocked, role/scope enforcement works at API and UI boundaries, overlays are accessible, and stale data cannot be confirmed.

## Phase 3: User Story 1 - Navigate and administer master data (P1)

**Goal**: an Administrator manages locations and catalog records quickly, including safe bulk updates.

**Independent test**: create/edit/deactivate a location and master record, search a large relationship set, then atomically increase and decrease 50 product prices by percentage with one invalid-row rollback.

- [x] T020 [P] [US1] Complete create/edit/deactivate drawers for CDs and branches with historical inactive references in `frontend/src/modules/ubicaciones_stock/components/UbicacionModal.jsx` and `frontend/src/modules/ubicaciones_stock/pages/UbicacionesPage.jsx`
- [x] T021 [P] [US1] Complete create/edit/deactivate drawers for products, categories, and providers using searchable relationships in `frontend/src/modules/catalogo/components/ProductoDrawer.jsx`, `frontend/src/modules/catalogo/components/CategoriaModal.jsx`, and `frontend/src/modules/catalogo/components/ProveedorModal.jsx`
- [x] T022 [US1] Extend the bulk proposal to choose exactly one attribute/rule, support fixed or percentage price changes, and preview prior/rule/delta/result per selected product in `frontend/src/modules/catalogo/components/ActualizacionMasivaModal.jsx`
- [x] T023 [US1] Support bulk category, provider, active state, price, and minimum payload validation while preserving the existing atomic transaction in `backend/src/modules/catalogo/dto/catalogo_dto.py`, `backend/src/modules/catalogo/application/producto_service.py`, and `backend/src/modules/catalogo/api/catalogo_router.py`
- [x] T024 [US1] Keep selected rows and filters stable across preview errors/success and expose only one page-level primary action in `frontend/src/modules/catalogo/pages/ProductosPage.jsx`
- [x] T025 [P] [US1] Verify rollback on any invalid/stale row, percentage boundaries, inactive relationships, 50-product updates, and sanitised inputs in `backend/tests/modules/catalogo/api/test_catalogo_bulk.py`
- [x] T026 [US1] Verify the master-data journey, keyboard drawers, searchable selectors, button hierarchy, and under-three-minute outcome in `specs/001-stocky-operational-ux/checklists/implementation.md`

## Phase 4: User Story 2 - Receive and monitor inventory (P1)

**Goal**: an Administrator sees the whole operation in one control panel and resolves stock work from actionable alerts.

**Independent test**: open one home page, resolve an alert through its filtered destination, record incoming stock at a selected CD, inspect recent movement/trend context, and use the notification panel.

- [x] T027 [P] [US2] Compose actionable alerts, pending work, lifecycle counts, recent movements, and comparison-window trends from existing APIs in `frontend/src/app/dashboard/useAdminDashboard.js`
- [x] T028 [US2] Build the single Administrator control panel with filtered deep links and exactly one primary next action per work card in `frontend/src/app/dashboard/AdminDashboardPage.jsx`
- [x] T029 [P] [US2] Add a real notification panel with unread/read state, category, timestamp, related entity, and direct resolution action in `frontend/src/shared/components/NotificationPanel.jsx`
- [x] T030 [US2] Add explicit resolution buttons to every stock/logistics alert and preserve the alert filter in destination navigation in `frontend/src/modules/ubicaciones_stock/pages/AlertasPage.jsx`
- [x] T031 [P] [US2] Label every live KPI with comparison period, numeric direction, and favourable/unfavourable/neutral meaning in `frontend/src/shared/components/DomainWidgets.jsx`
- [x] T032 [US2] Apply live freshness, selected-CD validation, movement consequence, and mutation refresh to stock/incoming screens in `frontend/src/modules/ubicaciones_stock/pages/StockPage.jsx`, `frontend/src/modules/ubicaciones_stock/components/IngresoCdModal.jsx`, and `frontend/src/modules/ubicaciones_stock/hooks/useStockMatriz.js`
- [x] T033 [P] [US2] Verify incoming-stock, minimum-alert, movement-history, and stale/conflict behavior in `backend/tests/modules/ubicaciones_stock/test_stock_ingress_and_alerts.py`
- [x] T034 [US2] Verify every dashboard alert reaches an already-filtered resolution view in one action and trends are understandable without color in `specs/001-stocky-operational-ux/checklists/implementation.md`

## Phase 5: User Story 3 - Create a replenishment order (P1)

**Goal**: consolidate one destination's needs into a complete, traceable order with explicit origin and review.

**Independent test**: select needs for one Local, choose an active CD with sufficient stock, review products/route/consequence, create the order, and open its complete detail/history.

- [x] T035 [P] [US3] Make the needs list searchable/filterable by destination, product, urgency, and age with selected-count review in `frontend/src/modules/logistica/pages/LogisticaPage.jsx`
- [x] T036 [US3] Complete the full-page order wizard for needs/items, active origin CD, single destination, review, validation, and final confirmation in `frontend/src/modules/logistica/pages/CrearOrdenPage.jsx`
- [x] T037 [US3] Reject mixed destinations, invalid origin type, unavailable stock, duplicate products, and partial/ambiguous consolidation atomically in `backend/src/modules/logistica/application/reposicion_service.py` and `backend/src/modules/logistica/api/logistica_router.py`
- [x] T038 [US3] Add order detail sections for state/freshness, route, responsible user, lines, package/remittance links, blockers, stock impact, timeline, and one next action in `frontend/src/modules/logistica/pages/OrdenDetallePage.jsx`
- [x] T039 [P] [US3] Persist and return actor/location/related-record evidence for need consolidation and order creation in `backend/src/modules/logistica/domain/evento_trazabilidad.py`, `backend/src/modules/logistica/infrastructure/trazabilidad_repository.py`, and `backend/src/modules/logistica/application/trazabilidad_service.py`
- [x] T040 [P] [US3] Verify need-to-order rules, traceability evidence, and transaction rollback in `backend/tests/logistica/test_reposicion_workflow.py`
- [x] T041 [US3] Verify standard order creation completes in under eight minutes without external instruction in `specs/001-stocky-operational-ux/checklists/implementation.md`

## Phase 6: User Story 4 - Seal, approve, remit, and dispatch packages (P1)

**Goal**: prepare every ordered unit, seal packages, approve them individually or in batch, emit one complete delivery note, and dispatch it with full traceability.

**Independent test**: package a multi-product order, seal each complete package, approve one and all eligible sealed packages, explain blocked packages, reject a partial/second delivery note, emit the complete one, and dispatch it.

- [ ] T042 [P] [US4] Add immutable approval evidence for complete sealed packages without adding a package lifecycle state in `backend/src/modules/logistica/domain/aprobacion_bulto.py`, `backend/src/modules/logistica/infrastructure/models.py`, and `backend/src/config/database/legacy_schema_initializer.py`
- [ ] T043 [US4] Implement individual and eligible-batch package approval with one audit event per package and explicit blocked reasons in `backend/src/modules/logistica/application/empaquetado_service.py` and `backend/src/modules/logistica/api/logistica_router.py`
- [ ] T044 [US4] Implement individual and atomic reviewed-batch sealing and reject missing/duplicate/used/invalid seal codes in `backend/src/modules/logistica/application/empaquetado_service.py`, `backend/src/modules/logistica/api/logistica_router.py`, and `backend/src/modules/logistica/domain/precinto.py`
- [ ] T045 [US4] Add sealed-package approval eligibility, individual `Aprobar bulto`, `Aprobar elegibles`, blocked-reason review, and one primary action at a time in `frontend/src/modules/logistica/pages/EmpaquetadoPage.jsx`
- [ ] T046 [US4] Present seal assignment individually and as a reviewed per-package batch without assuming codes or hiding validation in `frontend/src/modules/logistica/components/PrecintadoPanel.jsx`
- [ ] T047 [US4] Enforce exact ordered quantities, unique `order_id` per delivery note, all-order package inclusion, and no partial/second delivery note in `backend/src/modules/logistica/application/empaquetado_service.py`, `backend/src/modules/logistica/infrastructure/models.py`, and `backend/src/modules/logistica/infrastructure/remito_repository.py`
- [ ] T048 [US4] Remove package-subset selection from delivery-note emission and show the complete route/package/quantity review in `frontend/src/modules/logistica/components/ConsolidarModal.jsx`
- [ ] T049 [US4] Canonicalise delivery-note writes to `EMITIDO -> DESPACHADO -> RECIBIDO -> CERRADO` and read legacy `EN_TRANSITO` as `DESPACHADO` in `backend/src/modules/logistica/domain/remito.py` and `backend/src/modules/logistica/mappers/remito_mapper.py`
- [ ] T050 [US4] Complete delivery-note detail with document state separated from package progress, full package table, blockers, traceability, and one dispatch primary action in `frontend/src/modules/logistica/pages/RemitoDetallePage.jsx`
- [ ] T051 [US4] Add separate order preparation/dispatch and delivery-note reception/control Kanban/list views with all stages visible, one entity type per board, standard cards, responsible avatars, 3-degree drag affordance, and drop-to-action confirmation in `frontend/src/modules/logistica/pages/OperacionesPage.jsx`, `frontend/src/modules/logistica/components/OrdenKanban.jsx`, and `frontend/src/modules/logistica/components/RemitoKanban.jsx`
- [ ] T052 [P] [US4] Verify sealed-package approval evidence, blocked batch outcomes, complete delivery-note uniqueness, and complete dispatch in `backend/tests/logistica/test_empaquetado_despacho_workflow.py`
- [ ] T053 [US4] Verify Kanban cancel/confirm behavior, list equivalence, and the complete preparation-to-dispatch journey in `specs/001-stocky-operational-ux/checklists/implementation.md`

## Phase 7: User Story 5 - Receive, control, and trace a delivery (P1)

**Goal**: an assigned Operator receives the complete delivery, controls every seal individually or in a reviewed batch, closes stock/loss correctly, and can trace every entity.

**Independent test**: as the assigned Operator, receive one delivery, verify one package intact, reject one for a violated/mismatched seal, batch-control the rest, close, inspect stock/loss, and traverse order/remittance/package histories.

- [ ] T054 [P] [US5] Build the mobile-first Operator home with reporting CD, authorised branch/shift selector, urgent assigned work, and one next action per card in `frontend/src/app/dashboard/OperatorDashboardPage.jsx`
- [ ] T055 [US5] Filter Operator logistics reads/actions by authenticated assignment while allowing Administrator execution in `backend/src/modules/logistica/api/logistica_router.py` and `backend/src/modules/seguridad/api/dependencies.py`
- [ ] T056 [US5] Extend seal-control evidence with expected/read code, result, required violation reason, actor, location, timestamp, and package version in `backend/src/modules/logistica/domain/control_precinto.py` and `backend/src/modules/logistica/infrastructure/models.py`
- [ ] T057 [US5] Implement atomic reviewed batch control that requires one explicit row per selected unresolved package and writes one event per package in `backend/src/modules/logistica/application/recepcion_service.py` and `backend/src/modules/logistica/api/logistica_router.py`
- [ ] T058 [US5] Add `Controlar todos` as a review table while retaining individual control, exact code comparison, violation reasons, and per-row errors in `frontend/src/modules/logistica/pages/RecepcionPage.jsx` and `frontend/src/modules/logistica/components/ControlPrecintosModal.jsx`
- [ ] T059 [US5] Show pre-close verified/rejected quantities, sellable-stock accreditation, loss totals, blockers, and the final consequence before closure in `frontend/src/modules/logistica/pages/RecepcionPage.jsx`
- [ ] T060 [US5] Provide shared order/delivery-note/package detail navigation, global typed search, preserved filters, and complete immutable timelines in `frontend/src/modules/logistica/pages/TrazabilidadPage.jsx` and `frontend/src/modules/logistica/components/TrazabilidadDrawer.jsx`
- [ ] T061 [US5] Add backend global logistics search and complete order/remittance/package traceability read models with related records and stock movements in `backend/src/modules/logistica/application/trazabilidad_service.py` and `backend/src/modules/logistica/api/logistica_router.py`
- [ ] T062 [P] [US5] Verify Operator scope, individual/batch seal decisions, required reasons, one event per package, closure stock/loss, and unauthorised API rejection in `backend/tests/logistica/test_recepcion_trazabilidad_workflow.py`
- [ ] T063 [US5] Verify an Operator reaches the next confirmation within three actions and controls one package within two minutes on 320 px and 390 px viewports in `specs/001-stocky-operational-ux/checklists/implementation.md`

## Phase 8: User Story 6 - Integrate operational Sales and Cash (P1)

**Goal**: make sales, payment, receipt, cash effect, and returns understandable and persistent through the official backend contract.

**Independent test**: complete the entire persisted UI journey and verify sale, receipt, return, stock and period cash against the official API; rejected requests never appear successful.

- [x] T064 [P] [US6] Refine sale lines, product search, quantities, payment methods, totals, validation, and one primary checkout action in `frontend/src/modules/ventas_caja/components/PosTerminal.jsx`
- [x] T065 [US6] Complete receipt/cash consequence and linked full/partial return/refund confirmations in `frontend/src/modules/ventas_caja/components/FacturaModal.jsx` and `frontend/src/modules/ventas_caja/components/DevolucionModal.jsx`
- [x] T066 [US6] Replace demo/localStorage behavior with DTO mapping for `/api/ventas`, nested returns, receipts and `/api/caja` in `frontend/src/modules/ventas_caja/services/ventasService.js`, `frontend/src/modules/ventas_caja/hooks/useVentasCaja.js`, and `frontend/src/modules/ventas_caja/pages/VentasCajaPage.jsx`
- [x] T067 [US6] Verify sale and return validation, all three payment Strategies, receipt, cash period, stock consequences, error/empty/success states, current ORM fixture compatibility, and the absence of false success in `backend/tests/ventas_caja/`, `frontend/scripts/`, and `specs/001-stocky-operational-ux/checklists/implementation.md`

## Phase 9: User Story 7 - Operational reports and professional PDF (P1)

**Goal**: answer R1/R2 operational questions and produce deterministic, machine-readable professional exports from the same snapshot.

**Independent test**: filter R1/R2, act on a finding, export PDF/CSV/JSON with matching totals, extract metadata/boundary rows, and render long portrait/wide landscape documents without clipping.

- [ ] T068 [P] [US7] Add validated immutable R1/R2 snapshot DTOs with report version, filters, actor, issued/freshness timestamps, findings, denominator, and detail rows in `backend/src/modules/reportes/dto/reportes_dto.py`
- [ ] T069 [US7] Make R1 include stock health/shortage/transit/valuation and R2 use a same-period denominator for rejection rate/economic impact in `backend/src/modules/reportes/application/reporte_stock_service.py` and `backend/src/modules/reportes/application/reporte_mermas_service.py`
- [ ] T070 [US7] Generate deterministic Stocky PDFs with static summaries/tables, page numbers, and landscape appendices using ReportLab in `backend/src/modules/reportes/application/pdf_report_service.py`
- [ ] T071 [US7] Expose authenticated Administrator-only PDF/CSV/JSON exports from the same validated snapshot in `backend/src/modules/reportes/api/reportes_router.py`
- [ ] T072 [P] [US7] Verify report totals/denominators and extract title, filters, actor, metadata, and first/last detail rows with pypdf in `backend/tests/reportes/test_pdf_exports.py`
- [ ] T073 [US7] Prioritise actionable findings before secondary graphics and apply live comparison semantics in `frontend/src/modules/reportes/components/ReporteR1StockView.jsx` and `frontend/src/modules/reportes/components/ReporteR2MermasView.jsx`
- [ ] T074 [US7] Download server PDF and matching raw exports with deterministic names, loading, unavailable, and error states in `frontend/src/modules/reportes/components/ReporteExportToolbar.jsx` and `frontend/src/modules/reportes/services/reportesService.js`
- [ ] T075 [US7] Render representative long/wide PDFs and record no-clipping evidence at portrait/landscape boundaries in `specs/001-stocky-operational-ux/checklists/implementation.md`

## Phase 10: Cross-cutting acceptance and release readiness

**Goal**: prove every approved flow, state, viewport, and failure mode before release.

- [ ] T076 [P] Verify accessible names, labels, visible focus, keyboard list/Kanban alternatives, reduced motion, and modal/drawer focus restoration in `frontend/src/shared/components/` and `specs/001-stocky-operational-ux/checklists/implementation.md`
- [ ] T077 [P] Verify loading, empty, field error, permission denial, stale data, concurrency conflict, retry, success toast, and unavailable states for every primary route in `specs/001-stocky-operational-ux/checklists/implementation.md`
- [x] T078 Run all backend tests and resolve only failures within this feature scope using `backend/tests/`
- [x] T079 Run `npm run check` and `npm run build`, resolving architecture or production-build failures in `frontend/`
- [ ] T080 Inspect Administrator at 1366x768, 1606x1032, and 1759x990 plus Operator at 320x568 and 390x844, recording/resolving verified defects in `specs/001-stocky-operational-ux/checklists/implementation.md`
- [ ] T081 Execute the complete quickstart journey and record evidence for SC-001 through SC-022 in `specs/001-stocky-operational-ux/checklists/implementation.md`
- [ ] T082 Re-run cross-artifact analysis and confirm zero unmapped FR/SC items and no unresolved clarification markers in `specs/001-stocky-operational-ux/`

## Phase 11: Sales/Cash production hardening (release blocker)

**Goal**: preserve the integrated business behavior while closing the security and accounting gaps inherited from the upstream implementation. This phase is required for production, not for proving that the local merge works.

**Independent test**: unauthenticated and cross-branch requests fail; repeated mutation keys cannot duplicate a sale/return; stored payment data is minimized; external payment/refund state is never reported as completed without evidence.

- [ ] T083 [US6] Implement server-side sessions, CSRF protection and route guards; derive actor and allowed location scope from the session in `backend/src/modules/seguridad/`, `backend/src/modules/ventas_caja/api/`, and `frontend/src/core/http/`
- [ ] T084 [US6] Enforce `ADMIN`/`OPERADOR` permissions and branch isolation for Sales/Cash reads and writes; add 401, 403, cross-branch and Administrator-inheritance tests in `backend/tests/seguridad/` and `backend/tests/ventas_caja/`
- [ ] T085 [US6] Add client-generated operation IDs and backend uniqueness/replay rules for sale and return mutations; verify same-key/same-body replay and same-key/different-body 409 behavior in `backend/tests/ventas_caja/`
- [ ] T086 [US6] Replace full card/transfer inputs with terminal authorization, last four digits and masked transfer evidence; never persist or return full financial identifiers in `backend/src/modules/ventas_caja/` and `frontend/src/modules/ventas_caja/`
- [ ] T087 [US6] Model external payment and refund confirmation explicitly; only confirmed financial movements affect cash and UI copy must distinguish internal registration from external fund transfer
- [ ] T088 [US6] Add bounded/paginated sales reads and a bounded return read model that removes the per-sale N+1 request pattern
- [ ] T089 Re-run backend/frontend gates plus focused security, concurrency and reconciliation tests; record the production decision in `specs/001-stocky-operational-ux/checklists/implementation.md`

## Dependencies and execution order

- Phase 1 starts immediately.
- Phase 2 blocks all story completion and all state-changing UI work.
- Phase 3 and the non-dashboard portions of Phase 9 may proceed after Phase 2.
- Phase 4 depends on Phase 2 and uses Phase 3 master/location data.
- Phase 5 depends on Phases 2-4.
- Phase 6 depends on Phase 5 and must be completed in task order T042-T053.
- Phase 7 depends on Phase 6 and must be completed in task order T054-T063.
- Phase 8 depends only on Phase 2; it reuses the backend from `main` and permits only compatibility/integration corrections, never a parallel Sales/Cash implementation.
- Phase 9 depends on Phase 2 plus the inventory/logistics read models required by each report.
- Phase 10 runs per-story checks continuously; T081-T082 run after all earlier tasks.
- Phase 11 depends on the Phase 8 contract and the Phase 2 identity foundation. T089 is the production release gate and runs after T083-T088.

## Parallel opportunities

- After T008, T009 and T010-T018 can proceed across backend/frontend owners with the contract fixed.
- After Phase 2, US1 master data and US7 PDF infrastructure can proceed independently.
- Within US2, notification UI and KPI semantics can proceed while dashboard composition is built.
- Within US4, backend approval evidence and frontend Kanban presentation can proceed in parallel, but integration waits for T043-T050.
- Within US7, snapshot/report logic and interactive report presentation can proceed in parallel before export integration.

## Requirement traceability

| Requirement | Primary tasks | Requirement | Primary tasks |
|---|---|---|---|
| FR-001 | T003, T013, T017, T080 | FR-023 | T013, T054, T063 |
| FR-002 | T013, T019, T026 | FR-024 | T027-T034 |
| FR-003 | T020, T026 | FR-025 | T038, T050, T060-T061 |
| FR-004 | T021-T024 | FR-026 | T038, T050, T060 |
| FR-005 | T022-T025 | FR-027 | T049-T050 |
| FR-006 | T036, T038, T048, T050, T054, T058 | FR-028 | T016, T032, T077 |
| FR-007 | T035-T063 | FR-029 | T039, T042-T043, T056-T062 |
| FR-008 | T035-T037, T040 | FR-030 | T038, T050, T060 |
| FR-009 | T042-T050, T057-T062 | FR-031 | T051, T053, T076 |
| FR-010 | T056-T059, T062 | FR-032 | T016, T045, T050-T051, T058 |
| FR-011 | T014-T019, T076 | FR-033 | T039, T042, T049, T056, T061 |
| FR-012 | T014, T019, T076, T080 | FR-034 | T068-T072, T074-T075 |
| FR-013 | T064-T067, T083-T089 | FR-035 | T068-T075 |
| FR-014 | T068-T075 | FR-036 | T005-T013, T055, T062, T083-T084 |
| FR-015 | T068-T072, T074-T075 | FR-037 | T005, T013, T054-T055, T063, T083-T084 |
| FR-016 | T070, T072, T075 | FR-038 | T018, T020-T025, T077 |
| FR-017 | T018-T019, T077 | FR-039 | T015, T021, T064 |
| FR-018 | T005-T013, T054-T055 | FR-040 | T022-T025 |
| FR-019 | T080 and approved prototype | FR-041 | T042-T046, T052-T053 |
| FR-020 | T035-T040 | FR-042 | T056-T063 |
| FR-021 | T047-T050, T052 | FR-043 | T017, T024, T028, T045, T050-T051, T054, T073, T080 |
| FR-022 | T013, T019, T054, T063, T080 | FR-044 | T031, T073, T080 |

| Success criterion | Verification tasks | Success criterion | Verification tasks |
|---|---|---|---|
| SC-001 | T013, T019, T026 | SC-012 | T022-T026 |
| SC-002 | T026 | SC-013 | T060-T061, T081 |
| SC-003 | T041, T053 | SC-014 | T016, T077 |
| SC-004 | T063 | SC-015 | T051, T053 |
| SC-005 | T019, T076, T080 | SC-016 | T038, T045, T050, T058-T062 |
| SC-006 | T072, T075 | SC-017 | T070, T072, T075 |
| SC-007 | T081 | SC-018 | T009, T013, T055, T062-T063 |
| SC-008 | T039, T060-T062 | SC-019 | T018, T025, T033, T040, T052, T062 |
| SC-009 | T064-T067, T085-T089 | SC-020 | T022-T026 |
| SC-010 | T054, T063 | SC-021 | T042-T046, T052, T056-T063 |
| SC-011 | T028, T030, T034 | SC-022 | T017, T026, T034, T053, T063, T080-T081 |

## Implementation strategy

The first usable increment is Phases 1-2 plus the Administrator/Operator login and shells. Then deliver US1 and US2, followed by the logistics lifecycle in order (US3 -> US4 -> US5). US6 can proceed independently after Foundation. Finish with US7 and the complete acceptance phase. Do not mark a later logistics task complete while an earlier lifecycle prerequisite remains open.

# Feature Specification: Stocky Operational UX

**Feature Branch**: `001-stocky-operational-ux`

**Created**: 2026-10-19

**Status**: Approved for implementation

**Last synchronized**: 2026-10-20

**Input**: Redesign the full Stocky administrator experience so that all mandatory business processes are clear, simple, traceable, and consistent. The scope includes multiple distribution centers and local branches, catalog administration, inventory, replenishment, distribution, integration of the existing Sales and Cash backend from `main`, and formal audit reports/PDFs.

## Clarifications

### Session 2026-10-19

- Q: Which actor model will govern the wireframes, navigation, and permissions? → A: Two profiles: Administrator and Delivery/General Operator.
- Q: Must Sales and Cash remain a demo or become an operationally persistent process? → A: Superseded on 2026-10-20 by the decision to integrate the persisted implementation already available in `main`.
- Q: What distribution-network topology must replenishment support? → A: Multiple distribution centers may supply any branch.
- Q: May a replenishment order be dispatched through partial delivery notes? → A: No. Each order must arrive complete and has exactly one delivery note.
- Q: Which device strategy must each profile use? → A: Administrator is desktop-first; Delivery/General Operator is mobile-first; both use one responsive web application. The Administrator may perform every Operator action.

### Session 2026-10-20

- Q: Does approving a package add another lifecycle state? → A: No. Approval is immutable evidence recorded after the package is complete and sealed; it is required before the package enters the order's delivery note.
- Q: What does `Approve all` do with ineligible packages? → A: It approves only currently eligible packages, records one result per approved package, and returns every excluded package with a concrete blocking reason.
- Q: May batch seal control assume all packages are intact? → A: No. The operator must review expected/read seal codes and select Intact or Violated for each package; every violation requires a reason.
- Q: What entity appears on each operational Kanban? → A: Preparation/dispatch contains replenishment orders and reception/control contains delivery notes. A board never mixes entity types; columns are derived operational stages and dropping opens the required action surface without persisting directly.
- Q: Is the visual direction still awaiting approval? → A: No. The graphite, compact, rounded direction in `docs/prototipo_wireframes_stocky.html` is approved; implementation may refine professional details without reopening the design direction.

### Session 2026-10-20

- Q: Does the previous frontend-only Sales/Cash boundary still apply after the official implementation reached `main`? → A: No. Integrate the existing `ventas_caja` backend from `main` as the authoritative operational contract; do not retain demo persistence or parallel legacy routers.

## User Scenarios & Testing

### User Story 1 - Navigate the operation and administer master data (Priority: P1)

As an administrator, I can identify the next operational area from a task-based navigation and create or maintain centers, branches, products, categories, providers, prices, and minimum stock without guessing where each task lives.

**Why this priority**: All inventory, distribution, and audit actions depend on correct locations and catalog data.

**Independent Test**: Starting from the home screen, the administrator can create a distribution center, a branch, and a product with category, provider, price, and minimum stock without changing to an unrelated area.

**Acceptance Scenarios**:

1. **Given** the administrator is on any Stocky page, **When** they open the navigation, **Then** they can find Catalog, Network, Inventory, Distribution, Sales, and Audit as named task groups.
2. **Given** the administrator opens Catalog, **When** they choose Products, Categories, or Providers, **Then** the selected entity is visible in the navigation and page title before any record is edited.
3. **Given** a product list with one or more selected records, **When** the administrator starts an allowed bulk attribute update, **Then** they choose the attribute, see the selected count, affected products, prior values, proposed values, and validation errors before confirming.
4. **Given** a center or branch is created, **When** the administrator saves valid details, **Then** it becomes available as an origin or destination where its type permits.

---

### User Story 2 - Receive and monitor inventory (Priority: P1)

As an administrator, I can record merchandise entering a selected distribution center, inspect stock by location, and resolve replenishment alerts from a single, understandable workflow.

**Why this priority**: Accurate available stock is the source of every subsequent distribution decision.

**Independent Test**: The administrator records an incoming quantity for a product at a distribution center and verifies the new balance and any resulting alert state.

**Acceptance Scenarios**:

1. **Given** an administrator opens Inventory, **When** they choose Stock, Incoming merchandise, or Alerts, **Then** the current data context and available action are explicit.
2. **Given** an incoming-stock form, **When** the administrator selects a center, provider, product, and positive quantity, **Then** the confirmation screen states the affected center, product, quantity, and resulting stock movement.
3. **Given** stock reaches or falls below its minimum, **When** the administrator views Alerts, **Then** each alert states the product, location, current quantity, minimum, suggested action, and urgency in text.

---

### User Story 3 - Create a replenishment order (Priority: P1)

As an administrator, I can consolidate one or more branch needs into a replenishment order with a clear distribution-center origin and branch destination.

**Why this priority**: This is the first business step that moves goods from the central network to a branch.

**Independent Test**: The administrator selects compatible pending needs for one destination and completes an order whose summary states origin, destination, products, and quantities.

**Acceptance Scenarios**:

1. **Given** pending needs exist, **When** the administrator selects needs for consolidation, **Then** only needs for one destination can be combined in one order.
2. **Given** a selected destination, **When** the administrator chooses an origin center and quantities, **Then** the review step shows every item and rejects quantities that cannot be fulfilled.
3. **Given** the administrator confirms the review, **When** the order is created, **Then** its status is Pending packaging and it links back to the included needs.

---

### User Story 4 - Package, seal, remit, and dispatch goods (Priority: P1)

As a Delivery/General Operator, I can review packaging, turn a replenishment order into sealed packages, assign them to a delivery note, and dispatch them from a specific distribution center.

**Why this priority**: This is the custody and traceability boundary of the distribution flow.

**Independent Test**: The Delivery/General Operator packages the ordered items, assigns a unique seal and delivery note, dispatches the shipment, and sees every package in transit.

**Acceptance Scenarios**:

1. **Given** an order pending packaging, **When** the Delivery/General Operator starts packaging, **Then** the flow shows the sequence Package, Seal, Delivery note, Review, and Dispatch.
2. **Given** a package has its contents defined, **When** the Delivery/General Operator assigns a seal, **Then** an already-used seal cannot be assigned and the package state is visible.
3. **Given** one or more complete sealed packages, **When** the Delivery/General Operator approves one package or all eligible packages, **Then** each approved package receives its own immutable evidence and every excluded package keeps its unresolved state with a concrete reason.
4. **Given** every ordered quantity is packaged and every package is approved and sealed, **When** the Delivery/General Operator creates the order's single delivery note, **Then** its origin, destination, complete package set, and delivery-note number are reviewed before dispatch.
5. **Given** a reviewed delivery note, **When** the Delivery/General Operator confirms dispatch, **Then** the packages change to In transit and the resulting record links to its order and delivery note.

---

### User Story 5 - Receive and verify a delivery at its destination (Priority: P1)

As a Delivery/General Operator, I can record delivery and receipt states at the destination branch, verify each seal, and see whether stock is accredited or recorded as loss.

**Why this priority**: This closes the physical transfer and prevents incorrect stock accreditation.

**Independent Test**: The Delivery/General Operator opens an in-transit delivery for its destination, records intact or violated seal verification for every package, and closes the delivery only after all packages are resolved.

**Acceptance Scenarios**:

1. **Given** an in-transit delivery, **When** the Delivery/General Operator opens it, **Then** the destination, delivery note, package count, seals, and outstanding verification actions are visible.
2. **Given** a package is received, **When** the Delivery/General Operator marks its seal as intact, **Then** the resulting verified state and stock accreditation are confirmed in plain language.
3. **Given** a package seal is violated, **When** the Delivery/General Operator records rejection, **Then** the interface states that the quantity is recorded as loss and is not added to available stock.
4. **Given** several received packages remain unresolved, **When** the Delivery/General Operator starts batch control, **Then** every selected package requires its expected/read seal code and an explicit Intact or Violated result, with a reason for every violation.
5. **Given** every package is verified or rejected, **When** the Delivery/General Operator closes the delivery, **Then** the final state, quantities accredited, and quantities lost are displayed.

---

### User Story 6 - Complete the operational Sales and Cash UI (Priority: P1)

As an administrator, I can complete a persisted sale, payment, receipt, cash consultation, and linked return against the official Sales/Cash backend for the active branch.

**Why this priority**: Sales, payments, receipts, and returns are mandatory processes, and the approved UI must now expose the operational implementation already available in `main` without a demo or duplicate contract.

**Independent Test**: The administrator adds products to a sale, chooses a payment method, reviews a receipt, and completes the partial or complete return UI linked to that receipt, with every expected stock and cash effect stated clearly.

**Acceptance Scenarios**:

1. **Given** the administrator opens Sales for a branch, **When** they begin a sale, **Then** the page presents verified available stock and prevents unavailable quantities using the UI data contract.
2. **Given** a valid cart, **When** the administrator selects a payment method and reviews the operation, **Then** the UI shows the products, payment, receipt, expected stock deduction, and expected cash effect before submission.
3. **Given** an eligible receipt, **When** the administrator creates a return, **Then** the UI limits quantities to the remaining returnable amount and shows the linked expected stock restoration, refund, and cash effect.
4. **Given** the administrator confirms a valid operation, **When** the backend accepts it, **Then** the UI reloads the persisted sale, receipt, return and cash balance; on rejection or network failure it retains the input and never reports a false success.

---

### User Story 7 - Produce a formal audit report (Priority: P1)

As an administrator, I can review operational findings and export a formal, legible audit document that is distinct from the interactive dashboard.

**Why this priority**: Audit evidence must be trusted, readable, and suitable for review outside Stocky.

**Independent Test**: The administrator filters a stock or loss report, reviews the resulting findings, and exports a paginated document containing exactly the selected report and filter snapshot.

**Acceptance Scenarios**:

1. **Given** the administrator opens Audit, **When** they select Stock health or Losses and seals, **Then** the report states its question, period, filters, freshness, and key findings before showing secondary charts.
2. **Given** a report with a formal export action, **When** the administrator exports it, **Then** the document contains one Stocky header, report metadata, page numbers, and no interactive controls.
3. **Given** a report contains a wide detail table, **When** it is exported, **Then** the table is readable in a landscape appendix rather than clipped or squeezed into portrait content.

### Edge Cases

- A location is inactive after existing historical movements: it remains visible in historical records but cannot be selected for new operations.
- A bulk product update has invalid values for some selections: no product is changed until the administrator corrects or removes the invalid records.
- A replenishment order has no fulfillable quantities: the review explains the shortage and cannot be confirmed.
- A replenishment order is only partially packaged or has an unsealed package: progress can be saved, but its delivery note cannot be issued or dispatched.
- `Approve all` encounters empty, incomplete, unsealed, overfilled, already approved, or otherwise blocked packages: eligible packages are processed individually and blocked packages remain unresolved with explicit reasons.
- Batch receipt contains one missing seal reading, outcome, or violation reason: the request is rejected without writing partial package results.
- A delivery note already exists for an order: another delivery note or a package subset is rejected.
- The browser viewport is narrow or the content is long: forms remain visible, their body scrolls inside the dialog or page, and primary/secondary actions remain reachable.
- A report has no records: it presents the active filters, explains that no findings exist, and provides a clear next action without empty charts.
- A formal export fails: no incomplete document is presented as final; the administrator can retry and retains the selected filters.
- A Sales or Cash request is rejected or cannot reach the backend: the UI preserves valid input, explains the failure, and never presents a successful stock or cash impact.

## Requirements

### Functional Requirements

- **FR-001**: Stocky MUST present one primary brand, one navigation system, and consistent terminology across operational screens, reports, exports, and dialogs.
- **FR-002**: The navigation MUST expose all mandatory business areas as task groups and the administrator MUST reach each listed sub-area in no more than two navigation selections.
- **FR-003**: The system MUST support creation, editing, activation, and deactivation of multiple distribution centers and branches, preserving historical references to inactive locations.
- **FR-004**: The system MUST support creation and editing of products, categories, providers, prices, and minimum stock, with a distinct bulk action for allowed product attributes including price, minimum stock, category, provider, and active state.
- **FR-005**: Before a bulk update is confirmed, the system MUST show the selected attribute, selected records, prior values, proposed values, resulting changes, and any invalid entries; no record changes when any selected row remains invalid.
- **FR-006**: The system MUST show the applicable origin and destination in every replenishment, packaging, delivery-note, dispatch, and receipt flow.
- **FR-007**: The system MUST guide replenishment through clear sequential stages: need selection, order review, packaging, sealing, delivery-note creation, dispatch, receipt, verification, and closure.
- **FR-008**: The system MUST prevent an order from combining needs for different destination branches.
- **FR-009**: The system MUST prevent issuing or dispatching the delivery note until all ordered quantities are packaged and every package is sealed, and prevent closure until every package is verified or rejected.
- **FR-010**: The system MUST show the stock consequence of an intact versus violated seal before and after confirmation.
- **FR-011**: The system MUST make all critical data-entry flows usable with keyboard navigation, visible focus, accessible labels, reversible cancellation, and explicit confirmation feedback.
- **FR-012**: The system MUST keep dialog content within the visible viewport, with reachable controls and no background interaction while a blocking dialog is open.
- **FR-013**: The UI MUST consume the official `/api/ventas` and `/api/caja` contracts for persisted sales, Strategy payment, correlated receipt, branch cash balance, and linked partial/complete returns; it MUST show stock and cash consequences and never retain a demo or parallel persistence path.
- **FR-014**: The system MUST provide two audit views: a prioritised operational action view and a formal audit view with findings and detail.
- **FR-015**: A formal audit export MUST include only the active report, its selected filters, an issuance timestamp, responsible administrator, page numbering, and one Stocky identity header.
- **FR-016**: Formal exports MUST render long or wide detail data without clipping, duplicate headers, empty dashboard whitespace, or interactive controls.
- **FR-017**: The system MUST provide clear loading, empty, validation-error, action-success, and unavailable-data states for every primary flow.
- **FR-018**: The system MUST provide two role-tailored experiences: an Administrator experience for master data, inventory oversight, sales, reports, full traceability, and every Delivery/General Operator action; and a Delivery/General Operator experience focused on reviewing packaging, recording dispatch, delivery, receipt, seal verification, and shipment states without exposing unrelated master-data actions.
- **FR-019**: Before visual implementation begins, the redesign MUST present comparable skeleton wireframes for the application shell and critical screen/flow archetypes, and implementation MUST wait for explicit design-direction approval.
- **FR-020**: Every replenishment order MUST select one active distribution center as origin and one active branch as destination; any active distribution center may supply any active branch, subject to stock availability at the selected origin.
- **FR-021**: Each replenishment order MUST have exactly one delivery note containing all of its packages; partial delivery notes and partial dispatch are not permitted.
- **FR-022**: The Administrator experience MUST be desktop-first and remain usable on tablet and mobile; the Delivery/General Operator experience MUST be mobile-first and remain usable on desktop, within the same responsive web application.
- **FR-023**: The Delivery/General Operator home MUST show only assigned or actionable work, the next valid action, what that action records, and its operational consequence; unrelated administrative options MUST remain outside the Operator navigation.
- **FR-024**: The Administrator home MUST be one control panel that combines actionable alerts, pending work, recent movements, lifecycle workload, and direct links to the corresponding filtered records without duplicating those sections across separate dashboard pages.
- **FR-025**: The Administrator MUST be able to search for and open any replenishment order, delivery note, or package, then inspect its current state, complete immutable state history, related documents, products, origin, destination, responsible operator, timestamps, stock impact, and next valid action.
- **FR-026**: From an order, delivery note, or package detail, the Administrator MUST be able to navigate bidirectionally among all related records without losing the current search or filter context.
- **FR-027**: The UI MUST display order state, delivery-note document state, and package state as separate concepts, deriving shipment progress from package states rather than inventing or conflating document states.
- **FR-028**: Active operational lists and detail views MUST refresh immediately after a local action and at least every 15 seconds while visible, display their freshness, retain the last known data on network failure, and block confirmations when freshness cannot be established.
- **FR-029**: Every traceability event shown by the UI MUST identify the entity, prior and new state, timestamp, responsible user, location, related documents, observation or reason, and associated stock movement when applicable.
- **FR-030**: Order, delivery-note, and package detail screens MUST share a recognisable structure containing current state, freshness, origin and destination, responsible user, related records, contents, immutable timeline, stock impact, blockers, and the next valid action.
- **FR-031**: Operational Kanban boards MUST represent one declared entity type per view, provide an equivalent list and keyboard action, expose only valid destinations, and treat a drop as an intent that opens the exact required confirmation or data-entry panel rather than persisting a state change directly.
- **FR-032**: Every state-change panel opened from Kanban or detail views MUST name the entity, current and resulting state, prerequisites, operational and stock consequence, evidence to be recorded, and an explicit final action; failure or concurrent modification MUST leave no ambiguous visual state.
- **FR-033**: The system MUST provide complete, separately documented state machines for needs, replenishment orders, packages, seals, delivery notes, and stock consequences, using one canonical term for each persisted state.
- **FR-034**: Formal R1 and R2 exports MUST be generated from a validated data snapshot independently from the interactive dashboard, include report/version/filter/freshness/actor metadata, use deterministic paginated layouts and static charts, and remain machine-readable for validation.
- **FR-035**: R1 MUST present stock health, shortages, transit and valuation by location and product; R2 MUST present rejected packages, seal incidents and their economic impact using a denominator filtered to the same period as its rejection rate.
- **FR-036**: The application MUST provide authenticated Administrator and Delivery/General Operator accounts, derive navigation and allowed actions from the active role, and enforce the same permissions at the backend boundary rather than relying on hidden UI controls.
- **FR-037**: Administrator and Operator screens MUST display the active operational scope. The Operator home MUST identify the distribution center to which the operator reports, the selected assigned branch, shift or assignment context, and the origin/destination of every task; only authorised centers and branches may be selected.
- **FR-038**: Data-entry screens MUST validate and normalise types, lengths, formats, ranges, required relationships, and allowed characters before submission, render user input as text rather than executable markup, preserve valid input after recoverable errors, and still rely on authoritative backend validation and sanitisation.
- **FR-039**: Selectors with up to seven meaningful options MAY display choices directly; larger product, category, provider, location, or user sets MUST provide keyboard-accessible paginated search by the identifiers relevant to that entity.
- **FR-040**: Bulk product pricing MUST support setting a fixed price or increasing/decreasing selected current prices by a validated percentage, previewing each prior price, rule, percentage, monetary difference, and resulting price before one atomic confirmation.
- **FR-041**: Package preparation MUST support approving one eligible package or approving all currently eligible packages in an order; batch approval MUST exclude and explain blocked packages and preserve an individual audit result for every processed package without inventing a new package lifecycle state.
- **FR-042**: Receipt MUST support verifying one seal/package or controlling all packages in a received delivery note; batch control MUST require an expected-versus-read seal code and an Intact or Violated result per package, require a reason for every violation, and write one traceability event per package rather than blindly marking all intact.
- **FR-043**: Each task context MUST expose no more than one visually primary action at a time; valid alternatives, filters, exports, and destructive branches MUST use distinct secondary, ghost, or danger hierarchy without hiding required functionality.
- **FR-044**: Live indicators MUST state their comparison window and direction in text, not color alone, and distinguish whether an increase or decrease is operationally favourable, unfavourable, or neutral.

### Key Entities

- **Location**: A distribution center or branch; has name, address, type, active state, and eligibility as origin or destination.
- **Product**: A sellable or movable catalog item with category, provider, price, cost, and minimum stock.
- **Need**: A request for stock at one branch, with product, quantity, priority, and status.
- **Replenishment Order**: A grouped set of compatible needs with one origin, one destination, lines, and lifecycle state.
- **Package**: A container of order items, assigned a unique seal and tracking state.
- **Delivery Note**: The single complete dispatch document for one replenishment order, linking all sealed packages, origin, destination, issue date, and status.
- **Stock Movement**: A traceable quantity change at a location, including receipt, dispatch, accreditation, and loss.
- **Sale and Return**: A persisted transaction, Strategy payment, correlated receipt, branch stock and cash effects, and its linked partial or complete reversal through the official Sales/Cash API.
- **Audit Report**: A named question, selected filters, findings, evidence rows, issuance data, and formal export.
- **Traceability Event**: An immutable state-change record linking an entity to its prior and new state, timestamp, responsible user, location, related documents, reason, and stock consequence when applicable.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An administrator can locate any mandatory business process from the home screen in two navigation selections or fewer.
- **SC-002**: An administrator can create a location or complete a single-product catalog update in under three minutes using valid data.
- **SC-003**: An administrator can complete a replenishment order through dispatch in under eight minutes using standard data and without consulting external instructions.
- **SC-004**: An administrator can complete a receipt and seal-verification decision for a single package in under two minutes.
- **SC-005**: 100% of blocking dialogs remain fully usable at 320 px, 1366 px, and 1759 px viewport widths, including keyboard-only completion and cancellation.
- **SC-006**: 100% of formal audit exports display one header, selected filter metadata, page numbering, and no clipped table columns or dashboard controls.
- **SC-007**: In moderated acceptance testing, the administrator completes each P1 scenario successfully on the first attempt without being told which module or tab to use.
- **SC-008**: Every state transition from need through delivery closure is visible from its related order or delivery record.
- **SC-009**: Every completed Sales or Return UI result identifies the affected branch, products, payment or refund, and persisted stock and cash movements; rejected or unreachable requests are never presented as completed operations.
- **SC-010**: From the Delivery/General Operator home, an assigned shipment can reach its next valid state confirmation in no more than three user actions, excluding required data entry and the final confirmation.
- **SC-011**: From the Administrator control panel, every actionable alert or pending task opens its already-filtered work list in one user action.
- **SC-012**: An Administrator can select multiple products, choose one allowed attribute, review all resulting changes, and confirm the bulk update without editing records individually.
- **SC-013**: An Administrator can locate an order, delivery note, or package from global search and reach its complete state history in no more than two user actions.
- **SC-014**: While an operational page remains visible, its freshness indicator never exceeds 15 seconds under normal connectivity, and a stale or failed refresh cannot produce an enabled confirmation based on uncertain state.
- **SC-015**: In moderated testing, no participant interprets dropping a Kanban card as a completed state change before the required panel is explicitly confirmed.
- **SC-016**: 100% of state-changing actions show the entity, resulting state and stock consequence before confirmation, then create a discoverable traceability event after success.
- **SC-017**: For each formal report, automated validation can open the PDF, find its title, filters, issue metadata and expected boundary rows, while visual review finds no clipped content in portrait pages or landscape appendices.
- **SC-018**: In role-based acceptance tests, an Administrator can reach every Operator action, while an Operator sees the assigned center/local context on every operational screen and cannot submit an unauthorised location or action through either UI or API.
- **SC-019**: 100% of required fields, numeric limits, identifiers, searchable relationships, and rejected input examples present a field-level correction message before submission and an equivalent authoritative backend rejection when bypassing the UI.
- **SC-020**: An Administrator can increase or decrease at least 50 selected product prices by one percentage, inspect every resulting value, and confirm once; one invalid result prevents every price change.
- **SC-021**: In individual and batch acceptance tests, every approved package and every seal result can be traced to its own actor, timestamp, expected/read seal, outcome, and reason when violated; no unresolved package is reported as approved.
- **SC-022**: In moderated testing, users identify the intended next action on every critical screen within five seconds and do not confuse filter, export, batch, or destructive alternatives with the primary action.

## Assumptions

- Stocky has two user profiles: Administrator and Delivery/General Operator. The Administrator is a functional superuser who can perform every action; the Delivery/General Operator receives a reduced operational experience limited to the logistics actions defined in FR-018.
- Multiple centers and branches are supported even if current demo data contains one center.
- The Sales/Cash backend merged from `main` is authoritative. This integration may make compatibility corrections required by the current ORM schema, but does not create a second router, storage model, or accounting subsystem.
- Existing domain validation and traceability rules remain authoritative; the feature improves their discoverability and presentation.
- Formal audit documents are intended for A4 review, with landscape appendices permitted for wide detail tables.
- External identity-provider integration remains outside this feature, but application login, Administrator/Operator sessions, role segregation, and backend permission enforcement are now in scope.

## Delivery Phases

1. **Foundation**: Resolve brand, role-tailored app shells, navigation hierarchy, responsive layout, dialog contract, focus behavior, and common states.
2. **Approved visual baseline**: Implement the approved graphite shell and critical flow archetypes from the HTML prototype without reopening design direction.
3. **Masters**: Deliver locations and catalog administration, including reviewed bulk updates for allowed product attributes.
4. **Inventory**: Deliver stock views, incoming merchandise, and alerts.
5. **Distribution**: Deliver the complete need-to-receipt process, in lifecycle order.
6. **Sales and cash integration**: Integrate the persisted backend from `main` with the complete sales, payment, internal receipt, cash, stock, replenishment, and return UI; do not create a parallel backend.
7. **Audit**: Deliver operational and formal audit reports, including export-specific layout.
8. **Acceptance**: Validate every P1 journey, responsive viewport, keyboard flow, empty/error state, and formal document.
9. **Production hardening**: Close Sales/Cash authorization, idempotency, payment-data minimization, external confirmation, pagination, and reconciliation gates before deployment.

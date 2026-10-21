# Research Decisions

## Existing-code strategy

- **Decision**: Treat the current React/FastAPI implementation as a reusable baseline and close verified gaps in place.
- **Rationale**: Catalog, stock, logistics, reports, shared controls, and domain validation already exist. Rebuilding would add risk without user value.
- **Rejected**: Replace the app shell or introduce a new frontend/backend framework.

## Authentication and roles

- **Decision**: Use opaque server-side sessions in an HttpOnly SameSite cookie, PBKDF2-HMAC password hashes, and backend role/scope dependencies.
- **Rationale**: This is smaller and safer for the existing same-origin ERP than introducing JWT lifecycle and a new identity dependency. It also permits immediate logout and scope revocation.
- **Rejected**: UI-only role switching, localStorage bearer tokens, or hidden-menu authorization.

## Navigation and operational context

- **Decision**: Provide separate role-tailored navigation from one responsive application. Keep origin/destination within each logistics process and show the active assignment context persistently for Operators.
- **Rationale**: Administrator and Operator tasks have different frequency and cognitive load, while sharing the same records and domain rules.
- **Rejected**: One unrestricted menu for every user or a universal location selector that silently changes process scope.

## Drawers, dialogs, and long flows

- **Decision**: Use right drawers for master-record create/edit, modals for short confirmations, and full pages for wizards or work that may span time.
- **Rationale**: This preserves list context and keeps blocking interactions short and accessible.
- **Rejected**: A modal for every form or one monolithic logistics wizard.

## Package approval versus lifecycle state

- **Decision**: Record approval of a complete sealed package as immutable evidence required before delivery-note emission; do not add an `APROBADO` package state.
- **Rationale**: Approval is evidence about a prepared package, while the domain lifecycle already has canonical physical states. Batch approval can write one event per package and explain exclusions without corrupting lifecycle semantics.
- **Rejected**: Blindly mark all packages approved or introduce a duplicate state between `PREPARADO` and `PRECINTADO`.

## Individual and batch seal control

- **Decision**: Batch receipt is a review table requiring expected/read seal code and `INTACTO|VIOLADO` for each package; a reason is mandatory for every violation.
- **Rationale**: “Approve all” cannot imply every seal was physically intact. Each package needs independent evidence and traceability.
- **Rejected**: One global “all intact” checkbox.

## Delivery note integrity

- **Decision**: Enforce exactly one delivery note per order and require complete package/quantity coverage before emission and dispatch.
- **Rationale**: The approved business rule explicitly excludes partial delivery notes and partial dispatch.
- **Rejected**: User-selected package subsets or multiple delivery notes for one order.

## State, live data, and concurrency

- **Decision**: Refresh visible operational data every 15 seconds, show last-success time, retain last known results on failure, and require a fresh version before confirmation.
- **Rationale**: Operators must see live progress without losing usable context during transient failures, while stale confirmations must not mutate current state.
- **Rejected**: Silent polling, clearing data on refresh failure, or optimistic state transitions without server confirmation.

## Kanban

- **Decision**: Use replenishment orders on the preparation/dispatch board and delivery notes on the reception/control board. Each board declares one entity type; drag opens the required action surface and never writes directly.
- **Rationale**: Cards remain understandable and traceable without mixing semantics or inventing persisted states. Equivalent list/keyboard actions preserve accessibility.
- **Rejected**: Mixed entity cards within one board or direct state mutation on drop.

## Visual hierarchy

- **Decision**: Keep the approved graphite palette, rounded compact controls, restrained depth, and one primary action per task context. Status colors are semantic and never the only carrier of meaning.
- **Rationale**: The final design review approved the palette but identified competing dark buttons and weak trend meaning.
- **Rejected**: Multiple simultaneous black primary actions, decorative gradients, or generic oversized cards.

## Searchable relationships and validation

- **Decision**: Show up to seven options directly; use paginated keyboard search for larger product/category/provider/location/user sets. Validate and normalise in the frontend, then revalidate authoritatively in the backend.
- **Rationale**: Large master lists cannot remain usable or safe as unfiltered selects.
- **Rejected**: Loading every relationship into a long dropdown or trusting browser validation alone.

## Formal PDF

- **Decision**: Generate R1/R2 PDFs on the backend with ReportLab from an immutable validated snapshot and use pypdf assertions in tests.
- **Rationale**: Browser print cannot reliably guarantee deterministic pagination, metadata, static output, or machine-readable validation.
- **Rejected**: Printing the interactive dashboard or relying only on CSS print rules.

## Sales and Cash boundary

- **Decision**: Consume the official `ventas_caja` API merged from `main`, remove the browser demo store and keep its routers/DTOs as the only contract. Limit backend changes to compatibility corrections proven necessary against the current ORM schema.
- **Rationale**: Sales, receipts, returns and branch cash are now implemented and persisted; retaining the earlier demo would create two conflicting truths and false operational results.
- **Rejected**: Keeping `localStorage`, registering the legacy `ventas_caja_router.py`, or inventing a second accounting contract in the frontend.

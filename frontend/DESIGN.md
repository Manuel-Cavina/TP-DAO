# Stocky frontend design contract

**Status**: approved for implementation on 2026-10-20.  
**Authority**: [feature specification](../specs/001-stocky-operational-ux/spec.md), [implementation plan](../specs/001-stocky-operational-ux/plan.md), [detailed UI architecture](../docs/arquitectura_ui_operativa_detallada.md), and [approved prototype](../docs/prototipo_wireframes_stocky.html).

When this file conflicts with an older screenshot, diagnostic, or module README, the feature specification and plan prevail.

## Product identity

- Product name: Stocky.
- Visual direction: light graphite, quiet, compact, contemporary, and professional.
- Administrator is desktop-first; Operator is mobile-first; both share one responsive application.
- No decorative gradients, excessive pills, nested cards, oversized controls, or generic AI-dashboard filler.

## Tokens

The implementation source of truth is `src/shared/styles/tokens.css`.

| Role | Value | Use |
|---|---:|---|
| Canvas | `#F4F4F2` | application background |
| Surface | `#FFFFFF` | content, tables, drawers, dialogs |
| Surface muted | `#EDEDEB` | filters and secondary groups |
| Navigation | `#111214` | Administrator sidebar |
| Ink | `#151619` | primary text |
| Ink muted | `#5F6065` | metadata/help |
| Border | `#D7D7D3` | structural separators |
| Primary action | `#17181B` | the single action that advances the current task |
| Primary hover | `#2B2C30` | hover/pressed |
| Info | `#315F82` | informational state |
| Success | `#316B49` | verified/healthy/closed |
| Warning | `#8A611D` | pending/low/in transit |
| Danger | `#A23B35` | rejection/loss/error/destructive action |

Color never carries meaning alone. Every state includes text and, where useful, an icon.

## Typography and data

- Font: local Inter Variable when available; `system-ui, sans-serif` fallback.
- Weights: 400 and 500 for controls/body; 600 is reserved for page/section headings only.
- Scale: 12/16 metadata, 14/20 body/table, 16/24 subtitle, 20/28 section, 28/34 page title.
- Sentence case only; no uppercase eyebrow labels.
- Comparable numbers use tabular figures.
- Money: `ARS 1.234.567,89`; quantities: `1.248 u.`; percentages: `12,5 %`.
- Dates include absolute time; relative time is supplementary.

## Geometry and interaction

- 8 px base grid; 4 px only inside compact groups.
- Compact controls: 36-42 px desktop; Operator touch targets at least 48 px.
- Rounded controls use approximately 10 px radius, panels 15-16 px, status badges full pill.
- Buttons use subtle native-control depth and visible hover/pressed/focus states.
- Motion is 140-220 ms and respects `prefers-reduced-motion`.
- Visible keyboard focus is mandatory.

## Action hierarchy

Each task context exposes at most one `primary` action.

| Variant | Purpose |
|---|---|
| Primary | advances the current task |
| Secondary | important alternative that does not advance it |
| Ghost | navigation, filtering, low-emphasis utility |
| Danger | destructive/rejection/loss branch with explicit consequence |

Filters, exports, view toggles, and destructive alternatives never compete visually with the primary action.

## Navigation and shells

Administrator navigation is a two-level tree grouped by task: Home, Operation, Management, Traceability, Reports, and Sales/Cash UI. Only the active group expands. The top bar contains global search, operational context, notification panel, and authenticated user.

Operator navigation is reduced to My work, Preparation, Dispatch, Receipt, Traceability, and Account. Every screen shows reporting CD, authorised branch/assignment, route, and next valid action.

## Surface selection

- Right drawer: create/edit a master record while preserving list context.
- Modal: short confirmation or one focused data capture.
- Full page: wizard, preparation, receipt, traceability, or report work.
- Toast: specific mutation success/failure; never a replacement for field validation.

Blocking overlays portal outside route transforms, lock background interaction, trap/restore focus, close with Escape when safe, and keep actions reachable at 320 px.

## Data and operational patterns

- Lists provide search/filter, loading, empty, error, stale, and retry states.
- More than seven relationship choices use paginated keyboard search.
- Operational reads display freshness and refresh at least every 15 seconds while visible.
- Stale data remains readable but cannot be used for confirmation.
- Order, delivery-note, and package details share state, route, responsible user, contents, related records, timeline, stock impact, blockers, and one next action.
- Preparation/dispatch Kanban contains order cards; reception/control Kanban contains delivery-note cards. All columns remain rendered. Drag opens the required action surface and never commits directly.

## Core logistics semantics

- One complete delivery note per order; no partial delivery note or dispatch.
- Package approval is individual audit evidence recorded after the package is complete and sealed; batch approval writes one result per eligible package.
- Receipt batch control requires expected/read seal and Intact/Violated per package, with a reason for every violation.
- Order, delivery-note, and package states remain separate and use the canonical machines in `specs/001-stocky-operational-ux/data-model.md`.

## Reports

Interactive R1/R2 views prioritise findings and resolution actions over decorative charts. Formal PDF is server-generated from a validated snapshot and is not a printout of the application shell.

## Required responsive review

- Administrator: 1366x768, 1606x1032, 1759x990.
- Operator: 320x568 and 390x844, plus desktop usability.
- Verify long labels, maximum table data, empty/error/stale states, keyboard-only overlays, and reduced motion.

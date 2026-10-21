# Acceptance Quickstart

## 1. Prepare the environment

```powershell
$env:STOCKY_SEED_ADMIN_PASSWORD='<local-admin-password>'
$env:STOCKY_SEED_OPERATOR_PASSWORD='<local-operator-password>'
python -m pip install -r backend/requirements.txt
python backend/scripts/seed_demo.py --reset
```

Before seeding, provide non-production passwords through `STOCKY_SEED_ADMIN_PASSWORD` and `STOCKY_SEED_OPERATOR_PASSWORD`. The seed must create one active Administrator and one active Operator with a reporting CD and at least one authorised branch.

## 2. Start the application

Terminal 1:

```powershell
python run_backend.py
```

Terminal 2:

```powershell
Set-Location frontend
npm ci
npm run dev
```

## 3. Automated checks

```powershell
python -m pytest backend/tests
Set-Location frontend
npm run check
npm run build
```

All commands must exit successfully. PDF tests must extract expected metadata/boundary rows from both reports.

## 4. Role and permission acceptance

1. Sign in as Administrator; verify all modules and every Operator action are reachable.
2. Sign out, sign in as Operator; verify reporting CD, assigned branch/shift, and actionable work are visible.
3. Attempt an unauthorised location/action through UI and direct API; both must reject it.
4. Refresh the browser and verify the session is restored; sign out and verify the session cannot be reused.

## 5. Master data and bulk catalog acceptance

1. Create/edit a CD or Local in a right drawer; submit invalid values and verify field-level corrections.
2. Open product/category/provider selectors with more than seven items and verify keyboard search/pagination.
3. Select at least 50 products; preview a percentage increase, then a percentage decrease.
4. Verify each prior price, rule, percentage, monetary difference, and resulting price.
5. Introduce one invalid result; confirmation must be disabled/rejected and no price may change.
6. Confirm a valid proposal once; all products must update atomically with a specific success toast.

## 6. Administrator control panel

1. Verify alerts, pending work, lifecycle workload, recent movements, and trends appear on one home page.
2. Every alert must have a resolution action that opens an already-filtered work list/detail.
3. Open the notification panel, mark/read an item, and navigate to its related entity.
4. Verify every trend states its comparison period, delta direction, and favourable/unfavourable/neutral meaning.

## 7. Complete logistics journey

1. Consolidate needs for one destination into an order with one active origin CD.
2. Package every ordered unit. Verify over-packing and mixed destinations are rejected.
3. Assign a unique seal to every complete package, individually or through a reviewed batch with one code per package.
4. Approve one eligible sealed package; then use `Approve all` and verify blocked packages remain unresolved with reasons.
5. Emit one delivery note; verify it contains every package and a second/partial delivery note is rejected.
6. Dispatch the complete delivery note.
7. As Operator, receive it at the authorised destination.
8. Control one package individually. Use batch control for the rest, entering expected/read codes and one `INTACTO|VIOLADO` result per package; provide a reason for every violation.
9. Before closure, review credited-stock and loss totals. Close and verify stock movements.
10. Search and open the order, delivery note, and each package; verify bidirectional links and complete immutable timelines.

## 8. Kanban and live-state acceptance

1. At 1606x1032, verify every order-stage column remains present and cards use the standard schema.
2. Drag a card; verify the approximately 3-degree tilt and that the required action surface opens without persisting.
3. Cancel; the card must return. Confirm; the card moves only after fresh server success.
4. Repeat the action from list view with keyboard only.
5. Simulate refresh failure; last known data remains, stale state is visible, and confirmation is disabled.

## 9. Sales/Cash integration acceptance

For an active Local, complete one sale with each payment Strategy, open its persisted receipt, register a linked partial return, and compare the resulting stock and `GET /api/caja/{local_id}` balance. Confirm invalid payment data, insufficient stock, a CD context, and an unreachable backend never produce a success state.

## 10. Reports and PDF acceptance

1. Run R1 and R2 with explicit filters and verify interactive findings/actions precede secondary charts.
2. Export PDF, CSV, and JSON from the same filters; totals must match.
3. Verify one Stocky header, report/version, filters, issue/freshness timestamps, actor, page numbers, static visuals, and expected first/last detail rows.
4. Render a long portrait report and a wide landscape appendix; no clipping, duplicate headers, UI controls, or empty dashboard space is allowed.

## 11. Responsive and accessibility acceptance

Inspect Administrator at 1366x768, 1606x1032, and 1759x990. Inspect Operator at 320x568 and 390x844, then desktop. For every blocking overlay: open by keyboard, traverse all fields/actions, cancel with Escape, and verify focus returns to the trigger. Confirm visible focus, accessible names, readable error text, and no color-only meaning.

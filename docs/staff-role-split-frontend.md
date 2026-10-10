# Frontend Implementation: Retiring Legacy STAFF and Staff Role Split

## 1. Overview & Architectural Context

In this branch (`codex/staff-role-split`), the legacy `STAFF` role has been retired in favor of distinct, specialized operational actors with strict domain boundaries and least-privilege scoping:

1. **`TECHNICIAN`**: Assigned technical `INCIDENT` work only. Reaches cabinets, inspects physical/hardware issues, performs repairs, attaches photo evidence, and records incident resolutions. Never accesses flower stock or store management.
2. **`SELLER_STAFF`**: Assigned shop `DELIVERY` work only within their own shop. Gathers flowers, fills designated empty slots at assigned kiosks, scans bouquet QR codes, attaches evidence, and updates delivery progress. Never performs technical incident repairs or owner financial actions.
3. **`OPERATIONS_MANAGER`**: Scopes and manages technician tasks. Dispatches technical incidents to technicians, reassigns technician tasks, reviews technician reports/evidence, and transitions tasks. Has no financial or administrative privileges (no wallet, payouts, refunds, withdrawals, or statement reconciliation).
4. **`SELLER`**: Manages own shop inventory, catalog, and dispatches delivery tasks to own seller staff (`/seller/tasks`). Scoped strictly to own shop (`sellerId`). Has financial navigation (wallet and subscription renewal) for own shop.
5. **`ADMIN`**: Maintains system administration, dispute resolution, refunds, withdrawals, and financial reconciliation. Retains read-only task oversight (`/admin/tasks`) without advertising assigning legacy staff.
6. **`CUSTOMER`**: Member account and flower shopping (`/tai-khoan`).
7. **Retired `STAFF`**: Legacy role retired. Forbidden from entering operational workspaces or task routes. Provided with an explicit signout / contact administrator view on `/workspace` that eliminates redirect loops.

---

## 2. Route Layout & Navigation

| Role                 | Landing / Main Route | Task Route                           | Navigation Scope                                                                            | Logout Destination |
| :------------------- | :------------------- | :----------------------------------- | :------------------------------------------------------------------------------------------ | :----------------- |
| `ADMIN`              | `/admin`             | `/admin/tasks` (read-only oversight) | Full ops, network, and financial (complaints, refunds, withdrawals, reconciliation)         | `/admin/login`     |
| `OPERATIONS_MANAGER` | `/operations`        | `/operations`                        | Technical operations & guide only; **ZERO financial nav**                                   | `/admin/login`     |
| `TECHNICIAN`         | `/technician`        | `/technician`                        | Technical incident tasks & repair guide only; **ZERO stock nav**                            | `/admin/login`     |
| `SELLER`             | `/seller`            | `/seller/tasks` (new section)        | Flower catalog, inventory, accessories, shop tasks (`/seller/tasks`), wallet, subscriptions | `/dang-nhap`       |
| `SELLER_STAFF`       | `/staff` (reused)    | `/staff`                             | Flower delivery tasks & stocking guide only; **ZERO incident repair & owner nav**           | `/dang-nhap`       |
| `CUSTOMER`           | `/tai-khoan`         | N/A                                  | Member account, order history, profile                                                      | `/dang-nhap`       |
| `STAFF` (retired)    | `/workspace`         | None (denied)                        | Standalone notice: role retired, contact admin, sign out                                    | `/admin/login`     |

### Loop Prevention & `/workspace` Dispatcher

- When an active authenticated role lands on `/workspace`, `WorkspaceAccount` immediately replaces the route with `accountPath(session.data.role)` (`/admin`, `/operations`, `/technician`, `/seller`, `/staff`, or `/tai-khoan`).
- When a legacy `STAFF` session visits `/workspace`, it is **not redirected**, halting potential redirect loops. It displays a clean, accessible message explaining that legacy staff accounts are retired and direct the user to contact the administrator or sign out.
- When a legacy `STAFF` session attempts to visit `/staff`, `/admin`, or `/operations`, the route `Guard` identifies an unauthorized role and redirects to `/workspace`, cleanly displaying the retirement state.

---

## 3. Component Refactoring & Explicit API Scoping

The following components were refactored from relying on boolean `admin` flags to accepting explicit scoping, role, and endpoint props:

### 1. `StaffTasks`

- Active Roles: Restricted to `ActiveTaskRole = 'ADMIN' | 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER' | 'SELLER_STAFF'`. Legacy `STAFF` is removed from active role types. If required role is absent or invalid, the component immediately fails closed without rendering task forms or queries.
- Props:
  - `actorRole?: ActiveTaskRole`: The active role.
  - `mode?: 'worker' | 'manager' | 'oversight'`: Explicit mode governing available actions.
  - `actorId?: string`: Actor ID for user-specific queries and cache segregation.
  - `sellerId?: string | null`: Seller tenant ID for shop-scoped queries.
  - `apiBase?: string`: Base task endpoint (e.g. `'/operations/staff-tasks'`, `'/sellers/{sellerId}/staff-tasks'`, `'/staff/tasks'`, `'/admin/staff-tasks'`).
  - `allowedKinds?: ('INCIDENT' | 'DELIVERY')[]`: Restricts which tasks are actionable and assignable.
  - `canAssign?: boolean`: Controls visibility of task assignment form.
  - `canReassign?: boolean`: Controls whether tasks can be handed off to other assignees.
  - `readOnly?: boolean`: Disables modification choices (used for `ADMIN` oversight).
  - `directoryEndpoint?: string`: Directory endpoint for assignees.
  - `incidentsEndpoint?: string`: Endpoint for open incident options.
  - `deliveryScopesEndpoint?: string`: Endpoint for shop delivery slot scopes.
- Domain Restrictions & Correct Copy:
  - `StaffStock` is **only** rendered for `SELLER_STAFF` when `task.kind === 'DELIVERY'`. Never rendered for `TECHNICIAN`. Reports and stock bounds are reviewed by the shop owner.
  - `StaffIncidentResolution` is **only** rendered for `TECHNICIAN` when `task.kind === 'INCIDENT'`. Never rendered for `SELLER_STAFF`. Incident repair reports are reviewed by the Operations Manager.
  - `ADMIN` oversight at `/admin/tasks` is read-only and does not advertise task assignment or review actions.
- Scoped Cache & Retry Keys:
  - Task query key: `['staff-tasks', role, actorId ?? 'none', scopeKey, page, status]`
  - Query keys across all child components (`staff-detail`, `staff-evidence`, `staff-stock`, `staff-directory`) incorporate `actorId` and `scopeKey` (`seller:${sellerId}` or `apiBase`).
  - Persistent retry keys in `sessionStorage` (`assignment`, `reassignment`, `evidence`, `stock`, `incident`) incorporate `actorId` and `scopeKey` (`seller:${sellerId}` or `apiBase`), preventing old or different-scope attempts from being replayed. Old un-scoped keys are completely ignored.

### 2. `AdminTaskAssignment`

- Props: `actorId`, `apiBase`, `actorRole`, `allowedKinds`, `directoryEndpoint`, `incidentsEndpoint`, `deliveryScopesEndpoint`, `sellerId`.
- Retry Key: `florabot-task-assignment:${effectiveRole}:${actorId}:${scopeKey}`
- Domain Restrictions:
  - For `OPERATIONS_MANAGER`: `allowedKinds` is locked to `['INCIDENT']`. Only incidents can be chosen; `DELIVERY` is absent.
  - For `SELLER`: `allowedKinds` is locked to `['DELIVERY']`. Only shop delivery scopes can be chosen; `INCIDENT` is absent.
- Preserves full sessionStorage recovery, validation, focus management, and optimistic recovery.

### 3. `StaffReassignment`

- Props: `taskId`, `version`, `assigneeId`, `assigneeName`, `apiBase`, `directoryEndpoint`, `actorId`, `sellerId`, `role`.
- Retry Key: `florabot-staff-reassign:${role}:${actorId}:${scopeKey}:${taskId}`
- Queries directory from `directoryEndpoint` (`/operations/staff` for manager, `/sellers/{sellerId}/staff` for shop owner).
- Disallows reassigning to current assignee, enforces validation (reason $\ge$ 10 chars), checkbox confirmation, and ambiguous error recovery.

### 4. `StaffTaskDetails` & `StaffEvidence`

- Accepts `apiBase`, `readOnly`, `mode`, `actorId`, `sellerId`, and `role`.
- Retry Key (evidence): `florabot-staff-evidence:${actorId}:${scopeKey}:${taskId}`
- Scoped to respective prefix (`/operations/staff-tasks`, `/sellers/{sellerId}/staff-tasks`, `/staff/tasks`, `/admin/staff-tasks`).
- Evidence uploading and attaching is strictly restricted to workers (`isWorker && actorId && active`).

### 5. `StaffStock` & `StaffIncidentResolution`

- `StaffStock` Retry Key: `florabot-staff-stock:${actorId}:${scopeKey}:${taskId}`
- `StaffIncidentResolution` Retry Key: `florabot-staff-resolution:${actorId}:${scopeKey}:${taskId}`
- Preserves idempotency ticket saving, recovery after reload, and error handling.

---

## 4. Assumptions & Clarifications Reported to Coordinator

1. **Admin Oversight vs. Dispatching**:
   - _Status_: Kept read-only under `/admin/tasks` without advertising assigning legacy staff accounts.
   - _Clarification for Backend/Coordinator_: Will platform administrators in the future have a unified reassignment/dispatching tool across all kiosk technicians and shop delivery staff, or should task assignment remain strictly split between `OPERATIONS_MANAGER` (technicians) and `SELLER` (seller staff)?
2. **Backend Server-Side Scoping**:
   - The frontend assumes that:
     - `GET /api/operations/staff-tasks` and `GET /api/operations/incidents` are pre-filtered by the backend based on the manager's assigned kiosk regions.
     - `GET /api/sellers/{sellerId}/staff-tasks` and `GET /api/sellers/{sellerId}/staff` verify that the authenticated caller owns `sellerId`.
     - `GET /api/staff/tasks` returns only tasks assigned to the authenticated user (whether technician or seller staff).
3. **Directory Semantics**:
   - `GET /api/operations/staff` returns a list of technician accounts (`{ id, name }[]`).
   - `GET /api/sellers/{sellerId}/staff` returns a list of shop staff accounts (`{ id, name }[]`).
4. **No Unrelated Redesigns**:
   - The existing green botanical design system (`DESIGN.md`), typography (`Be Vietnam Pro`, `Nunito`), and responsive layout conventions were strictly preserved. No new libraries or dependencies were added.

---

## 5. Verification Plan & Test Execution Evidence

All checks executed within this isolated worktree (`codex/staff-role-split`):

| Gate / Command                                                             | Description                                                         | Result                                             |
| :------------------------------------------------------------------------- | :------------------------------------------------------------------ | :------------------------------------------------- |
| `pnpm lint`                                                                | ESLint checking all packages and test scripts (`--max-warnings=0`)  | **PASS** (0 warnings, 0 errors)                    |
| `pnpm typecheck`                                                           | Next.js typegen and TypeScript compiler (`tsc --noEmit`)            | **PASS** (zero type errors)                        |
| `pnpm test`                                                                | Vitest unit test suite                                              | **PASS** (3/3 tests passed)                        |
| `pnpm build`                                                               | Production Next.js build (`next build --webpack`)                   | **PASS** (all 23 static & dynamic routes compiled) |
| `pnpm exec playwright test --config artifacts/playwright.portal.config.ts` | Portal Playwright test suite using isolated server on port **3024** | **PASS** (**145/145 passed**, 1.2m duration)       |

No running live demo instances on port 3010 were touched or disturbed. All tests were executed against an isolated preview server on port 3024 with zero database resets.

## Coordinator review — 2026-10-10

Final review fixes use actor/API/tenant-scoped query and retry keys and fail closed for invalid roles. The final full worker browser run was 144 passed / 2 failed (guest-history at 390 and 1440); the changed task/auth/navigation suite passed 49/49. The earlier 145/145 above describes the first draft only, not final full-suite acceptance. Manager scope is explicit kiosk mapping, not completed region/shift management. Admin task UI is read-only; privileged admin API oversight remains available.

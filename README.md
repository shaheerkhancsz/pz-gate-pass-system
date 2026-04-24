# Gate Pass Management System – AGP Pharma Edition

This is the development roadmap for the Enterprise Gate Pass Management System being customized for **AGP Pharma Private Limited**. Each step is implemented, tested, and then marked as complete below.

---

## ✅ Development Progress

### Phase 1: Multi-Company Architecture
> **Goal:** Support AGP Pharma, OBS Pakistan & OBS International in one system.

- [x] Add `companies` table to database schema
- [x] Add `companyId` foreign key to `users` table
- [x] Add `companyId` foreign key to `gatePasses` table
- [x] Add `companyId` to `customers` and `drivers` tables
- [x] Company CRUD API endpoints (`/api/companies`)
- [x] Company Management UI added to Admin Panel (Companies tab — Admin only)
- [x] `CompaniesManager` component with Add / Edit / Delete support
- [x] Update User creation / edit form to include Company selection dropdown
- [x] Filter all gate pass listings by user's assigned company
- [x] Add Group Admin role with cross-company data access
- [x] **Test:** Create 2 companies, assign users to each, verify data isolation

---

### Phase 2: Custom Approval Workflow
> **Goal:** Replace simple status with HOD → Security multi-tier approval flow.

- [x] Update gate pass `status` field values to:
  - `pending` → `hod_approved` → `security_allowed` → `completed`
  - `rejected` (terminal state)
  - `sent_back` (returns to initiator with remarks)
- [x] Add `remarks` field to gate passes for HOD Send Back notes
- [x] Add `hodApprovedBy` and `hodApprovedAt` tracking fields
- [x] Add `securityAllowedBy` and `securityAllowedAt` tracking fields
- [x] Create HOD Dashboard view (sees only pending passes from their department)
- [x] Create Security Guard dashboard view (sees only HOD-approved passes)
- [x] Lock gate pass editing once status is `hod_approved` or beyond
- [x] Add workflow action buttons: Approve / Reject / Send Back / Security Allow
- [ ] **Test:** Full end-to-end workflow: Create → HOD Approve → Security Allow → Completed
- [ ] **Test:** Send Back flow: Create → HOD Send Back → User Edits → Re-submits → HOD Approves

---

### Phase 3: New Gate Pass Types
> **Goal:** Support Outward, Inward, and Returnable passes.

- [x] Add `type` field to `gatePasses` schema (`outward`, `inward`, `returnable`)
- [x] Add `expectedReturnDate` field for Returnable passes
- [x] Add `actualReturnDate` field for Returnable passes
- [x] Update Create Gate Pass form with type selector
- [x] Update Gate Pass List page to show/filter by type
- [x] Build Inward gate pass form (different fields: supplier, incoming items)
- [x] Build Returnable gate pass form (with expected return date)
- [x] Add overdue alert for Returnable passes past their return date
- [ ] **Test:** Create one of each type and verify correct fields appear

---

### Phase 4: Notification System
> **Goal:** Send automated Email/Whatsapp Meta API alerts on workflow actions.

- [x] Email to HOD when a new gate pass is submitted (Pending)
- [x] Email to Initiator when HOD Approves / Rejects / Sends Back a pass
- [x] Email to Security when a pass is HOD-Approved and awaiting security
- [x] Email to HOD when an initiator resubmits a sent-back pass
- [x] Alert for overdue Returnable gate passes (`POST /api/notifications/overdue-check`)
- [x] WhatsApp alerts via Meta Graph API (sent alongside email to users with phone numbers on their profiles)
- [x] SMS alert via existing Twilio integration (framework in place, triggered via notificationService)
- [ ] **Test:** Submit a gate pass and verify email is received by HOD

---

### Phase 5: SAP ERP Integration
> **Goal:** Sync Master Data from SAP; auto-create passes from Sale Orders.

- [x] Define SAP API endpoint configuration per-company (Admin → SAP Integration tab)
- [x] Build API service to fetch Employees from SAP (`syncEmployees` — imports as inactive users)
- [x] Build API service to fetch Vendors/Customers from SAP (`syncCustomers` — SAP Business Partners)
- [x] Build API service to fetch Products from SAP (`syncProducts` — SAP Materials → products table)
- [x] On-demand sync with individual entity buttons + Full Sync (scheduled cron can call `POST /api/sap/sync/:companyId`)
- [x] Webhook/listener to auto-create draft gate pass from a SAP Sale Order (`POST /api/sap/webhook/sale-order`)
- [x] Disable manual creation of Customers/Drivers when SAP is enabled for the company
- [x] `products` table added to schema + migration 008 for SAP-synced materials catalog
- [ ] **Test:** Trigger a test Sale Order in SAP sandbox and verify draft gate pass appears

---

### Phase 6: Active Directory (SSO) Integration
> **Goal:** Users log in with their existing Windows/Network credentials.

- [x] Install and configure `ldapauth-fork` on the backend
- [x] Add AD/LDAP server configuration to Company Settings (Admin Panel → Active Directory tab)
- [x] Update login form to support AD login flow (Email Login + Windows Login tabs)
- [x] Auto-provision user profile on first successful AD login
- [x] Keep fallback local login for admin/super-admin
- [x] **Test:** Verified login page tabs, company selector, and AD config form loading

---

### Phase 7: Master Data Modules (Plants, Gates, Vendors, Item Master, Division)
> **Goal:** Add operational master-data modules missing from the old AGP system.

- [x] `plants` table + API (`/api/plants`) + `PlantsManager` UI (Admin → Plants tab)
- [x] `gates` table + API (`/api/gates`) + `GatesManager` UI (Admin → Gates tab) — gates belong to plants
- [x] `vendors` table + API (`/api/vendors`) + `VendorsManager` UI (Admin → Vendors tab)
- [x] `itemMaster` table + API (`/api/item-master`) + `ItemMasterManager` UI (Admin → Item Master tab)
- [x] `division` field added to employee form and list
- [x] Gate selector on Gate Pass form (shown only when company has gates configured)
- [x] `code` and `logo` fields added to Companies manager
- [x] Migration `013_company_code_logo.sql` for new company fields
- [x] Soft-delete (active flag) for all 4 new entities; Admin lists show all with status badge
- [ ] **Test:** Create plant → gate → assign gate on a gate pass, verify gate name appears on view

---

### Phase 8: Reporting & Analytics Suite
> **Goal:** Comprehensive reporting across all system data with export capability.

#### ✅ All 13 Reports Completed (`/reports` page — scrollable tab bar)

| # | Tab | Component | Description |
|---|-----|-----------|-------------|
| 1 | **Standard** | `ReportsPanel` | Gate pass list with filters (type/status/company/date/dept), Excel + PDF export |
| 2 | **Custom** | `CustomReportBuilder` | Column/filter builder; preview + Excel/PDF export (permission-gated) |
| 3 | **Analytics** | `AnalyticsVisualization` | Bar/line charts: status, type, department, monthly trend, daily trend, KPI cards |
| 4 | **Pending** | `PendingApprovalsReport` | Live workflow queue (HOD/Security/Sent-Back) + Approval Cycle Time (avg stages, slowest-10 table) |
| 5 | **Returnables** | `ReturnableTracker` | Open returnable tracker with overdue flags, KPI cards, sorted by expected return date |
| 6 | **Gate Traffic** | `GatePlantTrafficReport` | Gate-wise & plant-wise traffic breakdown, sortable, share % bar, Excel export (2 sheets) |
| 7 | **Companies** | `CompanyWiseSummaryReport` | Admin-only cross-company summary: type/status breakdown per company, share % bar, Excel export |
| 8 | **Departments** | `DepartmentWiseSummaryReport` | Dept-wise breakdown, sortable all columns, company + date + search filters, Excel export |
| 9 | **User Activity** | `UserActivityReport` | Per-user action summary (logins/creates/updates/approvals) + collapsible raw audit log |
| 10 | **Vendor/Customer** | `VendorCustomerReport` | Customer directory + gate pass activity counts; Vendor directory with SAP/status filters |
| 11 | **Item Movement** | `ItemMovementReport` | Items joined from gate passes via backend API; qty by type, department badges, movement log |
| 12 | **Documents** | `DocumentReport` | Document listing with file-type/entity breakdown + Completeness Audit (passes with no docs) |
| 13 | **Drivers** | `DriverActivityReport` | Driver registry + ad-hoc detection, trip counts by type, vehicle badges, collapsible trip log |

- [x] All reports support **Excel export** (XLSX)
- [x] Standard + Custom reports support **PDF export**
- [x] All reports respect **company scoping** (non-admins see only their company's data)
- [x] Admin users get **company selector filter** on all applicable reports
- [x] All status/type values use **color-coded pills** matching the workflow (all 6 statuses)
- [x] **No pending report work remaining**

---

### Phase 9: In-App Notification Center
> **Goal:** Bell icon + inbox so users see alerts inside the app without checking email.

- [x] Add notification bell icon to top navbar with unread count badge
- [x] Dropdown inbox panel showing last 50 notifications (title, message, time ago, read/unread)
- [x] `GET /api/notifications` — fetch notifications for logged-in user (paginated, newest first)
- [x] `GET /api/notifications/unread-count` — fast badge count endpoint (polled every 30s)
- [x] `PATCH /api/notifications/:id/read` — mark single notification as read
- [x] `PATCH /api/notifications/read-all` — mark all as read
- [x] Auto-populate notifications table when workflow actions fire (new pass, approve, reject, send-back, security-allow, resubmit, overdue)
- [x] Real-time unread count refresh (poll every 30s via React Query refetchInterval)
- [x] Click on notification navigates to the relevant gate pass
- [x] Storage methods: `createNotification`, `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead`
- [ ] **Test:** Submit a gate pass, verify bell badge appears for HOD; HOD approves, verify initiator bell updates

---

### Phase 10: Forgot Password / Self-Service Reset
> **Goal:** Users can reset their own password via email link instead of calling the admin.

- [x] Add "Forgot Password?" link to Login page (navigates to `/forgot-password`)
- [x] `POST /api/auth/forgot-password` — generates a 1-hour token, emails HTML reset link
- [x] Add `passwordResetToken` and `passwordResetExpiry` columns to `users` table (migration `014`)
- [x] `GET /api/auth/reset-password/:token` — validate token (not expired, returns `{ valid: bool }`)
- [x] `POST /api/auth/reset-password/:token` — bcrypt-hash new password, invalidate token
- [x] Frontend `ResetPassword` page (`/reset-password/:token`) — password + confirm, strength rules
- [x] Frontend `ForgotPassword` page (`/forgot-password`) — email input, success state
- [x] Storage methods: `setPasswordResetToken`, `getUserByResetToken`, `clearPasswordResetToken`
- [x] Anti-enumeration: always returns 200 even for unknown emails
- [ ] **Test:** Request reset for a known email, use link, verify login works with new password

---

### Phase 11: Automated Overdue Alert Scheduling
> **Goal:** Run the overdue-check automatically every day instead of manually calling the endpoint.

- [x] Implemented using Node's built-in `setTimeout` (no new dependency) — recursive daily rescheduling
- [x] Scheduler starts when server starts; calculates `ms` until next 09:00 and sets timeout
- [x] Calls `notificationService.checkAndNotifyOverduePasses()` — sends email + creates in-app notifications
- [x] Logs each run to `userActivityLogs` table (`userEmail: "system"`, `actionType: "system_task"`)
- [x] Logs next scheduled time to server console at startup
- [ ] **Test:** Temporarily change target time to 1 min in future, restart server, verify run fires and logs appear

---

### Phase 12: Batch Gate Pass Operations
> **Goal:** HODs with many pending passes can approve/reject them in bulk.

- [x] Checkbox column in Gate Pass List (visible only to users with `gatePass:approve` permission)
- [x] Only `pending` passes show checkboxes; "Select All on Page" master checkbox in header
- [x] Floating action bar (fixed bottom center) appears when ≥1 pass selected: Approve / Send Back / Reject
- [x] `POST /api/gate-passes/batch-approve` — body: `{ ids, userId }` — per-pass approve + notifications
- [x] `POST /api/gate-passes/batch-reject` — body: `{ ids, userId, remarks }` — per-pass reject + notifications
- [x] `POST /api/gate-passes/batch-send-back` — body: `{ ids, userId, remarks }` — remarks required
- [x] Inline modal dialog for remarks (required for send-back, optional for reject)
- [x] Each batch action fires individual `notifyInitiatorOfHodDecision` notifications per pass
- [ ] **Test:** Select 3 pending passes, batch approve, verify all move to `approved`

---

### Phase 13: Gate Pass Print / PDF Template
> **Goal:** Generate a printable, company-branded gate pass document.

- [x] "Print" button on Gate Pass View page opens `/print-gate-pass/:id` in new tab
- [x] `PrintableGatePass` component: company logo, pass number, QR code, items table, signatures block
- [x] Three copy types: Record Copy / Driver Copy / Guard Copy (tab selector on print page)
- [x] `@media print` CSS: hides navbar/controls, full-width layout
- [x] `window.print()` triggers browser print-to-PDF dialog
- [x] Workflow timestamps shown: HOD approved by/at, security allowed by/at
- [x] QR code links to public verify URL (`/verify/:gatePassNumber`)
- [x] **Already implemented** — `PrintGatePass` page and `PrintableGatePass` component existed

---

### Phase 14: Dashboard Enhancements
> **Goal:** Role-specific dashboard widgets to surface the most relevant data per user.

- [x] HOD widget: "My Pending Approvals" — count badge + top-5 list of pending passes from their department
- [x] Security Guard widget: "Awaiting Security Clearance" — count + list of HOD-approved passes
- [x] All-user widget: "My Active Passes" — passes created by the logged-in user in non-terminal states
- [x] Overdue Returnables red alert banner (shown when any overdue pass exists, links to Reports)
- [x] `DashboardRoleWidgets` component renders above the existing configurable widgets
- [x] Each widget card shows pass number, customer, status badge, and links to view the gate pass
- [ ] **Test:** Log in as HOD, verify pending approvals widget shows only their department's passes

---

### Phase 15: Document Preview
> **Goal:** View PDF and image documents in-app without downloading.

- [x] "Preview" button (FileText icon) alongside Download in `DocumentList`
- [x] Modal preview dialog: images via `<img>` with `object-contain`; PDFs via `<iframe>` (500px height)
- [x] Fallback "Download to view" with `<File>` icon for unsupported file types (.docx, .xlsx, etc.)
- [x] Shows description and uploader info in the preview dialog
- [x] **Already implemented** — `DocumentList` component had preview functionality

---

### Phase 16: Compliance Audit Trail Export
> **Goal:** Generate a full audit report for GMP / ISO compliance reviews.

- [x] "Export Audit Trail" button added to User Activity report (alongside existing Export Excel)
- [x] Exports 2-sheet Excel: Sheet 1 = Per-user Summary, Sheet 2 = Full Audit Log (all events)
- [x] Full Log includes: Timestamp, User Email, Action, Entity Type, Entity ID, Description, IP, User Agent
- [x] Date range in filename when date filters applied (e.g. `Audit_Trail_2026-01-01_to_2026-01-31_...xlsx`)
- [x] Reuses existing `userActivityLogs` data already loaded in the report (no new API needed)
- [x] Existing activity log records all workflow events: create, approve, reject, send-back, security-allow
- [ ] **Test:** Set date range filters, click Export Audit Trail, verify 2 sheets in the Excel file

---

### Phase 17: Force Close Gate Pass
> **Goal:** Allow admins / security managers to administratively close any stuck gate pass with a mandatory reason, maintaining full audit trail.

- [x] Add `force_closed_by`, `force_closed_at`, `force_close_remarks` columns to `gate_passes` table
- [x] Migration `016_force_close.sql`
- [x] `POST /api/gate-passes/:id/force-close` — requires `gatePass:manage` permission; remarks mandatory; blocks terminal statuses (`completed`, `rejected`, `force_closed`)
- [x] In-app notification sent to pass creator when force closed
- [x] Activity log entry recorded (`actionType: "force_close"`)
- [x] `force_closed` status label and badge added to `theme.ts` (dark red)
- [x] **Force Close** button added to `WorkflowActions` — visible only to admin / `gatePass:manage` roles; sits apart from normal workflow buttons; opens confirmation dialog with warning banner and mandatory remarks field
- [ ] **Test:** Admin force closes a pending pass → verify status = `force_closed`, creator notification received, audit log entry created

---

### Phase 18: Gate Pass Form Improvements ✅
> **Goal:** Fix gaps identified in the Create New Gate Pass form — missing fields, dead code, and disconnected master data.

#### Priority: High
- [x] **Vendor selection for Inward passes** — `VendorSelection.tsx` created (mirrors `CustomerSelection`); shown for `inward` type, hidden for outward/returnable. Fetches from `/api/vendors?companyId=X` with client-side search filter. Auto-fills supplier name, phone, address.
- [x] **Unit field on gate pass items** — Migration `019_item_unit.sql` adds `unit VARCHAR(50)` to `items` table. `insertItemSchema` updated. Unit column added to form item rows and `PrintableGatePass.tsx`. Unit field stored and returned from API.

#### Priority: Medium
- [x] **Link items to Item Master** — Magnifying-glass popover added to each item row. Fetches `/api/item-master?companyId=X`; filters by name/code; on selection auto-fills item Name, SKU, and Unit. Manual free-text entry still allowed as fallback.
- [x] **Department dropdown from database** — Queries `/api/departments?companyId=X` for admin users; falls back to hardcoded `departmentOptions` from `utils.ts` when DB returns no active departments.

#### Priority: Low
- [x] **Company selector for admin on gate pass create** — Admin-only `<Select>` rendered above Gate Pass Type when `companies.length > 1`. `selectedCompanyId` flows into gates/departments/item-master queries and is passed in both create and print submission payloads.
- [x] **Remove dead debug code** — `showDocumentUpload` state, `createdGatePassId` state, and `console.log` debug line all removed from `GatePassForm.tsx`.

#### Bug Fix (discovered during testing)
- [x] **`expectedReturnDate` / `actualReturnDate` schema coercion** — Drizzle `date()` columns generated `z.date()` validators that rejected ISO string input from the form. Fixed by adding `z.coerce.date()` overrides to `insertGatePassSchema` in `shared/schema.ts`. All three gate pass types (Outward, Inward, Returnable) now create successfully via API.

---

### Phase 19: Mobile Responsiveness & UI Polish
> **Goal:** Make the application fully responsive so it works on all screen sizes including phones (375px+), tablets, and desktops. Client requirement: 100% mobile usable.

#### Critical — Layout Breaks on Mobile
- [x] **GatePassList table** — `hidden sm:table-cell` on Date/Type/Department columns; `overflow-x-auto` wraps table; `px-3 sm:px-6 py-3` cell padding.
- [x] **RolePermissionsManager** — Removed fixed `w-44`; uses `sm:w-44 sm:shrink-0`; permission rows use `flex-col sm:flex-row` with `gap-2 sm:gap-0`.
- [x] **All report tables** — All 13 report components already have `overflow-x-auto` wrappers confirmed; `ReportsPanel` also wraps tables correctly.
- [x] **Customers/Drivers dialogs** — Form grids changed to `grid-cols-1 sm:grid-cols-2`; dialog uses `w-[calc(100vw-2rem)] sm:max-w-lg`.

#### Major — Bad UX on Mobile
- [x] **Floating batch-action bar overlap** — Card uses `pb-20 sm:pb-0` when batch bar is visible; bar repositioned to `left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2`.
- [x] **Admin tabs overflow** — TabsList uses `flex w-full overflow-x-auto whitespace-nowrap pb-1 h-auto flex-nowrap justify-start gap-1`.
- [x] **NotificationBell dropdown** — Panel uses `w-[calc(100vw-1rem)] sm:w-80 md:w-96 max-w-sm sm:max-w-none`.
- [x] **Header search touch target** — Input uses `h-10 pl-10 pr-4`; icon at `left-3`.
- [x] **WorkflowActions buttons** — Container uses `[&>button]:w-full [&>button]:sm:w-auto` so buttons stack full-width on mobile.
- [x] **Reports tabs** — TabsList uses `flex flex-nowrap w-max`; container has `overflow-x-auto pb-1`.

#### Minor — Cosmetic / Padding / Typography
- [x] **Global padding scale** — AppLayout already had `p-2 sm:p-4 md:p-6`; GatePassList cells changed to `px-3 sm:px-6 py-3`.
- [x] **Responsive page titles** — All pages changed from `text-2xl` to `text-xl sm:text-2xl` (Dashboard, Admin, Reports, GatePassList, CreateGatePass, ViewGatePass, EditGatePass, Customers, Drivers, Documents, Vendors, CompanySettings).
- [x] **Dialog widths** — Customers and Drivers dialogs use `w-[calc(100vw-2rem)] sm:max-w-lg`.
- [x] **PrintableGatePass screen preview** — Changed from `p-8` to `p-3 sm:p-8`; print styles unchanged.
- [x] **Sidebar landscape phones** — Nav uses `max-h-[calc(100vh-8rem)] overflow-y-auto` to prevent clipping.
- [x] **Touch-friendly inputs** — Header search input uses `h-10` (40px); Shadcn Button/Input components already meet 40px minimum.

---

## 🛠️ Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS, Shadcn UI |
| Backend | Node.js, Express |
| Database | MySQL via Drizzle ORM |
| Auth | Passport.js (Local + LDAP) |
| Notifications | Nodemailer (Email), Meta API (Whatsapp) |
| Integrations | SAP REST/SOAP APIs |

---

## 📋 Legend
- `[ ]` – Not started
- `[/]` – In progress
- `[x]` – Completed & tested

---

### Phase 20: Print Gate Pass — Pre-Handover Fixes
> **Goal:** Fix all gaps in the printed gate pass document identified during final QA before client handover.

#### 🔴 Critical
- [x] **Gate pass type not shown** — Type badge (Outward / Inward / Returnable) now printed with colour in the pass meta row
- [x] **Approval chain missing** — HOD approver name + date and Security approver name + date shown on Record Copy; enriched via `/api/gate-passes/:id` (joins users, gates, companies)
- [x] **Signature boxes wrong** — Updated to: Prepared By / HOD Approver / Security Officer matching actual workflow
- [x] **Notes field not printed** — Notes/Remarks section now shown when `data.notes` is present
- [x] **Return dates missing for Returnable passes** — Expected Return Date and Actual Return Date shown in pass meta row for returnable type
- [x] **Items table footer label misleading** — Footer now correctly says "Total Quantity"
- [x] **Gate info missing** — Gate name fetched via enriched API and shown in pass meta row when set

#### 🟡 Medium
- [x] **Logo from DB not used** — `PrintableGatePass` now uses `companyInfo.logo` from enriched API (base64/URL), falls back to static file
- [x] **All 3 copy types look identical** — Guard Copy: large QR + minimal info. Driver Copy: driver info prominent, no approval chain. Record Copy: full details + approval trail
- [x] **Company name from static config** — Company name now sourced from `companyInfo.name` returned by enriched API

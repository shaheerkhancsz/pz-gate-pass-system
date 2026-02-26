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

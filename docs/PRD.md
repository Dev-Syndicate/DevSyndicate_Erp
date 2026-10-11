# DevSyndicate ERP

**Product Requirements Document (PRD)**  
**Version:** 1.3  
**Status:** Initial Development  
**Product:** DevSyndicate ERP  
**Primary Module:** Finance  
**Target:** Internal DevSyndicate Operations  
**Infrastructure Goal:** ₹0/month using free tiers initially

---

## Changelog

### v1.3 (2026-10-11)

- **Credit notes researched:** tax follows the original invoice, the GST 30-November time limit, Rule 53(1A) contents, overpayment released to client credit, cancel rules (§18).
- **Payments:** the date received and bank reference (UTR / UPI ID) are entered when confirming; proof of payment received can be attached there (§19).
- **Quotations:** Send = assign number + download PDF in one step (§13).
- **Invoices:** due date is optional and off by default; an invoice without one is never overdue. Place of supply defaults to the client's state and is printed only on GST documents (§15, §16).

### v1.2 (2026-10-10)

- **TDS on receipts.** A receipt records amount received plus TDS deducted by the client; both settle invoices and count as revenue; TDS is reported as TDS Receivable (§9.2, §19).
- **GST on advances.** When GST-registered, advances print as Rule 50 receipt vouchers and refunds of advances as Rule 51 refund vouchers; receipt numbers then stay within 16 characters (§19, §30).
- **Payment corrections clarified.** Cancel needs a reason; credit can be applied to or removed from invoices after confirming; refunded credit blocks cancelling the receipt (§19).
- **Proof uploads** go straight from the browser to Storage and are verified on the server (§20).
- **Quotation template:** optional per-line timeline and signatory designation on PDFs (§13, §29).

### v1.1 (2026-10-10)

- **Payments are incoming-only.** All outgoing money lives in Expenses. Removes double-counting between Payments and Expenses.
- **Payment status separated from invoice status.** Payments are `Pending / Confirmed / Cancelled`; only confirmed payments affect balances.
- **Revenue defined (cash basis).** Every KPI now has a single formula (§9).
- **Calculation order defined** for line discounts, document discounts, tax, and rounding (§9.3).
- **Money, currency, timezone, date and financial-year conventions** added (§8).
- **One quotation → many invoices** (milestone / advance billing) (§14).
- **Advance payments, payment allocations, overpayments and refunds** supported (§19).
- **Invoices lock once issued.** Corrections use Credit Notes (new, §18).
- **Quotation revisions** added (§13).
- **Vendors, client contacts, configurable expense categories and tax rates** added.
- **GST-ready invoices** (GSTIN, SAC, place of supply, CGST/SGST/IGST split), switchable via company settings (§15, §29).
- **Financial-year based, gapless document numbering**, assigned on issue (§30).
- **Invite-only accounts**; public sign-up disabled (§6).
- **Permission naming unified**; default role matrix added; Admin scope clarified (§4, §5).
- **RLS implementation approach**, service-role key rules, Super Admin protection (§32).
- **Trigger-based, append-only audit logs** including updates and deletions (§28).
- **Storage security** (private buckets, signed URLs, size and type limits) (§26).
- **Company settings fields** defined (§29).
- **Free-tier risks** (backups, project pausing, Vercel Hobby terms, email limits) and mitigations (§34).
- **"Send" defined for V1** (§13, §17).
- **CSV import** and **non-functional requirements** added (§39, §40).
- **Database relationships corrected**; `organization_id` added for future SaaS (§31).
- **Development order revised**: audit and backups move to the foundation phase (§44).
- **Open questions** for the owner listed (§46).

---

# 1. Product Overview

DevSyndicate ERP is an internal business management platform designed to manage the company's financial and operational activities from a single application.

The first version will focus primarily on **Finance**, while establishing the architecture required to expand into CRM, Projects, Team Management, and other ERP modules later.

The system will manage:

- Users
- Roles and permissions
- Clients and client contacts
- Vendors
- Quotations
- Invoices
- Credit notes
- Payments received
- Expenses
- Payment proofs and receipts
- Financial reports
- Documents
- Audit logs

The system must be designed so additional modules can be added without restructuring the entire application.

---

# 2. Product Goals

## Primary Goals

1. Centralize DevSyndicate's financial records.
2. Create and manage professional quotations.
3. Convert accepted quotations into one or more invoices.
4. Track invoice payments.
5. Store payment proof documents.
6. Track company expenses.
7. Calculate revenue, expenses, outstanding payments, and net cash position.
8. Provide role-based access control.
9. Maintain an audit trail for important actions.
10. Keep the initial infrastructure cost at ₹0 using available free tiers.

## Secondary Goals

1. Reduce dependency on spreadsheets (including importing existing spreadsheet data).
2. Make financial information easier to search.
3. Make payment records auditable.
4. Provide a foundation for a complete ERP.
5. Make the system reusable if DevSyndicate later offers it as a SaaS product.

---

# 3. Non-Goals for V1

The following will NOT be part of the first release:

- Full double-entry accounting software
- GST return filing (GSTR-1, GSTR-3B, etc.)
- Payroll
- Banking integration
- Automatic bank reconciliation
- Inventory management
- Attendance management
- Advanced CRM
- Project management
- WhatsApp automation
- Automated email sending of documents
- AI financial analysis
- Multi-company accounting
- Multi-currency (V1 is INR only)
- Recurring invoices / recurring expenses

These may be introduced in future versions.

**Clarifications:**

- GST *filing* is out of scope, but if DevSyndicate is GST-registered, invoices issued by V1 **must be GST-compliant tax invoices** (§15).
- Multi-company accounting is out of scope, but every business table carries an `organization_id` so a future SaaS version does not require a data migration (§31).

---

# 4. Target Users

Roles are **default permission bundles**, not hard-coded logic. All checks are done against permissions (§5). Each user has exactly one role in V1.

## 4.1 Super Admin

Usually the company owner/founder.

- Has every permission.
- Is the only role that can create/edit roles, change permissions, assign the Super Admin role, and update company settings.
- At least one active Super Admin must always exist (enforced in the database, §32).

## 4.2 Admin

Manages day-to-day business operations.

Access:

- Dashboard
- Clients, Vendors
- Quotations, Invoices, Credit Notes
- Payments, Expenses
- Documents
- Reports
- Users (view, invite, update, deactivate — non-Super-Admin users only)
- Company settings (view only)

Cannot:

- View, modify, deactivate, or delete a Super Admin
- Assign the Super Admin role
- Create/edit roles or change permissions
- View audit logs
- Change company settings

## 4.3 Finance

Responsible for financial operations.

Can:

- View financial dashboard
- Manage clients and vendors
- Create quotations and invoices
- Issue credit notes
- Record payments and expenses
- Upload payment proofs and receipts
- View and export financial reports

Cannot:

- Manage users
- Modify roles or permissions
- Change company settings
- View audit logs

## 4.4 Staff

Limited access. Permissions are configured per role by a Super Admin.

Example Staff role:

```text
dashboard.view
clients.view
quotations.view
quotations.create
```

A staff member only sees modules and actions they have permission to access. Staff do not have access to payments, expenses, reports, or financial KPIs by default.

---

# 5. Permission System

The application uses **permission-based authorization**. Code and database policies check permissions, never role names.

Naming convention: `<module>.<action>`. Standard actions are `view`, `create`, `update`, `delete`; module-specific actions are listed below.

```text
dashboard.view

clients.view
clients.create
clients.update
clients.delete

vendors.view
vendors.create
vendors.update
vendors.delete

quotations.view
quotations.create
quotations.update
quotations.delete        (drafts only)
quotations.send          (mark as sent / issue)
quotations.convert

invoices.view
invoices.create
invoices.update          (drafts only)
invoices.delete          (drafts only)
invoices.issue           (finalize + assign number)
invoices.cancel

credit_notes.view
credit_notes.create
credit_notes.cancel

payments.view
payments.create
payments.update
payments.cancel
payments.refund

expenses.view
expenses.create
expenses.update
expenses.delete

documents.view
documents.upload
documents.delete

reports.view
reports.export

data.import

users.view
users.create             (invite)
users.update
users.deactivate

roles.view
roles.manage             (create/update/delete roles, assign permissions)

settings.view
settings.update

audit_logs.view
```

## 5.1 Default Role Matrix

| Permission group | Super Admin | Admin | Finance | Staff |
|---|---|---|---|---|
| dashboard.view | ✅ | ✅ | ✅ | ✅ |
| clients.* | ✅ | ✅ | ✅ | view |
| vendors.* | ✅ | ✅ | ✅ | — |
| quotations.* | ✅ | ✅ | ✅ | view, create |
| invoices.* | ✅ | ✅ | ✅ | — |
| credit_notes.* | ✅ | ✅ | ✅ | — |
| payments.* | ✅ | ✅ | ✅ | — |
| expenses.* | ✅ | ✅ | ✅ | — |
| documents.* | ✅ | ✅ | ✅ | — |
| reports.* | ✅ | ✅ | ✅ | — |
| data.import | ✅ | ✅ | — | — |
| users.* | ✅ | ✅ (non-Super-Admin only) | — | — |
| roles.view | ✅ | ✅ | — | — |
| roles.manage | ✅ | — | — | — |
| settings.view | ✅ | ✅ | ✅ | — |
| settings.update | ✅ | — | — | — |
| audit_logs.view | ✅ | — | — | — |

Permissions are stored as data (seeded), so this matrix can be changed without code changes. Only the Super Admin protections in §32 are hard rules.

---

# 6. Authentication

Authentication uses **Supabase Auth**.

- **Public sign-up is disabled.** Accounts are created by invitation only (`users.create`).
- Email/password
- Google OAuth (optional for V1; only for already-invited emails)
- Password reset
- Email verification (via the invitation link)
- Logout
- Session management
- Deactivated users (`profiles.is_active = false`) are denied access by both the app and RLS, even with a valid session.

Each authenticated user has a corresponding `profiles` record holding name, role, organization and active flag.

**Email delivery:** Supabase's built-in email service is heavily rate-limited and meant for development only. Production must use a custom SMTP provider with a free tier (e.g. Resend, Brevo) for invites and password resets.

---

# 7. Finance Module

Finance is the core module of V1.

```text
Finance
│
├── Overview
├── Quotations
├── Invoices
├── Credit Notes
├── Payments
├── Expenses
└── Reports
```

---

# 8. Global Conventions

These rules apply to every module.

| Topic | Rule |
|---|---|
| Currency | INR only in V1. Display as `₹1,25,000.00` (Indian digit grouping). |
| Money storage | PostgreSQL `numeric(14,2)`. Never floating point, in the database or in JavaScript calculations (use integer paise or a decimal library). |
| Rounding | Half-up to 2 decimals at each line's tax amount and each document total (§9.3). |
| Timezone | All business dates are in **IST (Asia/Kolkata)**. Timestamps stored as `timestamptz`. "Today" for overdue/expiry checks means today in IST. |
| Date display | `DD-MM-YYYY`. |
| Financial year | April 1 – March 31. Used for numbering and the default report period. Displayed as `2026-27`. |
| Deletion | Master data (clients, vendors, categories) is soft-deleted (`deleted_at`). Issued financial documents are **never deleted**; they are cancelled. Only drafts can be hard-deleted. |
| Common columns | Every business table has `id (uuid)`, `organization_id`, `created_by`, `created_at`, `updated_at`. |
| Single source of calculation | All money calculations live in one shared module with unit tests. Stored totals are recomputed and verified by the database on save (§32). |

---

# 9. Financial Definitions & Calculations

## 9.1 Accounting Basis

V1 uses **cash basis** for revenue. A quotation is **not** revenue. An issued invoice is a receivable, not revenue. **Revenue is recognised only when a payment is confirmed.**

All revenue figures are **gross (including GST collected)**. GST collected on issued invoices is shown separately in reports (§27).

## 9.2 Definitions

| Metric | Formula |
|---|---|
| **Revenue** (period) | Σ settled value of confirmed receipts (amount received + TDS deducted by the client) − Σ confirmed refunds, by payment date |
| **Expenses** (period) | Σ expenses, by expense date |
| **Net Cash Position** (period) | Revenue − Expenses |
| **Total Invoiced** (period) | Σ totals of issued, non-cancelled invoices − Σ issued credit notes, by document date |
| **Invoice Balance** | Invoice total − Σ issued credit notes against it − Σ confirmed payment allocations to it (allocations settle with cash and TDS) |
| **Outstanding** (as of date) | Σ balances of all issued, non-cancelled invoices |
| **Client Credit** | Σ settled value of confirmed receipts − Σ their allocations − Σ confirmed refunds for that client (money received but not yet applied to an invoice) |
| **TDS Receivable** (period) | Σ TDS deducted on confirmed receipts, by payment date (claimed against Form 26AS) |
| **Pending Invoices** | Count of issued invoices with balance > 0 and not overdue |
| **Overdue Invoices** | Count of issued invoices with balance > 0 and due date before today (IST) |

The dashboard has one KPI per definition above. There is no separate "Net Revenue" or "Amount Received"; Revenue is the amount received.

**TDS (v1.2):** business clients often deduct income-tax TDS (e.g. 10% under §194J for professional/technical services) and pay the rest. The TDS is our income, paid to the government on our behalf, so it counts toward Revenue and settles the invoice, but it never reaches the bank; it is reported separately as TDS Receivable. Clients compute TDS on the value **excluding GST** when GST is shown separately (CBDT Circular 23/2017).

## 9.3 Line & Document Calculation Order

For quotations, invoices and credit notes:

```text
1. Line gross        = quantity × unit price
2. Line discount     = fixed amount or % of line gross
3. Line net          = line gross − line discount
4. Document discount = fixed amount or % of Σ line net,
                       allocated to lines pro-rata by line net
5. Line taxable      = line net − allocated document discount
6. Line tax          = line taxable × tax rate   (rounded half-up, 2 dp)
                       split into CGST + SGST (intra-state) or IGST (inter-state)
7. Subtotal          = Σ line net
8. Total discount    = document discount
9. Taxable value     = Σ line taxable
10. Total tax        = Σ line tax
11. Grand total      = taxable value + total tax
12. Round-off        = optional rounding of grand total to nearest ₹1,
                       shown as a separate "Round off" line
```

Tax is always calculated **after** discounts, as GST requires tax on the discounted transaction value.

If the company is not GST-registered, steps 6 and 10 are zero and tax fields are hidden.

## 9.4 Validation Rules

- Quantity > 0, unit price ≥ 0, discounts cannot exceed the amount they apply to.
- Grand total cannot be negative.
- A payment allocation cannot exceed the invoice's balance.
- Credit notes against an invoice cannot exceed the invoice total minus earlier credit notes.

---

# 10. Finance Dashboard

KPIs (definitions in §9.2), filterable by period (default: current financial year):

- Revenue
- Expenses
- Net Cash Position
- Total Invoiced
- Outstanding
- Client Credit (unapplied advances)
- Pending Invoices (count + amount)
- Overdue Invoices (count + amount)

Example:

```text
Revenue              ₹1,25,000
Expenses             ₹32,500
Net Cash Position    ₹92,500
Outstanding          ₹45,000
```

Financial KPIs are only visible to users with `reports.view`. Users with only `dashboard.view` see a non-financial dashboard (e.g. their recent quotations).

---

# 11. Quotations

Users with appropriate permissions can create quotations.

## Quotation Fields

```text
Quotation Number           (assigned when sent, §30)
Revision                   (1, 2, 3 …)
Quotation Date
Valid Until

Client
Client Contact             (from client contacts)
Place of Supply            (state; defaults from client)

Title
Description

Line Items
    Description
    SAC Code               (if GST-registered)
    Quantity
    Unit Price
    Discount (amount or %)
    Tax Rate               (if GST-registered)
    Taxable Amount
    Tax Amount
    Line Total

Subtotal
Document Discount
Taxable Value
CGST / SGST / IGST
Round Off
Grand Total

Amount Invoiced            (Σ non-cancelled invoices created from it)
Amount Remaining to Invoice

Terms & Conditions
Notes

Created By
Created At
Updated At
```

---

# 12. Quotation Status

```text
Draft
  ↓
Sent
  ↓
Accepted
  ↓
Partially Invoiced   (some of the total invoiced)
  ↓
Invoiced             (fully invoiced)
```

Alternative states:

```text
Rejected
Expired     (derived: Sent and Valid Until < today; not stored)
Cancelled
Superseded  (an older revision replaced by a newer one)
```

- Only **Draft** quotations can be edited or deleted.
- **Expired** is computed on read, so no scheduled job is needed. An expired quotation can be accepted only after extending its validity (logged).

---

# 13. Quotation Actions

Users with permissions can:

- Create quotation
- Edit quotation (Draft only)
- Delete quotation (Draft only)
- Preview quotation
- Generate / download PDF
- **Send** — one step: assigns the quotation number, locks the content and downloads the PDF to share manually (WhatsApp, email). Same as "Mark as Sent" in Zoho for documents shared outside the app; automated email is V5. *Preview PDF* on a draft prints "DRAFT".
- **Revise** — creates a new Draft revision of a Sent quotation with the same number and `Revision + 1`. The previous revision becomes *Superseded*. PDFs show `QTN/26-27/0001 (Rev 2)`.
- Mark as Accepted
- Mark as Rejected
- Cancel
- Duplicate quotation (new draft, new number when sent)
- Convert to invoice (full or partial, §14)

---

# 14. Quotation → Invoice

An accepted quotation can be converted into **one or more invoices**, supporting advance and milestone billing.

Conversion modes:

| Mode | Behaviour |
|---|---|
| **Full** | All line items copied at 100%. |
| **Percentage** | One line per quotation line (or one summary line) at X% of the quoted value, e.g. "50% advance — SIPLINK Website". |
| **Selected items** | Pick specific line items / quantities to bill. |

Example (50% advance + 50% on delivery):

```text
QTN/26-27/0001   SIPLINK Website   ₹33,000   ACCEPTED
       │
       ├── INV/26-27/0001   50% Advance    ₹16,500
       └── INV/26-27/0004   50% Delivery   ₹16,500
                                            ───────
       Quotation status: Invoiced          ₹33,000
```

When converting:

- Client, contact and place of supply are copied.
- Line items, pricing and tax rates are copied (scaled by the chosen mode).
- Terms can be modified before issuing.
- The invoice references the original quotation.
- By default, Σ invoiced cannot exceed the quotation's grand total. Exceeding it requires an explicit override with a reason (logged).

---

# 15. Invoices

## Invoice Fields

```text
Invoice Number             (assigned on issue, §30)
Invoice Date
Due Date                   (optional, off by default; when switched on: invoice date + client payment terms)

Client
Client Contact
Billing Name & Address     (snapshot at issue time)
Client GSTIN               (snapshot, if any)
Place of Supply            (state)
Supply Type                Intra-state | Inter-state | Export (LUT)

Quotation Reference        (optional)

Line Items
    Description
    SAC Code
    Quantity
    Unit Price
    Discount
    Tax Rate
    Taxable Amount
    CGST / SGST / IGST
    Line Total

Subtotal
Document Discount
Taxable Value
CGST / SGST / IGST totals
Round Off
Grand Total
Amount in Words

Credit Notes Applied
Amount Paid                (Σ confirmed allocations)
Balance Due

Status

Bank Details / UPI QR      (from company settings)
Terms
Notes

Created By
Created At
Updated At
Issued At / Issued By
```

## GST Requirements (when the company is GST-registered)

- Supplier name, address and GSTIN; client name, address and GSTIN (if registered).
- Unique, consecutive number per financial year, max 16 characters (§30).
- SAC code per line (e.g. 998314 for IT design and development services). The default SAC comes from company settings.
- Tax rates come from a configurable `tax_rates` table, not hard-coded, because GST rates change.
- Intra-state supply (place of supply = company state): CGST + SGST, each half the rate.
- Inter-state supply: IGST at the full rate.
- Export of services under LUT: 0% IGST, with the LUT reference printed on the invoice.
- Document title: **"Tax Invoice"** when GST-registered, **"Invoice"** otherwise.

Billing details are **snapshotted** when an invoice is issued, so later changes to the client record do not alter issued invoices.

---

# 16. Invoice Status

```text
Draft
Issued           (sent to client, no payment yet)
Partially Paid
Paid
Overdue          (derived: balance > 0 and due date < today; not stored; never without a due date)
Cancelled
```

Status is derived from balances: once issued, the status follows the payment allocations and credit notes automatically.

Example:

```text
Invoice Total:       ₹33,000
Amount Paid:         ₹10,000
Balance Due:         ₹23,000

Status: Partially Paid
```

**Locking rules:**

- Only **Draft** invoices can be edited or deleted.
- An issued invoice's content is immutable. Corrections are made by a **Credit Note** (§18), or by cancelling and re-issuing.
- An invoice with confirmed payments cannot be cancelled until its allocations are removed or moved to another invoice.
- Cancelled invoices keep their number (no gaps) and remain visible.

---

# 17. Invoice Actions

- Create
- Edit (Draft only)
- Delete (Draft only)
- Preview
- Generate / download PDF
- **Issue** — assigns the invoice number, snapshots billing details, locks content. In V1, "Send" means *issue + download the PDF to share manually*.
- Record payment / allocate client credit
- Issue credit note
- Cancel
- Duplicate
- View payment and credit-note history

---

# 18. Credit Notes

Credit notes reduce the amount owed on an issued invoice (price correction, discount after the fact, cancelled scope).

## Credit Note Fields

```text
Credit Note Number    (CN/26-27/0001, assigned on issue)
Date
Client
Original Invoice      (required)
Reason
Line Items            (same structure as invoices, incl. tax reversal)
Totals
Status                Draft | Issued | Cancelled
Created By / At
```

- Σ credit notes on an invoice cannot exceed its grand total.
- Issued credit notes reduce the invoice balance and Total Invoiced (§9.2).
- If the client already paid more than the new balance, the excess becomes Client Credit, which can be applied to another invoice or refunded. In practice the overpaid part of the invoice's payments is released (latest payments first) back to client credit when the credit note is issued.
- **Tax follows the original invoice (v1.3):** the credit note copies the invoice's place of supply, supply type and GST applicability, and reverses tax at those rates (CGST + SGST or IGST). It never re-derives them from the client's current details.
- **GST time limit (v1.3):** for a GST invoice, the credit note must be issued no later than **30 November following the end of the financial year** of the invoice (Section 34(2) CGST Act; the annual-return date if earlier). After that, tax cannot be reduced, so the app refuses to issue it.
- **Contents (v1.3, CGST Rule 53(1A)):** "Credit Note" title; number ≤ 16 characters, unique per financial year; date; supplier and recipient name, address and GSTIN; the original invoice number **and date**; taxable value, tax rate and tax amount; signature. The recipient details are copied from the invoice's billing snapshot.
- **Dates:** the credit note date cannot be before the invoice date.
- **Cancelling:** an issued credit note can be cancelled (the invoice balance goes back up); an invoice with issued credit notes cannot be cancelled until they are.
- One credit note references one invoice in V1. (GST allows one credit note for several invoices since 01-01-2021; add if needed.)

Sources: Section 34 CGST Act; CGST Rule 53(1A); Tally and TaxGuru guides on GST credit notes; Zoho Books (credit notes applied to invoices or refunded).

---

# 19. Payments

Payments represent **money received from clients**. Money paid by DevSyndicate is recorded only in **Expenses** (§21).

## Payment Fields

```text
Receipt Number        (TXN/26-27/0001, assigned on confirm)
Kind                  Receipt | Refund
Date
Amount Received       (money that reached us: cash / bank / UPI)
TDS Deducted          (receipts only, optional: income tax the client withheld)
Settled Value         (= Amount Received + TDS Deducted; what allocations draw from)

Client

Allocations           (one or more)
    Invoice
    Amount

Unallocated Amount    (= settled value − Σ allocations; becomes Client Credit)

Payment Method
    UPI
    Bank Transfer
    Cash
    Credit Card
    Debit Card
    Cheque
    Other

Reference / UTR Number

Payment Proof         (documents, §20)

Status                Pending | Confirmed | Cancelled
Cancel Reason         (required when cancelling)

Notes

Created By
Created At
Updated At
```

## Payment Rules

- **Only Confirmed payments** count toward revenue, invoice balances and client credit. *Pending* is for "client says they paid; not yet verified".
- **Multiple payments per invoice** are supported.
- **One payment across multiple invoices** is supported through allocations.
- **Advance payments** are payments with no allocation. They appear as Client Credit and can be allocated when an invoice is issued.
- **Overpayment:** an allocation cannot exceed the invoice balance. Any excess stays unallocated as Client Credit.
- **Refunds** are `Kind = Refund`, limited to the client's available credit, and reduce revenue in the period they are made.
- Confirmed payments are not edited. A correction is made by cancelling and re-entering, with a reason (logged). Allocations of a confirmed receipt can still be applied to or removed from invoices (moving credit), and each change is logged.
- **TDS:** a receipt can record TDS deducted by the client. Allocations draw from amount received + TDS, so an invoice settled partly by TDS reaches *Paid*.
- **Cancelling:** a confirmed receipt cannot be cancelled while its credit has been refunded (client credit would go negative). An invoice with confirmed allocations cannot be cancelled until those allocations are removed (§16).
- **GST on advances (when GST-registered):** an advance for services is taxable when received. The confirmed receipt of an unallocated advance prints as a **Receipt Voucher** (CGST Rule 50: supplier and recipient details and GSTIN, serial number ≤ 16 characters, date, description, amount, tax rate and tax amount, place of supply, signature). Tax is computed inside the advance (amount × rate ÷ (100 + rate)) at 18% when the rate is not yet known, and treated as inter-state when the place of supply is not known. A refund of such an advance prints as a **Refund Voucher** (Rule 51). The GST paid on the advance is adjusted when the final tax invoice is issued (GSTR-1 tables 11A/11B).
- Permissions: `payments.create` records pending receipts, `payments.update` confirms and applies/removes allocations, `payments.cancel` cancels, `payments.refund` records refunds.

Example:

```text
Invoice INV/26-27/0001        ₹33,000

Payment TXN/26-27/0001        ₹10,000   → allocated ₹10,000
Payment TXN/26-27/0005        ₹25,000   → allocated ₹23,000
                                           unallocated ₹2,000 (Client Credit)

Invoice balance               ₹0        Status: Paid
```

Example with TDS (v1.2):

```text
Invoice INV/26-27/0002        ₹29,000   (no GST)

Payment TXN/26-27/0006        received ₹26,100 + TDS ₹2,900 → allocated ₹29,000

Invoice balance               ₹0        Status: Paid
Revenue                       ₹29,000   (bank ₹26,100, TDS receivable ₹2,900)
```

Example with an advance (v1.2):

```text
Payment TXN/26-27/0007        ₹10,000   no allocation → Client Credit ₹10,000
Invoice INV/26-27/0003        ₹29,000   issued for the full quotation
Apply credit                  ₹10,000   → invoice shows "Less: paid ₹10,000, Balance due ₹19,000"
```

Sources: CBDT Circular 23/2017 (TDS excludes GST); CGST Rules 50 and 51 (receipt and refund vouchers); Zoho Books India (TDS withheld on record payment; retainers applied to invoices).

---

# 20. Payment Proof

Every payment (and every expense) can optionally have one or more supporting documents.

Supported files: **JPG, PNG, WEBP, PDF**, max **5 MB** per file. Files upload straight from the browser to Storage (server actions cap request bodies at 1 MB); the server then checks the file signature before recording it.

Examples:

- UPI screenshot
- Bank receipt
- Transaction receipt
- Payment confirmation
- Expense receipt

Files are stored in **Supabase Storage** (private bucket, §26). The database stores the file path and metadata, not the file itself.

---

# 21. Expenses

Expenses represent **all money spent by DevSyndicate**. In V1 an expense is recorded when it is paid.

Examples: hosting, domains, software subscriptions, marketing, equipment, office expenses, travel, salaries, professional services, taxes paid, and other business expenses.

## Expense Fields

```text
Expense Number        (EXP/26-27/0001)
Date
Category
Description

Vendor                (from vendors; optional)
Amount
GST Paid              (optional, informational for V1)

Payment Method
Reference / UTR Number

Receipt / Proof       (documents)
Notes

Created By
Created At
Updated At
```

---

# 22. Expense Categories

Categories are stored in an `expense_categories` table, seeded with:

```text
Hosting
Domain
Software
Marketing
Equipment
Office
Travel
Salary
Professional Services
Taxes
Other
```

Users with `settings.update` can add, rename or archive categories. Archived categories remain on existing expenses.

---

# 23. Vendors

The vendors module stores suppliers DevSyndicate pays.

## Vendor Fields

```text
Vendor ID
Name
Contact Person
Email
Phone
Address
GSTIN
Default Expense Category
Notes
Created At
Updated At
```

The vendor profile shows the list of expenses and the total spent (filterable by period).

---

# 24. Clients

The client module stores customer information.

## Client Fields

```text
Client ID
Company Name
Billing Address
City
State                 (drives place of supply)
Country
PIN Code
GSTIN                 (optional)
Default Payment Terms (days, e.g. 15)
Notes

Contacts (one or more)
    Name
    Designation
    Email
    Phone
    Is Primary

Created At
Updated At
```

Client profile shows:

```text
Client
 ↓
Quotations
 ↓
Invoices & Credit Notes
 ↓
Payments
 ↓
Outstanding Balance & Client Credit
```

---

# 25. Client Financial Summary

Each client has:

```text
Total Quoted         (Σ accepted/invoiced quotations, latest revision)
Total Invoiced       (§9.2)
Total Received       (§9.2)
Outstanding          (§9.2)
Client Credit        (§9.2)
```

Example:

```text
SIPLINK

Quoted:          ₹50,000
Invoiced:        ₹33,000
Received:        ₹10,000
Outstanding:     ₹23,000
Client Credit:   ₹0
```

---

# 26. Documents

Documents are associated with business records.

Examples:

- Quotation PDFs
- Invoice PDFs
- Credit note PDFs
- Payment proofs
- Expense receipts
- Contracts
- Agreements

## Storage

- **Supabase Storage**, single **private** bucket `documents`.
- Path structure:

```text
documents/
└── {organization_id}/
    ├── quotations/{fy}/{record_id}/
    ├── invoices/{fy}/{record_id}/
    ├── credit-notes/{fy}/{record_id}/
    ├── payment-proofs/{fy}/{record_id}/
    ├── expenses/{fy}/{record_id}/
    └── contracts/{client_id}/
```

## Rules

- No public URLs. Files are served via **signed URLs** valid for a few minutes, generated only for users with permission to view the parent record.
- Storage RLS policies on `storage.objects` mirror the parent record's permissions (§32).
- Allowed types: JPG, PNG, WEBP, PDF. Max 5 MB. File type is validated on the server, not only by file extension.
- Generated PDFs for issued documents are stored once at issue time, so the PDF always matches the locked document.
- Deleting a document requires `documents.delete`, is soft-delete in the database, and is logged.

---

# 27. Reports

V1 reports (default period: current financial year):

### Revenue Report

```text
Month | Receipts | Refunds | Revenue
```

### Expense Report

```text
Month | Category | Expenses
```

### Profit (Cash) Report

```text
Revenue
- Expenses
= Net Cash Position
```

### Outstanding (Receivables Ageing) Report

```text
Client | Invoice | Invoice Date | Due Date | Total | Credited | Paid | Balance | Days Overdue | Status
```

Grouped by ageing buckets: Not due, 1–30, 31–60, 61–90, 90+ days.

### Tax Summary Report (if GST-registered)

```text
Month | Taxable Value | CGST | SGST | IGST | Total Tax
```

Based on issued invoices minus credit notes. For reference only; filing is out of scope.

Reports support:

- Date range filtering (with financial-year presets)
- Client filtering
- Status filtering
- Category filtering (expenses)
- CSV export (`reports.export`)

---

# 28. Audit Logs

Important actions are recorded in an **append-only** audit log.

## Implementation

- **Database triggers** on all business tables write a row for every INSERT, UPDATE and DELETE, so changes cannot bypass the log, even ones made outside the app.
- **Application events** that are not row changes (PDF generated, document downloaded, login) are written through a single database function.
- No user, including Super Admin, can update or delete audit log rows (no RLS policies for UPDATE or DELETE; inserts only via the trigger or function).

## Audit Log Fields

```text
Timestamp
Actor (user)
Action            (e.g. invoice.issued, payment.cancelled, role.permissions_changed)
Table / Record    (e.g. invoices / INV/26-27/0001)
Before            (JSON, for updates/deletes)
After             (JSON, for inserts/updates)
Reason            (where the action requires one)
```

Example:

```text
User:      Mohammed
Action:    invoice.issued
Record:    INV/26-27/0001
Timestamp: 06-10-2026 14:30 IST
```

Actions that must appear (at minimum):

- User invited, updated, deactivated
- Role created/changed, permissions changed, role assigned
- Company settings changed
- Client / vendor created, updated, deleted
- Quotation created, edited, status changed, revised, validity extended
- Invoice created, edited, issued, cancelled, quotation-total override
- Credit note issued / cancelled
- Payment created, confirmed, allocated, cancelled, refunded
- Expense created, updated, deleted
- Document uploaded, deleted
- Data import performed

---

# 29. Company Settings

Editable only with `settings.update`.

```text
Company Details
    Legal Name
    Trade Name
    Logo
    Address, City, State, PIN, Country
    Email, Phone, Website

Tax
    GST Registered        (yes/no — toggles all GST behaviour)
    GSTIN
    Default SAC Code
    Default Tax Rate
    LUT Number & Validity (for export invoices)

Banking (printed on invoices)
    Bank Name, Account Name, Account Number, IFSC
    UPI ID / UPI QR code

Documents
    Number Prefixes       (QTN, INV, CN, TXN, EXP)
    Default Quotation Validity (days)
    Default Payment Terms (days)
    Default Quotation Terms & Conditions
    Default Invoice Terms
    Round Off Totals      (yes/no)
    Authorised Signatory Name / Signature image
```

---

# 30. Document Numbering

Numbers are generated automatically, are unique per organization, and restart each financial year.

| Document | Format | Example |
|---|---|---|
| Quotation | `QTN/{FY}/{seq}` | `QTN/26-27/0001` |
| Invoice | `INV/{FY}/{seq}` | `INV/26-27/0001` |
| Credit Note | `CN/{FY}/{seq}` | `CN/26-27/0001` |
| Payment Receipt | `TXN/{FY}/{seq}` | `TXN/26-27/0001` |
| Expense | `EXP/{FY}/{seq}` | `EXP/26-27/0001` |

Rules:

- `{FY}` is the financial year of the document date (`26-27` = April 2026 – March 2027). `{seq}` is zero-padded to 4 digits and grows beyond 9999 if needed.
- Invoice and credit note numbers stay **within 16 characters** (GST requirement). When GST-registered, receipt numbers do too, because advances print as receipt vouchers (Rule 50).
- **Numbers are assigned on issue, not on draft creation.** Drafts display `DRAFT` and a short ID. Deleting a draft therefore never leaves a gap.
- **Gapless and duplicate-free:** numbers come from a `document_sequences` counter table, incremented with a row lock (`SELECT … FOR UPDATE`) inside the same transaction that issues the document. PostgreSQL sequences are **not** used because they skip values on rollback.
- A unique constraint on `(organization_id, document_type, number)` is the final safeguard.
- Imported historical documents keep their original numbers and do not consume the sequence (§39).

---

# 31. Database Architecture

Database: **Supabase PostgreSQL**

## Tables

```text
organizations             (one row in V1)
profiles                  (1:1 with auth.users; role_id, is_active)
roles
permissions
role_permissions

company_settings
document_sequences
tax_rates

clients
client_contacts
vendors
expense_categories

quotations
quotation_items

invoices
invoice_items

credit_notes
credit_note_items

payments
payment_allocations

expenses

documents                 (polymorphic: entity_type + entity_id)

audit_logs
```

Every business table includes `organization_id` (§8).

## Relationships

```text
organizations
   │
   ├── profiles ── roles ── role_permissions ── permissions
   │
   ├── clients
   │     ├── client_contacts
   │     ├── quotations
   │     │     ├── quotation_items
   │     │     └── (1 : many) invoices
   │     ├── invoices
   │     │     ├── invoice_items
   │     │     ├── credit_notes
   │     │     │     └── credit_note_items
   │     │     └── payment_allocations ──┐
   │     └── payments ───────────────────┘   (payment 1 : many allocations)
   │
   ├── vendors
   │     └── expenses ── expense_categories
   │
   ├── documents   → quotation | invoice | credit_note | payment | expense | client
   │
   └── audit_logs
```

Key points:

- `invoices.quotation_id` is nullable (invoices can be created directly).
- `payments` belong to a client; `payment_allocations` link payments to invoices (many-to-many with amounts).
- `expenses.vendor_id` is nullable.
- Derived values (balance, overdue, expired, client credit) are exposed via **database views**, not stored columns, so they can never go stale.

---

# 32. Security

Supabase Row Level Security (RLS) is **enabled on every table**. Security is enforced at the database level; frontend checks only hide UI.

## 32.1 Permission Checks in RLS

- A database function `has_permission(permission text) returns boolean` (`STABLE`, `SECURITY DEFINER`, fixed `search_path`) checks that the current user's profile is active, belongs to the row's organization, and has the permission through their role.
- Every table has explicit policies per operation, e.g. `SELECT` on invoices requires `has_permission('invoices.view')`.
- Optionally, the user's permissions can be added to the JWT via Supabase's *Custom Access Token* hook, to avoid lookups on every row. If you do this, permission changes take effect when the token next refreshes.

## 32.2 Multi-Step Operations

Operations that touch several tables (issue invoice, convert quotation, confirm payment + allocations, issue credit note) are implemented as **PostgreSQL functions called via RPC**, running in a single transaction. Each function checks the required permission itself and validates totals using the same rules as §9.

## 32.3 Service Role Key

- The service-role key **bypasses RLS completely**.
- It is used only in server-only code for: sending invitations, administrative jobs and backups.
- It must never be used to read or write business data in request handlers or server actions that act for a user. Those must use the user's session so RLS applies.
- It must never be exposed to the browser (no `NEXT_PUBLIC_` variable).

## 32.4 Hard Rules (database triggers)

- At least one active Super Admin must always exist.
- Only a Super Admin can modify, deactivate or assign the Super Admin role.
- Issued invoices, credit notes and confirmed payments cannot have their financial fields updated.
- Stored totals must equal the totals recomputed from line items.
- Audit logs cannot be updated or deleted.

## 32.5 Rules Summary

- Users can only access records of their organization and only with the matching permission.
- Finance users can access financial records.
- Staff cannot access restricted financial data.
- Deactivated users have no access.
- Storage files require a valid signed URL issued after a permission check.

---

# 33. Technology Stack

## Frontend

```text
Next.js (App Router)
TypeScript
Tailwind CSS
```

## Backend

Next.js Server Actions / Route Handlers, plus PostgreSQL functions (RPC) for multi-step financial operations.

## Database

```text
Supabase PostgreSQL
```

## Authentication

```text
Supabase Auth (invite-only) + custom SMTP provider
```

## File Storage

```text
Supabase Storage (private bucket, signed URLs)
```

## Deployment

```text
Vercel Free Tier — subject to the open question in §46
```

## Source Control & CI

```text
GitHub + GitHub Actions (lint, type-check, tests, nightly backup)
```

## PDF

```text
@react-pdf/renderer (or compatible)
```

Note: React-PDF's built-in fonts (Helvetica etc.) do not include the **₹** symbol. Embed a font that supports it (e.g. Noto Sans, Inter).

## Charts

```text
Recharts
```

## Money & Validation

```text
Decimal library (e.g. decimal.js) or integer paise for calculations
Zod for input validation (shared between client and server)
```

---

# 34. Free-Tier Requirement & Operations

The initial system targets **₹0 infrastructure cost**. No paid infrastructure is required for the MVP.

```text
Next.js          → Free
Vercel           → Free tier (see risk below)
Supabase         → Free tier
GitHub / Actions → Free
SMTP provider    → Free tier
Tailwind         → Free
Recharts         → Free
```

## Known Free-Tier Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **No automated backups** on the Supabase free tier. Financial data loss would be critical. | Nightly GitHub Actions job runs `pg_dump`, encrypts the dump, and stores it in a private location (e.g. Cloudflare R2 or Google Drive free tier). Do a restore drill before go-live. Storage files are backed up the same way. |
| **Supabase pauses free projects after a period of inactivity.** | Accept a manual restore on pause, or upgrade to a paid plan once the system is business-critical. Monitor via the backup job's success or failure. |
| **Vercel Hobby plan is limited to personal, non-commercial use.** An internal company tool may not qualify. | Check Vercel's current terms before production. Alternatives: Netlify, Cloudflare Pages / Workers, or a low-cost VPS. |
| **Built-in Supabase email is rate-limited.** | Custom SMTP provider (§6). |
| **Database size and storage limits** (approx. 500 MB DB, 1 GB storage at the time of writing). | Compress uploaded images client-side, enforce the 5 MB limit, monitor usage monthly. |
| **Scheduled job limits.** | Overdue and expiry statuses are computed in views, so no cron job is needed. |

Free-tier limits must be reviewed before production deployment because provider limits and pricing change.

---

# 35. Navigation

```text
Dashboard

Finance
    Overview
    Quotations
    Invoices
    Credit Notes
    Payments
    Expenses
    Reports

Clients

Vendors

Documents

Settings
    Company
    Tax Rates
    Expense Categories
    Users
    Roles & Permissions
    Data Import
    Audit Logs
```

Navigation items are hidden when the user lacks the matching `.view` permission. Route access is also checked on the server.

---

# 36. Dashboard UX

Top (KPIs, §10):

```text
Revenue | Expenses | Net Cash Position | Outstanding
```

Middle:

```text
Revenue vs Expenses (monthly, current FY)
```

Bottom:

```text
Recent Payments
Recent Invoices
Pending Payments (unconfirmed)
Overdue Invoices
```

---

# 37. Business Workflow

## New Client (milestone billing)

```text
Create Client (+ contacts)
      ↓
Create Quotation
      ↓
Mark as Sent → share PDF
      ↓
(Revise if client requests changes)
      ↓
Client Accepts
      ↓
Convert to Invoice (e.g. 50% advance) → Issue → share PDF
      ↓
Receive Payment → Upload Proof → Confirm → Allocate
      ↓
Invoice Paid
      ↓
Convert remaining 50% on delivery → Issue → Payment → Paid
      ↓
Quotation status: Invoiced
```

## Advance Received Before Invoice

```text
Record Payment (no allocation) → Client Credit
      ↓
Issue Invoice → Allocate Client Credit → Invoice Paid / Partially Paid
```

## Correcting an Issued Invoice

```text
Issue Credit Note against invoice
      ↓
Balance reduced (excess becomes Client Credit → allocate or refund)
```

---

# 38. Expense Workflow

```text
Create Expense
      ↓
Enter Amount & Date
      ↓
Select Category (and Vendor)
      ↓
Upload Receipt
      ↓
Save
      ↓
Expense included in Reports
```

---

# 39. Data Import

To move away from spreadsheets, V1 supports CSV import (`data.import`) for:

- Clients (with primary contact)
- Vendors
- Expenses
- **Historical invoices** (header-level: number, date, client, total, tax, due date), flagged `is_imported`
- **Historical payments** against imported invoices

Rules:

- Import shows a preview with row-level validation errors before anything is saved.
- Imported invoices keep their original numbers and do not affect the numbering sequence.
- Each import is logged and can be rolled back as a batch if nothing has been linked to its records yet.
- A downloadable CSV template is provided for each import type.

---

# 40. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Responsiveness | Usable from 375 px width (record a payment or expense from a phone). |
| Performance | List pages paginated (25 per page) with server-side search and filters; typical page load under 2 s. |
| Correctness | Unit tests for all calculation rules in §9 (discounts, tax splits, rounding, allocations, credit notes). |
| Security testing | Automated tests confirming each role can and cannot read and write each table under RLS. |
| Backups | Nightly backup succeeds; one successful restore drill before go-live. |
| Accessibility | Keyboard navigable forms, labelled inputs, sufficient colour contrast. |
| Browsers | Latest Chrome, Edge, Firefox, Safari. |
| Observability | Server errors logged; failed backup and RPC errors surfaced to the Super Admin. |

---

# 41. V1 Acceptance Criteria

The first release is considered successful when:

### Authentication

- Public sign-up is disabled; users join only by invitation.
- User can log in and log out; password reset works via custom SMTP.
- Each user has a role; deactivated users lose access immediately.
- Unauthorized users cannot access restricted resources (verified by RLS tests).

### Clients & Vendors

- Create, edit, view, archive clients (with multiple contacts) and vendors.
- View client financial summary, including client credit.

### Quotations

- Create quotation with multiple line items; totals follow §9.3.
- Number assigned on Mark as Sent, FY-based, gapless.
- Revise a sent quotation.
- Generate PDF (with ₹ rendered correctly).
- Change status; Expired derived automatically.
- Convert to invoice fully, by percentage, or by selected items, across multiple invoices.

### Invoices

- Create invoice with multiple items; totals follow §9.3.
- GST fields and CGST/SGST/IGST split correct when GST-registered.
- Number assigned on issue, FY-based, gapless, ≤ 16 characters.
- Issued invoices are locked.
- Generate PDF; track due date; Overdue derived automatically.
- Payment status updates automatically from allocations and credit notes.

### Credit Notes

- Issue a credit note against an invoice; balance and reports update.

### Payments

- Record a payment as Pending, then Confirm it.
- Multiple payments per invoice; one payment across multiple invoices.
- Advance payments appear as Client Credit and can be allocated later.
- Over-allocation is prevented; refunds supported.
- Upload payment proof.

### Expenses

- Record expense with category and optional vendor.
- Upload receipt.
- Expense appears in reports.

### Dashboard & Reports

- Revenue, Expenses, Net Cash Position, Outstanding and Client Credit match the definitions in §9.2.
- Recent payments and invoices displayed.
- Revenue, Expense, Profit, Outstanding (ageing) and Tax Summary reports with filters and CSV export.

### Data Import

- Import clients, vendors, expenses, historical invoices and payments from CSV with preview and validation.

### Security & Operations

- RLS enabled on all tables, with automated role tests passing.
- Service-role key used only in server-only administrative code.
- All actions in §28 logged by triggers; audit logs are immutable.
- Nightly backups running; restore drill completed.

---

# 42. Future Roadmap

## V1

**Finance Foundation**

```text
Auth (invite-only)
RBAC
Clients & Vendors
Quotations
Invoices & Credit Notes
Payments & Allocations
Expenses
Documents
Dashboard & Reports
Audit Logs
Data Import
```

## V2

**CRM**

```text
Leads
Lead Pipeline
Follow-ups
Contacts
Sales Activities
```

## V3

**Project Management**

```text
Projects
Tasks
Assignments
Deadlines
Project Status
```

## V4

**Team Management**

```text
Employees
Attendance
Leave
Workload
Internal Announcements
```

## V5

**Automation**

```text
Email sending of quotations/invoices
Invoice reminders
Payment reminders
Email notifications
WhatsApp integration
Automated reports
Recurring invoices & expenses
```

## V6

**SaaS**

Potentially transform the internal ERP into a product for:

```text
Small software agencies
Freelancers
Digital agencies
IT service companies
Consultancies
Small businesses
```

Because V1 already includes `organization_id`, the SaaS step is mainly onboarding, billing and tenant administration, not a data-model rewrite.

---

# 43. Product Principle

DevSyndicate ERP should follow:

> **Simple first. Reliable always.**

The system should avoid unnecessary complexity.

Every feature should answer at least one question:

- Does it save time?
- Does it reduce mistakes?
- Does it improve visibility?
- Does it make the business easier to operate?

If not, it should not be added merely because other ERP products have it.

---

# 44. V1 Development Priority

```text
Phase A — Foundation
 1. Project setup (repo, Next.js, TypeScript, lint, CI)
 2. Supabase setup + global conventions (§8): organizations, common columns, money types
 3. Authentication (invite-only, custom SMTP)
 4. Profiles + Roles + Permissions (seeded matrix, §5.1)
 5. RLS: has_permission(), policies, Super Admin protections, RLS tests
 6. Audit triggers (§28)
 7. Backup pipeline + restore drill

Phase B — Configuration
 8. Company settings, tax rates, expense categories
 9. Document numbering function (§30)
10. Shared calculation module + unit tests (§9)

Phase C — Finance
11. Clients, contacts, vendors
12. Quotations (incl. revisions, PDF)
13. Invoices (issue, lock, PDF, partial conversion)
14. Payments + allocations + proof storage
15. Credit notes
16. Expenses

Phase D — Insight & Migration
17. Dashboard
18. Reports + CSV export
19. CSV import
20. Audit log viewer

Phase E — Launch
21. Production deployment (hosting decision §46, free-tier review §34, security review)
```

---

# 45. Final V1 Architecture

```text
                       DEV SYNDICATE ERP
                              │
                    Next.js + TypeScript
              (Server Actions / Route Handlers)
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
    Supabase Auth      PostgreSQL + RLS     Supabase Storage
    (invite-only)             │              (private, signed URLs)
          │                   │                    │
      Profiles         ┌──────┴───────┐            │
   Roles/Permissions   │              │            │
                    Finance      Clients/Vendors   │
                       │                           │
     ┌─────────┬───────┼──────────┬─────────┐      │
 Quotations Invoices Credit    Payments  Expenses  │
                     Notes   + Allocations         │
                       │                           │
          Views (balances, overdue, KPIs)          │
                       │                           │
             Audit Logs (triggers)                 │
                                                   │
                               Quotation / Invoice / CN PDFs
                               Payment Proofs, Receipts, Contracts

   GitHub Actions ── CI tests ── nightly encrypted backups
```

**The first milestone is therefore not "build an ERP." It is:**

> **Build a secure Finance ERP foundation where a client can move from Quotation → Invoice(s) → Payment → Proof, while the company can track Expenses and its financial position, with every number traceable and every change audited.**

That gives DevSyndicate a genuinely usable internal system from V1, while keeping the architecture ready for the rest of the ERP.

---

# 46. Open Questions (owner decision required)

| # | Question | Default assumed in this PRD |
|---|---|---|
| 1 | Is DevSyndicate GST-registered? | GST support is built in and switched on or off via company settings. |
| 2 | Hosting: does Vercel Hobby's non-commercial clause apply to this internal tool? | Vercel for development; confirm before production or choose an alternative. |
| 3 | Confirm the number format `INV/26-27/0001` (vs. an alternative prefix style). | As specified in §30. |
| 4 | How much historical data needs importing, and from which spreadsheets? | Import supports the entities in §39. |
| 5 | Is one role per user sufficient for V1? | Yes; multiple roles per user later if needed. |
| 6 | Who may override "invoiced total exceeds quotation total"? | Anyone with `quotations.convert`, with a mandatory reason (logged). |
| 7 | Where should encrypted backups be stored? | A free-tier object storage bucket owned by the company. |

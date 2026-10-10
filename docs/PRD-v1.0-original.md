# DevSyndicate ERP

**Product Requirements Document (PRD)**  
**Version:** 1.0  
**Status:** Initial Development  
**Product:** DevSyndicate ERP  
**Primary Module:** Finance  
**Target:** Internal DevSyndicate Operations  
**Infrastructure Goal:** ₹0/month using free tiers initially

---

# 1. Product Overview

DevSyndicate ERP is an internal business management platform designed to manage the company's financial and operational activities from a single application.

The first version will focus primarily on **Finance**, while establishing the architecture required to expand into CRM, Projects, Team Management, and other ERP modules later.

The system will manage:

- Users
- Roles and permissions
- Clients
- Quotations
- Invoices
- Payments
- Expenses
- Payment proofs
- Financial reports
- Documents
- Audit logs

The system must be designed so additional modules can be added without restructuring the entire application.

---

# 2. Product Goals

## Primary Goals

1. Centralize DevSyndicate's financial records.
2. Create and manage professional quotations.
3. Convert accepted quotations into invoices.
4. Track invoice payments.
5. Store payment proof documents.
6. Track company expenses.
7. Calculate revenue, expenses, outstanding payments, and net cash position.
8. Provide role-based access control.
9. Maintain an audit trail for important actions.
10. Keep the initial infrastructure cost at ₹0 using available free tiers.

## Secondary Goals

1. Reduce dependency on spreadsheets.
2. Make financial information easier to search.
3. Make payment records auditable.
4. Provide a foundation for a complete ERP.
5. Make the system reusable if DevSyndicate later offers it as a SaaS product.

---

# 3. Non-Goals for V1

The following will NOT be part of the first release:

- Full accounting software
- GST filing
- Payroll
- Banking integration
- Automatic bank reconciliation
- Inventory management
- Attendance management
- Advanced CRM
- Project management
- WhatsApp automation
- AI financial analysis
- Multi-company accounting

These may be introduced in future versions.

---

# 4. Target Users

## 4.1 Super Admin

Usually the company owner/founder.

Can:

- Access everything
- Manage users
- Create/edit roles
- Manage permissions
- View financial information
- Create quotations
- Create invoices
- Record payments
- Record expenses
- View reports
- Access audit logs
- Manage company settings

---

## 4.2 Admin

Can manage most business operations.

Access:

- Dashboard
- Clients
- Quotations
- Invoices
- Payments
- Expenses
- Documents

Cannot:

- Delete Super Admin
- Modify critical system permissions
- Change Super Admin access

---

## 4.3 Finance

Responsible for financial operations.

Can:

- View financial dashboard
- Create quotations
- Create invoices
- Record payments
- Record expenses
- Upload payment proofs
- View financial reports
- Manage clients

Cannot:

- Manage users
- Modify roles
- Modify system permissions

---

## 4.4 Staff

Limited access.

Permissions should be configurable rather than hard-coded.

Example:

```text
clients.read
quotations.read
quotations.create
projects.read
```

A staff member should only see modules and actions they have permission to access.

---

# 5. Permission System

The application must use **permission-based authorization** rather than simply checking role names.

Example permissions:

```text
dashboard.view

clients.view
clients.create
clients.update
clients.delete

quotations.view
quotations.create
quotations.update
quotations.delete
quotations.send
quotations.convert

invoices.view
invoices.create
invoices.update
invoices.delete
invoices.send

payments.view
payments.create
payments.update
payments.delete

expenses.view
expenses.create
expenses.update
expenses.delete

documents.view
documents.upload
documents.delete

reports.view

users.view
users.create
users.update
users.delete

roles.view
roles.create
roles.update
roles.delete

audit_logs.view
```

---

# 6. Authentication

Authentication will use **Supabase Auth**.

Supported authentication:

- Email/password
- Google OAuth (optional for V1)
- Password reset
- Email verification
- Logout
- Session management

Each authenticated user will have a corresponding profile record.

---

# 7. Finance Module

Finance is the core module of V1.

```text
Finance
│
├── Overview
├── Quotations
├── Invoices
├── Payments
├── Expenses
└── Reports
```

---

# 8. Finance Dashboard

The dashboard should display:

### Financial KPIs

- Total Revenue
- Total Expenses
- Net Revenue
- Total Invoiced
- Amount Received
- Outstanding Amount
- Pending Invoices
- Overdue Invoices

Example:

```text
Total Revenue
₹1,25,000

Total Expenses
₹32,500

Net
₹92,500

Outstanding
₹45,000
```

---

# 9. Quotations

Users with appropriate permissions can create quotations.

## Quotation Fields

```text
Quotation Number
Quotation Date
Valid Until

Client
Client Contact

Title
Description

Line Items
    Description
    Quantity
    Unit Price
    Discount
    Amount

Subtotal
Discount
Tax
Total

Terms & Conditions

Notes

Created By
Created At
Updated At
```

---

# 10. Quotation Status

Quotation lifecycle:

```text
Draft
  ↓
Sent
  ↓
Accepted
  ↓
Converted to Invoice
```

Alternative states:

```text
Rejected
Expired
Cancelled
```

---

# 11. Quotation Actions

Users with permissions can:

- Create quotation
- Edit quotation
- Delete draft quotation
- Preview quotation
- Generate PDF
- Download PDF
- Send quotation
- Mark as accepted
- Mark as rejected
- Duplicate quotation
- Convert quotation to invoice

---

# 12. Quotation → Invoice

A quotation should be convertible into an invoice.

Example:

```text
QTN-2026-001
SIPLINK Website
₹33,000
       ↓
     ACCEPTED
       ↓
INV-2026-001
SIPLINK Website
₹33,000
```

When converting:

- Client information is copied.
- Line items are copied.
- Pricing is copied.
- Tax information is copied.
- Terms can be modified before finalizing.
- The invoice references the original quotation.

---

# 13. Invoices

## Invoice Fields

```text
Invoice Number
Invoice Date
Due Date

Client
Billing Information

Quotation Reference

Line Items
    Description
    Quantity
    Unit Price
    Discount
    Amount

Subtotal
Discount
Tax
Total

Amount Paid
Balance Due

Payment Status

Terms
Notes

Created By
Created At
Updated At
```

---

# 14. Invoice Status

```text
Draft
Sent
Partially Paid
Paid
Overdue
Cancelled
```

Example:

```text
Invoice Total:       ₹33,000
Amount Paid:         ₹10,000
Outstanding:         ₹23,000

Status: Partially Paid
```

---

# 15. Invoice Actions

- Create
- Edit
- Delete draft
- Preview
- Generate PDF
- Download PDF
- Send
- Record payment
- Cancel
- Duplicate
- View payment history

---

# 16. Payments

Payments represent actual money received from clients or money paid by the company.

V1 should distinguish:

```text
Received
Spent
```

## Payment Fields

```text
Transaction ID
Type
Date
Amount

Client / Vendor

Invoice Reference

Payment Method

UPI
Bank Transfer
Cash
Credit Card
Debit Card
Other

Payment Proof

Notes

Created By
Created At
Updated At
```

---

# 17. Payment Proof

Every payment can optionally have supporting documentation.

Supported files:

- JPG
- PNG
- PDF
- WEBP

Examples:

- UPI screenshot
- Bank receipt
- Transaction receipt
- Payment confirmation
- Expense receipt

Files should be stored in **Supabase Storage** initially.

The database stores the file path/reference rather than the binary file.

Example:

```text
payment-proofs/
    2026/
        TXN-001-upi.png
```

---

# 18. Payment Status

```text
Pending
Received
Paid
Partially Paid
Cancelled
```

For invoice payments:

```text
Invoice
₹33,000

Payment 1
₹10,000

Payment 2
₹23,000

Total Paid
₹33,000

Status
Paid
```

The system must support multiple payments against a single invoice.

---

# 19. Expenses

Expenses represent money spent by DevSyndicate.

Examples:

- Hosting
- Domains
- Software subscriptions
- Marketing
- Equipment
- Office expenses
- Travel
- Salaries
- Other business expenses

## Expense Fields

```text
Expense ID
Date
Category
Description

Vendor
Amount

Payment Method

Receipt / Proof
Notes

Created By
Created At
Updated At
```

---

# 20. Expense Categories

Initial categories:

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

Categories should eventually become configurable.

---

# 21. Clients

The client module stores customer information.

## Client Fields

```text
Client ID
Company Name
Contact Person
Email
Phone
Address
City
State
Country
Tax/GST Information
Notes

Created At
Updated At
```

Client profile should show:

```text
Client
 ↓
Quotations
 ↓
Invoices
 ↓
Payments
 ↓
Outstanding Balance
```

---

# 22. Client Financial Summary

Each client should have:

```text
Total Quoted
Total Invoiced
Total Received
Outstanding
```

Example:

```text
SIPLINK

Quoted:       ₹50,000
Invoiced:     ₹33,000
Received:     ₹10,000
Outstanding:  ₹23,000
```

---

# 23. Documents

Documents are associated with business records.

Examples:

- Quotation PDFs
- Invoice PDFs
- Payment proofs
- Expense receipts
- Contracts
- Agreements

Initial storage:

**Supabase Storage**

Suggested structure:

```text
documents/
├── quotations/
├── invoices/
├── payment-proofs/
├── expenses/
└── contracts/
```

---

# 24. Reports

V1 reports:

### Revenue Report

```text
Month
Revenue
```

### Expense Report

```text
Month
Expenses
```

### Profit Report

```text
Revenue
- Expenses
= Net
```

### Outstanding Report

```text
Client
Invoice
Invoice Total
Paid
Outstanding
Due Date
Status
```

Reports should support:

- Date filtering
- Client filtering
- Status filtering
- CSV export

---

# 25. Audit Logs

Important actions must be recorded.

Example:

```text
Audit Log

User:
Mohammed

Action:
Created Invoice

Record:
INV-2026-001

Timestamp:
06-10-2026 14:30
```

Actions to log:

- User creation
- User deletion
- Role changes
- Permission changes
- Quotation creation
- Quotation status changes
- Invoice creation
- Invoice status changes
- Payment creation
- Expense creation
- Payment proof upload
- Record deletion

---

# 26. Database Architecture

Database:

**Supabase PostgreSQL**

Core tables:

```text
profiles
roles
permissions
role_permissions

clients

quotations
quotation_items

invoices
invoice_items

payments

expenses

documents

audit_logs
```

Relationships:

```text
clients
   │
   ├── quotations
   │      └── quotation_items
   │
   └── invoices
          └── invoice_items
                │
                └── payments
```

---

# 27. Security

Supabase Row Level Security (RLS) must be enabled.

Security must be enforced at the database level.

The application must NOT rely only on frontend role checks.

Rules should ensure:

- Users can only access authorized records.
- Finance users can access financial records.
- Staff cannot access restricted financial data.
- Only authorized users can create/update/delete records.
- Storage files cannot be freely accessed by unauthorized users.

---

# 28. Technology Stack

## Frontend

```text
Next.js
TypeScript
Tailwind CSS
```

## Backend

Next.js Server Actions / Route Handlers.

## Database

```text
Supabase PostgreSQL
```

## Authentication

```text
Supabase Auth
```

## File Storage

```text
Supabase Storage
```

## Deployment

```text
Vercel Free Tier
```

## Source Control

```text
GitHub
```

## PDF

```text
React PDF / compatible PDF generation library
```

## Charts

```text
Recharts
```

---

# 29. Free-Tier Requirement

The initial system should target **₹0 infrastructure cost**.

No paid infrastructure should be required for the MVP.

Primary services:

```text
Next.js          → Free
Vercel           → Free tier
Supabase         → Free tier
GitHub           → Free
Tailwind         → Free
Recharts         → Free
```

The application should be designed to remain within free-tier limits during development and early internal usage.

Free-tier limits should be reviewed before production deployment because provider limits and pricing can change.

---

# 30. Navigation

Recommended sidebar:

```text
Dashboard

Finance
    Overview
    Quotations
    Invoices
    Payments
    Expenses
    Reports

Clients

Documents

Settings
    Company
    Users
    Roles & Permissions
```

Navigation items must be hidden or disabled based on user permissions.

---

# 31. Dashboard UX

The dashboard should prioritize useful information.

Top:

```text
Revenue
Expenses
Net
Outstanding
```

Middle:

```text
Revenue vs Expenses
```

Bottom:

```text
Recent Transactions

Recent Invoices

Pending Payments

Overdue Invoices
```

---

# 32. Invoice Numbering

Invoice numbers should be generated automatically.

Example:

```text
INV-2026-001
INV-2026-002
INV-2026-003
```

Quotation numbers:

```text
QTN-2026-001
QTN-2026-002
QTN-2026-003
```

Transaction IDs:

```text
TXN-2026-001
TXN-2026-002
TXN-2026-003
```

Number generation must avoid duplicate numbers.

---

# 33. Financial Calculations

### Invoice Balance

```text
Balance =
Invoice Total - Total Payments
```

### Net Position

```text
Net =
Total Received - Total Expenses
```

### Outstanding

```text
Outstanding =
Total Invoiced - Total Received Against Invoices
```

The system must never calculate revenue based merely on quotations.

A quotation is **not revenue**.

Actual financial records begin when an invoice/payment is recorded.

---

# 34. Important Business Workflow

## New Client

```text
Create Client
      ↓
Create Quotation
      ↓
Send Quotation
      ↓
Client Accepts
      ↓
Convert to Invoice
      ↓
Send Invoice
      ↓
Receive Payment
      ↓
Upload Payment Proof
      ↓
Invoice Paid
```

---

# 35. Expense Workflow

```text
Create Expense
      ↓
Enter Amount
      ↓
Select Category
      ↓
Upload Receipt
      ↓
Save
      ↓
Expense included in Reports
```

---

# 36. V1 Acceptance Criteria

The first release is considered successful when:

### Authentication

- User can register/login.
- User can logout.
- User roles are assigned.
- Unauthorized users cannot access restricted resources.

### Clients

- Create client.
- Edit client.
- View client.
- View client financial summary.

### Quotations

- Create quotation.
- Generate quotation number.
- Add multiple line items.
- Calculate totals.
- Generate PDF.
- Change status.
- Convert accepted quotation into invoice.

### Invoices

- Create invoice.
- Generate invoice number.
- Add multiple items.
- Calculate totals.
- Generate PDF.
- Track due date.
- Track payment status.

### Payments

- Record payment.
- Support multiple payments per invoice.
- Upload payment proof.
- Automatically calculate invoice balance.

### Expenses

- Record expense.
- Categorize expense.
- Upload receipt.
- Include expense in reports.

### Dashboard

- Revenue displayed correctly.
- Expenses displayed correctly.
- Outstanding displayed correctly.
- Net position displayed correctly.
- Recent transactions displayed.

### Security

- RLS enabled.
- Role/permission checks implemented.
- Unauthorized database access prevented.
- Important actions logged.

---

# 37. Future Roadmap

## V1

**Finance Foundation**

```text
Auth
RBAC
Clients
Quotations
Invoices
Payments
Expenses
Documents
Dashboard
Audit Logs
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
Invoice reminders
Payment reminders
Email notifications
WhatsApp integration
Automated reports
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

---

# 38. Product Principle

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

# 39. V1 Development Priority

The implementation order should be:

```text
1. Project Setup
        ↓
2. Supabase Setup
        ↓
3. Authentication
        ↓
4. Profiles + Roles + Permissions
        ↓
5. RLS Security
        ↓
6. Company Settings
        ↓
7. Clients
        ↓
8. Quotations
        ↓
9. Invoice System
        ↓
10. Payments
        ↓
11. Payment Proof Storage
        ↓
12. Expenses
        ↓
13. Dashboard
        ↓
14. Reports
        ↓
15. Audit Logs
        ↓
16. Production Deployment
```

---

# 40. Final V1 Architecture

```text
                    DEV SYNDICATE ERP
                           │
                        Next.js
                       TypeScript
                           │
             ┌─────────────┼─────────────┐
             │             │             │
       Supabase Auth   PostgreSQL    Supabase Storage
             │             │             │
          Users       Business Data      Files
             │             │             │
          Roles       ┌────┴────┐         │
       Permissions    │         │         │
                    Finance    Clients     │
                       │                   │
               ┌───────┼────────┐         │
               │       │        │         │
          Quotations Invoices Payments     │
                           │               │
                       Expenses            │
                           │               │
                      Audit Logs           │
                                           │
                              Payment Proofs
                              Invoice PDFs
                              Receipts
```

**The first milestone is therefore not "build an ERP." It is:**

> **Build a secure Finance ERP foundation where a client can move from Quotation → Invoice → Payment → Proof, while the company can track Expenses and financial position.**

That gives DevSyndicate a genuinely usable internal system from V1, while keeping the architecture ready for the rest of the ERP.
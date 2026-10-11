import {
  Banknote,
  Building2,
  FolderOpen,
  LayoutDashboard,
  Landmark,
  Settings,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
  /** Permission required to see the item (PRD §5). Filtering is wired up with auth. */
  permission: string;
  children?: NavItem[];
};

// Sidebar layout from PRD §35.
export const navigation: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
  {
    title: "Finance",
    href: "/finance",
    icon: Landmark,
    permission: "reports.view",
    children: [
      { title: "Quotations", href: "/finance/quotations", permission: "quotations.view" },
      { title: "Invoices", href: "/finance/invoices", permission: "invoices.view" },
      { title: "Credit Notes", href: "/finance/credit-notes", permission: "credit_notes.view" },
      { title: "Payments", href: "/finance/payments", permission: "payments.view" },
      { title: "Expenses", href: "/finance/expenses", permission: "expenses.view" },
      { title: "Reports", href: "/finance/reports", permission: "reports.view" },
    ],
  },
  { title: "Clients", href: "/clients", icon: Building2, permission: "clients.view" },
  { title: "Vendors", href: "/vendors", icon: Truck, permission: "vendors.view" },
  { title: "Documents", href: "/documents", icon: FolderOpen, permission: "documents.view" },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "settings.view",
    children: [
      { title: "Company", href: "/settings/company", permission: "settings.view" },
      { title: "Tax Rates", href: "/settings/tax-rates", permission: "settings.view" },
      { title: "Expense Categories", href: "/settings/expense-categories", permission: "settings.view" },
      { title: "Users", href: "/settings/users", permission: "users.view" },
      { title: "Roles & Permissions", href: "/settings/roles", permission: "roles.view" },
      { title: "Data Import", href: "/settings/import", permission: "data.import" },
      { title: "Audit Logs", href: "/settings/audit-logs", permission: "audit_logs.view" },
    ],
  },
];

export const brand = { name: "DevSyndicate", product: "ERP", icon: Banknote };

/** Flat list of every routable nav entry, used to resolve page titles. */
export const navRoutes = navigation.flatMap((item) => [item, ...(item.children ?? [])]);

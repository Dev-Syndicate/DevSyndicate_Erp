@AGENTS.md

# DevSyndicate ERP

Internal finance ERP. Requirements: [docs/PRD.md](docs/PRD.md) (v1.4). The PRD is the spec; follow its definitions (§9 money rules, §5 permissions, §30 numbering).

Stack: Next.js 16 (App Router, `src/`), TypeScript, Tailwind CSS v4, shadcn/ui (Radix base, `radix-nova` style), Supabase (Postgres, Auth, Storage), pnpm.

## Commands

- `pnpm dev`: start the dev server
- `pnpm build`: production build (also type-checks)
- `pnpm lint`: ESLint
- `pnpm test`: unit tests (`src/**/*.test.mjs`, Node test runner; tested modules avoid `@/` imports)
- `pnpm dlx shadcn@latest add <component>`: add a shadcn component

## Supabase

- Project: `devsyndicate-erp` (ref `hnwmgeplzdyhdjfqhymo`, region ap-south-1). Env vars in `.env.local` (template: `.env.example`).
- Schema changes go in `supabase/migrations/<version>_<name>.sql`, one file per applied migration, matching the version Supabase records.
- After every migration: regenerate `src/lib/supabase/database.types.ts`, run the security + performance advisors, and run `supabase/tests/*.sql` (each rolls back).
- Every table: RLS on, policies use `has_permission('<module>.<action>')` and `current_org_id()`, audit trigger attached (`audit_row_change`).
- Server code uses `@/lib/supabase/server` (user session, RLS applies). `src/proxy.ts` refreshes the session and redirects signed-out users to `/login`.

## Rules

### 1. Feature-based folder structure

```text
src/
├── app/                    # Routing only: thin pages/layouts that compose features
│   └── (app)/              # Authenticated shell (sidebar + header)
├── features/<feature>/     # Everything for one business feature
│   ├── components/         # Feature UI
│   ├── actions.ts          # Server actions
│   ├── queries.ts          # Data reads
│   ├── schema.ts           # Zod schemas / types
│   └── utils.ts            # Feature-only helpers (+ tests next to them)
├── components/
│   ├── ui/                 # shadcn components (generated; avoid hand edits)
│   └── layout/             # App shell (sidebar, header, theme toggle)
├── config/                 # App-wide config (navigation, site)
├── hooks/                  # Shared React hooks
└── lib/                    # Shared, feature-agnostic code (utils, supabase client, money)
```

- Feature names match PRD modules: `dashboard`, `clients`, `vendors`, `quotations`, `invoices`, `credit-notes`, `payments`, `expenses`, `reports`, `documents`, `settings`, `users`, `roles`, `audit-logs`.
- Create only the files a feature actually needs.
- Code used by one feature stays inside that feature. Move it to `lib/` or `components/` only when a second feature needs it.
- Features may import from `lib/`, `components/`, `config/`, `hooks/`. Avoid importing deep into another feature's internals.
- Pages in `app/` stay thin: fetch via the feature's `queries.ts`, render the feature's components.

### 2. Theme and colors: single source of truth

- **All colors, radius and font tokens live only in `src/app/globals.css`** (`:root` = light, `.dark` = dark, mapped in `@theme inline`).
- Components use semantic token classes only: `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, `bg-destructive`, `bg-success`, `bg-warning`, `bg-info`, `chart-1…5`, `sidebar-*`.
- **Never** hard-code colors in components: no hex/rgb/oklch values, no Tailwind palette classes (`bg-blue-500`, `text-gray-600`), no inline `style={{ color }}`.
- Need a new color? Add the variable to both `:root` and `.dark`, map it in `@theme inline`, then use the class.
- Status colors: paid/success → `success`, overdue/error → `destructive`, pending/partial → `warning`, informational → `info`.
- Branding text and icon come from `src/config/navigation.ts` (`brand`).

### 3. UI: shadcn components only

- Build all UI from shadcn/ui components (`src/components/ui`). Add missing ones with the shadcn CLI; do not hand-roll a button, dialog, table, form, etc.
- Icons: `lucide-react`.
- Check the current shadcn docs (https://ui.shadcn.com/docs) before adding or upgrading components.

### 4. Git commits

- **Do not add `Co-Authored-By` lines or any AI/Claude attribution** to commit messages or PR descriptions.
- Do not add "Generated with Claude Code" footers.

### 5. Business logic first

- Before building or changing any feature, field or column, research how it works in practice: Indian GST law (CGST Act / Rules) and how Zoho Books, Tally or QuickBooks handle it.
- Share a short plan with the findings and sources, update `docs/PRD.md` if the logic differs, then build.
- Answer "do we need X?" with researched facts and sources, not opinion.

### 6. Code style

- Keep changes minimal (ponytail): no unrequested abstractions, options or "for later" code.
- Money: never use JS floats for amounts. Follow PRD §8–§9 (numeric(14,2) in DB, decimal/paise in code).
- Security lives in the database (RLS). Never use the Supabase service-role key in user-facing server actions (PRD §32.3).

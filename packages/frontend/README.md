# @rayverify/frontend

Next.js 15 Investigator Dashboard for the RayVerify™ platform.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, server components) |
| Language | TypeScript 5 (strict) |
| Styling | TailwindCSS 3 + CSS custom properties (shadcn theme) |
| UI Primitives | shadcn/ui pattern (Radix UI + CVA) |
| Data Fetching | TanStack Query v5 (QueryClientProvider in app/providers.tsx) |
| Charts | Recharts 2 |
| Icons | lucide-react |

## Project structure

```
packages/frontend/
├── app/
│   ├── layout.tsx              Root layout (font, providers, metadata)
│   ├── globals.css             Tailwind + CSS variables (gov/security palette)
│   ├── providers.tsx           TanStack QueryClientProvider
│   ├── login/page.tsx          Login screen
│   └── (dashboard)/            Dashboard route group
│       ├── layout.tsx          Sidebar + TopBar shell
│       ├── page.tsx            Overview / KPIs + charts
│       ├── FraudTrendChart.tsx Line chart (client component)
│       ├── RiskDistributionChart.tsx Donut chart
│       ├── alerts/page.tsx     Fraud alerts list
│       ├── cases/
│       │   ├── page.tsx        Case list
│       │   └── [id]/page.tsx   Case detail (timeline, evidence, notes)
│       ├── providers/
│       │   ├── page.tsx        Provider risk rankings + detail
│       │   ├── ProviderTrendSparkline.tsx
│       │   └── ProviderRiskTrendChart.tsx
│       ├── visits/
│       │   ├── page.tsx        Visit list
│       │   └── [id]/page.tsx   Visit verification chain
│       ├── audit/page.tsx      Audit log viewer
│       └── reports/page.tsx    Report generation + history
├── components/
│   ├── ui/                     shadcn-style primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   └── avatar.tsx
│   ├── RiskBadge.tsx           Risk level badge (LOW/MODERATE/HIGH/CRITICAL)
│   ├── VerificationResultBadge.tsx PASS/REVIEW/FAIL badge
│   ├── StatCard.tsx            KPI card with trend indicator
│   ├── PageHeader.tsx          Page title + action slot
│   ├── Sidebar.tsx             Navigation sidebar
│   ├── TopBar.tsx              Org switcher + user menu
│   ├── DataTable.tsx           Generic typed table
│   └── FraudTimeline.tsx       Vertical fraud event timeline
├── lib/
│   ├── types.ts                TypeScript types mirroring Prisma schema
│   ├── mock.ts                 Typed mock data (runs without a backend)
│   ├── api.ts                  Typed fetch client for all API endpoints
│   ├── risk.ts                 Risk band & verification result display configs
│   └── utils.ts                cn(), formatters, risk helpers
├── Dockerfile                  Multi-stage Next.js standalone image
├── .env.example                Environment variables template
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── postcss.config.mjs
```

## Running locally

```bash
# From repo root
npm install

# From this package
cd packages/frontend
cp ../../.env.example .env.local    # or just create .env.local with:
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit (best-effort, needs npm install first)
npm run build        # production build
```

## Page routes

| Route | Description |
|---|---|
| `/login` | Investigator sign-in |
| `/` | Overview — KPIs, fraud trend, risk distribution, recent alerts |
| `/alerts` | Fraud alerts list with severity filters |
| `/cases` | Investigation case management |
| `/cases/[id]` | Case detail — timeline, evidence, notes, status actions |
| `/providers` | Provider risk ranking table + detail chart |
| `/visits` | Visit list with verification results |
| `/visits/[id]` | Visit verification chain (identity → GPS → device → patient → fraud) |
| `/audit` | Immutable audit log viewer |
| `/reports` | Report generation (PDF/Excel) + history |

## Mock data

All pages render with `lib/mock.ts` data and no backend dependency. When
`NEXT_PUBLIC_API_BASE_URL` is set and the backend is running, swap each page
to use TanStack Query hooks calling `lib/api.ts` instead of the mock imports.

## Design principles

- Government / security palette: deep navy primary, slate grays, precise semantic colours for risk bands.
- Data-dense, not flashy: compact padding, tabular numbers, monospace for IDs/hashes.
- Consistent `RiskBadge` and `VerificationResultBadge` across all pages.
- Accessible: semantic HTML, `sr-only` labels, focus rings.
- Risk bands: 0–30 LOW (green) · 31–60 MODERATE (amber) · 61–80 HIGH (orange) · 81–100 CRITICAL (red).

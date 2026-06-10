import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { DataTable, Column } from "@/components/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_CASES } from "@/lib/mock";
import { FraudCase } from "@/lib/types";
import {
  formatCents,
  formatDate,
  caseStatusLabel,
} from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/lib/risk";

export const metadata: Metadata = { title: "Cases" };

const STATUS_CLASSES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  ESCALATED: "bg-red-50 text-red-700 border-red-200",
  PENDING_PAYMENT_HOLD: "bg-orange-50 text-orange-700 border-orange-200",
  SUBSTANTIATED: "bg-purple-50 text-purple-700 border-purple-200",
  UNSUBSTANTIATED: "bg-slate-50 text-slate-600 border-slate-200",
  CLOSED: "bg-green-50 text-green-700 border-green-200",
};

const columns: Column<FraudCase>[] = [
  {
    key: "caseNumber",
    header: "Case No.",
    render: (row) => (
      <Link
        href={`/cases/${row.id}`}
        className="font-mono text-xs font-semibold text-primary hover:underline"
      >
        {row.caseNumber}
      </Link>
    ),
  },
  {
    key: "title",
    header: "Title",
    className: "max-w-xs",
    render: (row) => (
      <div className="max-w-xs">
        <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {row.provider?.legalName ?? "—"}
        </p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[row.status] ?? ""}`}
      >
        {caseStatusLabel(row.status)}
      </span>
    ),
  },
  {
    key: "priority",
    header: "Priority",
    render: (row) => {
      const cfg = PRIORITY_CONFIG[row.priority];
      return (
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${cfg.badgeClass}`}
        >
          {cfg.label}
        </span>
      );
    },
  },
  {
    key: "risk",
    header: "Risk",
    render: (row) => <RiskBadge level={row.riskLevel} />,
  },
  {
    key: "assignee",
    header: "Assignee",
    render: (row) =>
      row.assignee ? (
        <span className="text-xs text-foreground">
          {row.assignee.firstName} {row.assignee.lastName}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Unassigned</span>
      ),
  },
  {
    key: "exposure",
    header: "Exposure",
    render: (row) => (
      <span className="tabular-nums text-xs font-medium text-foreground">
        {row.exposureCents != null ? formatCents(row.exposureCents) : "—"}
      </span>
    ),
  },
  {
    key: "openedAt",
    header: "Opened",
    render: (row) => (
      <span className="text-xs text-muted-foreground">{formatDate(row.openedAt)}</span>
    ),
  },
  {
    key: "actions",
    header: "",
    render: (row) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/cases/${row.id}`}>View</Link>
      </Button>
    ),
  },
];

export default function CasesPage() {
  const open = MOCK_CASES.filter((c) => c.status !== "CLOSED" && c.status !== "SUBSTANTIATED" && c.status !== "UNSUBSTANTIATED").length;
  const critical = MOCK_CASES.filter((c) => c.riskLevel === "CRITICAL").length;
  const totalExposure = MOCK_CASES.reduce((sum, c) => sum + (c.exposureCents ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investigation Cases"
        description="Fraud cases grouped from related events. Manage assignments, status, and payment holds."
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Cases", value: open, cls: "text-foreground" },
          { label: "Critical Risk", value: critical, cls: "text-red-700" },
          { label: "Total Exposure", value: formatCents(totalExposure), cls: "text-orange-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={MOCK_CASES} rowKey={(r) => r.id} />
        </CardContent>
      </Card>
    </div>
  );
}

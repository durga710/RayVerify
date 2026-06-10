import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { VerificationResultBadge } from "@/components/VerificationResultBadge";
import { DataTable, Column } from "@/components/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_VISITS } from "@/lib/mock";
import { Visit } from "@/lib/types";
import {
  formatDateTime,
  formatDuration,
  formatCents,
  visitStatusLabel,
} from "@/lib/utils";

export const metadata: Metadata = { title: "Visits" };

const STATUS_CLASSES: Record<string, string> = {
  SCHEDULED: "bg-slate-50 text-slate-600 border-slate-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  FLAGGED: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-slate-50 text-slate-400 border-slate-200",
};

const columns: Column<Visit>[] = [
  {
    key: "id",
    header: "Visit ID",
    render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
    ),
  },
  {
    key: "provider",
    header: "Provider",
    render: (row) => (
      <span className="text-sm text-foreground">
        {row.provider?.legalName ?? row.providerId}
      </span>
    ),
  },
  {
    key: "service",
    header: "Service",
    render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.serviceCode ?? "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[row.status] ?? ""}`}
      >
        {visitStatusLabel(row.status)}
      </span>
    ),
  },
  {
    key: "result",
    header: "Verification",
    render: (row) =>
      row.verificationResult ? (
        <VerificationResultBadge result={row.verificationResult} />
      ) : (
        <span className="text-xs text-muted-foreground">Pending</span>
      ),
  },
  {
    key: "risk",
    header: "Risk",
    render: (row) =>
      row.riskLevel ? (
        <RiskBadge level={row.riskLevel} score={row.riskScore} showScore />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "duration",
    header: "Duration",
    render: (row) => (
      <span className="tabular-nums text-xs text-foreground">
        {row.durationMinutes != null && row.durationMinutes > 0
          ? formatDuration(row.durationMinutes)
          : "—"}
      </span>
    ),
  },
  {
    key: "billed",
    header: "Billed",
    render: (row) => (
      <span className="tabular-nums text-xs text-foreground">
        {row.billedAmountCents != null ? formatCents(row.billedAmountCents) : "—"}
      </span>
    ),
  },
  {
    key: "scheduled",
    header: "Scheduled",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {formatDateTime(row.scheduledStart)}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    render: (row) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/visits/${row.id}`}>Verify Chain</Link>
      </Button>
    ),
  },
];

export default function VisitsPage() {
  const flagged = MOCK_VISITS.filter((v) => v.status === "FLAGGED").length;
  const failed = MOCK_VISITS.filter((v) => v.verificationResult === "FAIL").length;
  const review = MOCK_VISITS.filter((v) => v.verificationResult === "REVIEW").length;
  const passed = MOCK_VISITS.filter((v) => v.verificationResult === "PASS").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visit Verification"
        description="All visit records with their identity → GPS → device → fraud verification chain."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Passed", value: passed, cls: "text-green-700" },
          { label: "Review", value: review, cls: "text-amber-700" },
          { label: "Failed", value: failed, cls: "text-red-700" },
          { label: "Flagged", value: flagged, cls: "text-orange-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={MOCK_VISITS}
            rowKey={(r) => r.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

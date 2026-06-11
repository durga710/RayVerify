import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { DataTable, Column } from "@/components/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { MOCK_FRAUD_EVENTS } from "@/lib/mock";
import { FraudEvent } from "@/lib/types";
import { fraudTypeLabel, formatDateTime, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Fraud Alerts" };

const STATUS_CLASSES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  TRIAGED: "bg-blue-50 text-blue-700 border-blue-200",
  LINKED_TO_CASE: "bg-purple-50 text-purple-700 border-purple-200",
  DISMISSED: "bg-slate-50 text-slate-600 border-slate-200",
  CONFIRMED: "bg-red-50 text-red-700 border-red-200",
};

const columns: Column<FraudEvent>[] = [
  {
    key: "type",
    header: "Alert Type",
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{fraudTypeLabel(row.type)}</p>
        {row.detector && (
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {row.detector}
          </p>
        )}
      </div>
    ),
  },
  {
    key: "risk",
    header: "Severity / Risk",
    render: (row) => (
      <div className="flex items-center gap-2">
        <RiskBadge level={row.riskLevel} />
        <span className="tabular-nums text-xs font-semibold text-foreground">
          {row.severity}
        </span>
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
        {row.status.replace(/_/g, " ")}
      </span>
    ),
  },
  {
    key: "explanation",
    header: "Finding",
    className: "max-w-xs",
    render: (row) => (
      <p className="truncate text-xs text-muted-foreground max-w-xs">
        {row.explanation ?? "—"}
      </p>
    ),
  },
  {
    key: "visit",
    header: "Visit",
    render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.visitId ?? "—"}
      </span>
    ),
  },
  {
    key: "detected",
    header: "Detected",
    render: (row) => (
      <div>
        <p className="text-xs text-foreground">{formatRelative(row.detectedAt)}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatDateTime(row.detectedAt)}
        </p>
      </div>
    ),
  },
];

export default function AlertsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Fraud Alerts"
        description="All detected fraud signals from the Fraud Intelligence Engine. Click a row to investigate."
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Open", value: MOCK_FRAUD_EVENTS.filter((e) => e.status === "OPEN").length, cls: "text-amber-700" },
          { label: "Confirmed", value: MOCK_FRAUD_EVENTS.filter((e) => e.status === "CONFIRMED").length, cls: "text-red-700" },
          { label: "Triaged", value: MOCK_FRAUD_EVENTS.filter((e) => e.status === "TRIAGED").length, cls: "text-blue-700" },
          { label: "Dismissed", value: MOCK_FRAUD_EVENTS.filter((e) => e.status === "DISMISSED").length, cls: "text-slate-500" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {s.label}
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${s.cls}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={MOCK_FRAUD_EVENTS}
            rowKey={(r) => r.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

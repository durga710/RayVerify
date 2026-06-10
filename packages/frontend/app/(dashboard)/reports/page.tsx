import React from "react";
import type { Metadata } from "next";
import {
  FileText,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable, Column } from "@/components/DataTable";
import { MOCK_REPORTS } from "@/lib/mock";
import { Report, ReportStatus, ReportType } from "@/lib/types";
import { formatDateTime, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const REPORT_TYPE_META: Record<
  ReportType,
  { label: string; description: string }
> = {
  [ReportType.FRAUD_SUMMARY]: {
    label: "Fraud Summary",
    description:
      "All detected fraud events, confirmed cases, and dollar exposure for a period.",
  },
  [ReportType.PROVIDER_RISK]: {
    label: "Provider Risk",
    description:
      "Risk rankings, trend scores, and anomaly breakdown for all enrolled providers.",
  },
  [ReportType.VISIT_VERIFICATION]: {
    label: "Visit Verification",
    description:
      "Verification results, risk scores, and chain outcomes for all visits.",
  },
  [ReportType.INVESTIGATION]: {
    label: "Investigation",
    description: "Full case dossier — events, notes, evidence, and timeline.",
  },
  [ReportType.STATE_COMPLIANCE]: {
    label: "State Compliance",
    description:
      "CMS / state Medicaid quarterly compliance and EVV attestation report.",
  },
  [ReportType.EXECUTIVE_DASHBOARD]: {
    label: "Executive Dashboard",
    description:
      "High-level KPIs, open investigations, and program integrity status.",
  },
};

const STATUS_ICON: Record<ReportStatus, React.ElementType> = {
  [ReportStatus.QUEUED]: Clock,
  [ReportStatus.GENERATING]: Loader2,
  [ReportStatus.READY]: CheckCircle2,
  [ReportStatus.FAILED]: XCircle,
  [ReportStatus.EXPIRED]: Clock,
};

const STATUS_CLASSES: Record<ReportStatus, string> = {
  [ReportStatus.QUEUED]: "text-slate-500",
  [ReportStatus.GENERATING]: "text-blue-600 animate-spin",
  [ReportStatus.READY]: "text-green-600",
  [ReportStatus.FAILED]: "text-red-600",
  [ReportStatus.EXPIRED]: "text-amber-600",
};

const columns: Column<Report>[] = [
  {
    key: "type",
    header: "Report Type",
    render: (row) => (
      <div>
        <p className="text-sm font-medium text-foreground">
          {REPORT_TYPE_META[row.type]?.label ?? row.type}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.format} · {row.requestedBy?.firstName} {row.requestedBy?.lastName}
        </p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => {
      const Icon = STATUS_ICON[row.status];
      return (
        <div className="flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${STATUS_CLASSES[row.status]}`} />
          <span className="text-xs text-foreground capitalize">
            {row.status.toLowerCase()}
          </span>
        </div>
      );
    },
  },
  {
    key: "created",
    header: "Requested",
    render: (row) => (
      <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
    ),
  },
  {
    key: "completed",
    header: "Completed",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {row.completedAt ? formatDateTime(row.completedAt) : "—"}
      </span>
    ),
  },
  {
    key: "expires",
    header: "Expires",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {row.expiresAt ? formatDate(row.expiresAt) : "—"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    render: (row) =>
      row.status === ReportStatus.READY ? (
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      ) : (
        <span />
      ),
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Generate PDF/Excel compliance, fraud, and investigation reports. Reports expire after 30 days."
      />

      {/* Generate new report section */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Generate New Report
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(REPORT_TYPE_META) as ReportType[]).map((type) => {
            const meta = REPORT_TYPE_META[type];
            return (
              <Card key={type} className="hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex gap-1.5 ml-auto">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        PDF
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Excel
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-sm mt-2">{meta.label}</CardTitle>
                  <CardDescription className="text-xs">
                    {meta.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent reports */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Recent Reports
        </h2>
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={MOCK_REPORTS}
              rowKey={(r) => r.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

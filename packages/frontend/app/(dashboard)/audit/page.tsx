import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, Column } from "@/components/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MOCK_AUDIT_LOGS } from "@/lib/mock";
import { AuditLog } from "@/lib/types";
import { formatDateTime, initials } from "@/lib/utils";
import { Lock } from "lucide-react";

export const metadata: Metadata = { title: "Audit Log" };

const ACTION_CLASSES: Record<string, string> = {
  CREATE: "bg-green-50 text-green-700 border-green-200",
  READ: "bg-slate-50 text-slate-600 border-slate-200",
  UPDATE: "bg-blue-50 text-blue-700 border-blue-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
  LOGIN: "bg-indigo-50 text-indigo-700 border-indigo-200",
  LOGOUT: "bg-indigo-50 text-indigo-600 border-indigo-200",
  EXPORT: "bg-amber-50 text-amber-700 border-amber-200",
  VERIFY: "bg-teal-50 text-teal-700 border-teal-200",
  SCORE: "bg-purple-50 text-purple-700 border-purple-200",
  CASE_ACTION: "bg-orange-50 text-orange-700 border-orange-200",
  CONFIG_CHANGE: "bg-red-50 text-red-800 border-red-300",
};

const columns: Column<AuditLog>[] = [
  {
    key: "actor",
    header: "Actor",
    render: (row) =>
      row.actor ? (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">
              {initials(row.actor.firstName, row.actor.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs font-medium text-foreground">
              {row.actor.firstName} {row.actor.lastName}
            </p>
            <p className="text-[10px] text-muted-foreground">{row.actor.email}</p>
          </div>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">System</span>
      ),
  },
  {
    key: "action",
    header: "Action",
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${ACTION_CLASSES[row.action] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
      >
        {row.action.replace(/_/g, " ")}
      </span>
    ),
  },
  {
    key: "resource",
    header: "Resource",
    render: (row) => (
      <div>
        <p className="text-xs font-medium text-foreground">
          {row.resourceType.replace(/_/g, " ")}
        </p>
        {row.resourceId && (
          <p className="text-[10px] font-mono text-muted-foreground">{row.resourceId}</p>
        )}
      </div>
    ),
  },
  {
    key: "ip",
    header: "IP Address",
    render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.ipAddress ?? "—"}
      </span>
    ),
  },
  {
    key: "metadata",
    header: "Context",
    className: "max-w-xs",
    render: (row) => (
      <p className="truncate text-xs text-muted-foreground font-mono max-w-xs">
        {Object.keys(row.metadata).length > 0
          ? JSON.stringify(row.metadata)
          : "—"}
      </p>
    ),
  },
  {
    key: "hash",
    header: "Hash",
    render: (row) => (
      <span className="font-mono text-[10px] text-muted-foreground">
        {row.hash ? row.hash.slice(0, 16) + "…" : "—"}
      </span>
    ),
  },
  {
    key: "timestamp",
    header: "Timestamp",
    render: (row) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(row.createdAt)}
      </span>
    ),
  },
];

export default function AuditPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        description="Immutable, tamper-evident audit trail. Every read, write, export, and case action is recorded with hash chain integrity."
      />

      {/* Compliance notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <Lock className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          This log is append-only and tamper-evident. Records are hashed using a
          SHA-256 chain (prevHash → hash). Modifications are cryptographically
          detectable. Retained per your organization&apos;s HIPAA data-retention
          policy.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by actor, resource, action…"
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={MOCK_AUDIT_LOGS}
            rowKey={(r) => r.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

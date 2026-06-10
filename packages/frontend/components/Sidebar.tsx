"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  FolderOpen,
  Building2,
  ClipboardCheck,
  ScrollText,
  BarChart3,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Fraud Alerts",
    href: "/alerts",
    icon: AlertTriangle,
  },
  {
    label: "Cases",
    href: "/cases",
    icon: FolderOpen,
  },
  {
    label: "Providers",
    href: "/providers",
    icon: Building2,
  },
  {
    label: "Visits",
    href: "/visits",
    icon: ClipboardCheck,
  },
  {
    label: "Audit Log",
    href: "/audit",
    icon: ScrollText,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo / Wordmark */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-foreground">
            RayVerify™
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Investigator
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-[10px] text-muted-foreground">
          RayHealthEVV™ Platform
        </p>
        <p className="text-[10px] text-muted-foreground">
          HIPAA · NIST 800-63 · SOC 2
        </p>
      </div>
    </aside>
  );
}

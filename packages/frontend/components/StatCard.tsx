import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  icon?: LucideIcon;
  iconClass?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  change,
  icon: Icon,
  iconClass,
  className,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
              {value}
            </p>
            {(subtitle || change !== undefined) && (
              <div className="mt-1 flex items-center gap-2">
                {change !== undefined && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isPositive && "text-green-600",
                      isNegative && "text-red-600",
                      !isPositive && !isNegative && "text-muted-foreground"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {change.toFixed(1)}% vs last period
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-muted-foreground">
                    {subtitle}
                  </span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted",
                iconClass
              )}
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

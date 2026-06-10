import type { Metadata } from "next";
import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Branding */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
          <Shield className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            RayVerify™
          </h1>
          <p className="text-sm text-muted-foreground">
            Medicaid Fraud Detection &amp; Identity Verification
          </p>
        </div>
      </div>

      {/* Login card */}
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Investigator Sign In</CardTitle>
          <CardDescription>
            Authorized personnel only. All access is logged and audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Government Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@agency.gov"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="mfa"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                MFA Code
              </label>
              <Input
                id="mfa"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="6-digit code"
                autoComplete="one-time-code"
              />
            </div>

            <Button type="submit" className="w-full gap-2">
              <Lock className="h-4 w-4" />
              Sign In Securely
            </Button>
          </form>

          <div className="mt-5 rounded-md border border-border bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              By signing in you agree that all actions are subject to monitoring
              under 18 U.S.C. §§ 1030, 1343. Unauthorized access is a federal
              crime. Session data is retained per HIPAA §164.312.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        RayHealthEVV™ · HIPAA · HITECH · NIST 800-63 · SOC 2
      </p>
    </div>
  );
}

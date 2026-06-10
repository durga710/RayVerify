import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Lock, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Welcome",
  description:
    "RayVerify™ landing page with secure sign in and guest access to the investigator dashboard.",
};

const trustPoints = [
  "Identity verification",
  "Fraud intelligence",
  "Audit-ready workflows",
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#07111f_0%,#0f1b2d_28%,#eaf1f8_28%,#eef4fb_100%)] text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="absolute left-[-5rem] top-64 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-[-4rem] top-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-white shadow-[0_16px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-lg shadow-sky-900/30">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">RayVerify™</p>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-300">
                Program integrity workspace
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="hidden rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 sm:inline-flex"
          >
            Continue as guest
          </Link>
        </header>

        <div className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-14">
          <div className="max-w-2xl space-y-7 text-slate-950">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-sky-600" />
              Secure program integrity workspace
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                RayVerify™ helps agencies spot fraud before payment goes out.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Review identity checks, visit verification, device trust, and
                fraud signals in one place. Sign in for full access, or continue
                as a guest to explore the dashboard shell.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm text-slate-700 shadow-sm backdrop-blur"
                >
                  <BadgeCheck className="h-4 w-4 text-emerald-600" />
                  {point}
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Security-first
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Built for authenticated workflows and audit logging.
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Fraud-aware
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Review alerts, case queues, and risk scoring in one flow.
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Guest-ready
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Continue without credentials while the auth flow is finalized.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-sky-400/30 via-white/5 to-indigo-400/20 blur-2xl" />
            <Card className="relative border-slate-200/80 bg-white/90 shadow-[0_20px_80px_rgba(15,23,42,0.18)] backdrop-blur">
              <CardHeader className="space-y-3 pb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 shadow-lg shadow-slate-900/25">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Sign in to RayVerify</CardTitle>
                  <CardDescription className="mt-2 text-slate-600">
                    Use agency credentials when available. Guest access is enabled
                    for now.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <form className="space-y-4" action="/dashboard" method="get">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-slate-700">
                      Government email
                    </label>
                    <Input id="email" name="email" type="email" placeholder="you@agency.gov" />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <Input id="password" name="password" type="password" placeholder="••••••••" />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="mfa" className="text-sm font-medium text-slate-700">
                      MFA code
                    </label>
                    <Input id="mfa" name="mfa" type="text" inputMode="numeric" placeholder="6-digit code" />
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2 bg-slate-950 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                  >
                    <Lock className="h-4 w-4" />
                    Sign in
                  </Button>
                </form>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  >
                    <Link href="/dashboard" aria-label="Continue as guest">
                      Continue as guest
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  >
                    <Link href="/login">Use sign-in page</Link>
                  </Button>
                </div>

                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                  All activity is intended for authorized personnel and audit
                  review. Guest access is a temporary onboarding path while the
                  authentication flow is being completed.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
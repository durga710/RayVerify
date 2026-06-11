// =============================================================================
// RayVerify™ — Typed API client
// Points at NEXT_PUBLIC_API_BASE_URL; falls back to mock data when undefined.
// =============================================================================

import {
  AuditLog,
  FraudCase,
  FraudEvent,
  FraudTrendPoint,
  LoginRequest,
  LoginResponse,
  OverviewStats,
  PaginatedResponse,
  Provider,
  ProviderRiskProfile,
  Report,
  ReportFormat,
  ReportType,
  RiskDistribution,
  Visit,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string };
      message = err.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  login: (data: LoginRequest) =>
    request<LoginResponse>("/api/v1/auth/login", { method: "POST", body: data }),

  logout: (token: string) =>
    request<void>("/api/v1/auth/logout", { method: "POST", token }),

  me: (token: string) =>
    request<LoginResponse["user"]>("/api/v1/auth/me", { token }),
};

// ---------------------------------------------------------------------------
// Overview / Dashboard
// ---------------------------------------------------------------------------

export const dashboardApi = {
  getStats: (token: string) =>
    request<OverviewStats>("/api/v1/dashboard/stats", { token }),

  getFraudTrend: (token: string, weeks = 13) =>
    request<FraudTrendPoint[]>(`/api/v1/dashboard/fraud-trend?weeks=${weeks}`, { token }),

  getRiskDistribution: (token: string) =>
    request<RiskDistribution[]>("/api/v1/dashboard/risk-distribution", { token }),
};

// ---------------------------------------------------------------------------
// Fraud Events
// ---------------------------------------------------------------------------

export interface FraudEventFilter {
  page?: number;
  pageSize?: number;
  status?: string;
  riskLevel?: string;
  type?: string;
  search?: string;
}

export const fraudEventsApi = {
  list: (token: string, filter: FraudEventFilter = {}) => {
    const params = new URLSearchParams();
    if (filter.page != null) params.set("page", String(filter.page));
    if (filter.pageSize != null) params.set("pageSize", String(filter.pageSize));
    if (filter.status) params.set("status", filter.status);
    if (filter.riskLevel) params.set("riskLevel", filter.riskLevel);
    if (filter.type) params.set("type", filter.type);
    if (filter.search) params.set("search", filter.search);
    return request<PaginatedResponse<FraudEvent>>(
      `/api/v1/fraud-events?${params.toString()}`,
      { token }
    );
  },
  get: (id: string, token: string) =>
    request<FraudEvent>(`/api/v1/fraud-events/${id}`, { token }),
};

// ---------------------------------------------------------------------------
// Fraud Cases
// ---------------------------------------------------------------------------

export interface CaseFilter {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  riskLevel?: string;
  assigneeId?: string;
  search?: string;
}

export const casesApi = {
  list: (token: string, filter: CaseFilter = {}) => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v != null) params.set(k, String(v));
    });
    return request<PaginatedResponse<FraudCase>>(
      `/api/v1/cases?${params.toString()}`,
      { token }
    );
  },
  get: (id: string, token: string) =>
    request<FraudCase>(`/api/v1/cases/${id}`, { token }),
  updateStatus: (id: string, status: string, token: string) =>
    request<FraudCase>(`/api/v1/cases/${id}/status`, {
      method: "PATCH",
      body: { status },
      token,
    }),
  addNote: (id: string, body: string, isInternal: boolean, token: string) =>
    request<void>(`/api/v1/cases/${id}/notes`, {
      method: "POST",
      body: { body, isInternal },
      token,
    }),
};

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export interface ProviderFilter {
  page?: number;
  pageSize?: number;
  riskLevel?: string;
  search?: string;
  isActive?: boolean;
}

export const providersApi = {
  list: (token: string, filter: ProviderFilter = {}) => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v != null) params.set(k, String(v));
    });
    return request<PaginatedResponse<Provider>>(
      `/api/v1/providers?${params.toString()}`,
      { token }
    );
  },
  get: (id: string, token: string) =>
    request<Provider>(`/api/v1/providers/${id}`, { token }),
  getRiskProfiles: (token: string, filter: ProviderFilter = {}) => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v != null) params.set(k, String(v));
    });
    return request<PaginatedResponse<ProviderRiskProfile>>(
      `/api/v1/providers/risk-profiles?${params.toString()}`,
      { token }
    );
  },
};

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

export interface VisitFilter {
  page?: number;
  pageSize?: number;
  status?: string;
  riskLevel?: string;
  verificationResult?: string;
  providerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const visitsApi = {
  list: (token: string, filter: VisitFilter = {}) => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v != null) params.set(k, String(v));
    });
    return request<PaginatedResponse<Visit>>(
      `/api/v1/visits?${params.toString()}`,
      { token }
    );
  },
  get: (id: string, token: string) =>
    request<Visit>(`/api/v1/visits/${id}`, { token }),
};

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export interface AuditFilter {
  page?: number;
  pageSize?: number;
  action?: string;
  resourceType?: string;
  actorId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const auditApi = {
  list: (token: string, filter: AuditFilter = {}) => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v != null) params.set(k, String(v));
    });
    return request<PaginatedResponse<AuditLog>>(
      `/api/v1/audit?${params.toString()}`,
      { token }
    );
  },
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const reportsApi = {
  list: (token: string) =>
    request<PaginatedResponse<Report>>("/api/v1/reports", { token }),

  generate: (
    type: ReportType,
    format: ReportFormat,
    parameters: Record<string, unknown>,
    token: string
  ) =>
    request<Report>("/api/v1/reports", {
      method: "POST",
      body: { type, format, parameters },
      token,
    }),

  download: (id: string, token: string) =>
    request<{ url: string }>(`/api/v1/reports/${id}/download`, { token }),
};

"use client"

import { ErrorBoundary } from "@ashkarhq/react"
import { init } from "@ashkarhq/browser"

/**
 * Client-only error monitoring, isolated here so the root layout can stay a
 * server component. The SDK installs global handlers (fetch/XHR/console), so it
 * is initialized behind a `window` guard: the SSR pass of this client
 * component must never touch browser globals. Credentials come from
 * NEXT_PUBLIC_* env vars instead of being committed to source.
 */
const dsn = process.env.NEXT_PUBLIC_ASHKAR_DSN
const projectKey = process.env.NEXT_PUBLIC_ASHKAR_PROJECT_KEY
const environment = process.env.NEXT_PUBLIC_ASHKAR_ENVIRONMENT || "staging"

const ashkar =
  typeof window !== "undefined" && dsn && projectKey
    ? init({ dsn, projectKey, environment })
    : null

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  // Without credentials (or during SSR) this renders children unchanged.
  if (!ashkar) return <>{children}</>
  return <ErrorBoundary client={ashkar}>{children}</ErrorBoundary>
}
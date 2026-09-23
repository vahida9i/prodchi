import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { MonitoringProvider } from "@/components/monitoring-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Baaten - Product Skill Practice",
  description: "Work through product design scenarios, one decision at a time",
}

/**
 * Server component: metadata and fonts stay server-side; the monitoring SDK is
 * isolated in a client provider so browser-only code never runs during SSR.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <MonitoringProvider>{children}</MonitoringProvider>
      </body>
    </html>
  )
}
import type { Metadata } from "next"
import { Vazirmatn } from "next/font/google"
import { MonitoringProvider } from "@/components/monitoring-provider"
import "./globals.css"

const vazirmatn = Vazirmatn({ subsets: ["arabic", "latin"] })

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "پرودچی - تمرین و سنجش مهارت‌های محصول",
    description: "حل سناریوهای واقعی و تصمیم‌گیری گام‌به‌گام در محصول",
  }
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
    <html lang="fa" dir="rtl" className={vazirmatn.className}>
      <body className="min-h-screen bg-background antialiased">
        <MonitoringProvider>{children}</MonitoringProvider>
      </body>
    </html>
  )
}

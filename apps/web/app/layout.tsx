import type { Metadata } from "next"
import { Inter, Vazirmatn } from "next/font/google"
import { MonitoringProvider } from "@/components/monitoring-provider"
import { getLocale, getTranslations, isRtl } from "@/lib/i18n"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })
const vazirmatn = Vazirmatn({ subsets: ["arabic", "latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslations()
  return {
    title: t.appTitle,
    description: t.appDescription,
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
  const locale = getLocale()
  const dir = isRtl(locale) ? "rtl" : "ltr"
  const fontClass = locale === "fa" ? vazirmatn.className : inter.className

  return (
    <html lang={locale} dir={dir} className={fontClass}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <MonitoringProvider>{children}</MonitoringProvider>
      </body>
    </html>
  )
}

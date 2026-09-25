export type Locale = 'en' | 'fa'

export const DEFAULT_LOCALE: Locale = 'fa'

export function getLocale(): Locale {
  const envLocale =
    process.env.NEXT_PUBLIC_APP_LOCALE ||
    process.env.APP_LOCALE ||
    DEFAULT_LOCALE

  return envLocale === 'en' ? 'en' : 'fa'
}

export function isRtl(locale: Locale): boolean {
  return locale === 'fa'
}

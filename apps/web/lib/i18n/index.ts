import { getLocale, isRtl, Locale } from './config'
import { en, Translations } from './en'
import { fa } from './fa'

const dictionaries: Record<Locale, Translations> = {
  en,
  fa,
}

export function getTranslations(locale?: Locale): Translations {
  const currentLocale = locale ?? getLocale()
  return dictionaries[currentLocale] ?? dictionaries.fa
}

/** Format visible counts with Persian numerals while keeping API values numeric. */
export function digits(value: string | number): string {
  return String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
}

/**
 * Fills `{placeholder}` slots in a translation template:
 * `fmt(t.session.levelPassed, { n: 3 })`. Unknown placeholders are left intact
 * so a missing variable is visible instead of silently rendering as "".
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

export { getLocale, isRtl }
export type { Locale, Translations }

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Show counts in Persian without changing the numeric API values. */
export function digits(value: string | number): string {
  return String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
}

/** Fill placeholders in a sentence with visible values. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? (typeof vars[key] === 'number' ? digits(vars[key]) : String(vars[key])) : match
  )
}

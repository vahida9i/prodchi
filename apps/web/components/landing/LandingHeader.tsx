"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Route } from "lucide-react"

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)")
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false) }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [menuOpen])

  return (
    <header className="landing-header">
      <div className="landing-container landing-header-frame">
        <div className="landing-header-inner">
          <Link href="/" className="landing-brand" aria-label="پرودچی، صفحهٔ اصلی" onClick={() => setMenuOpen(false)}>
            <span className="landing-brand-mark" aria-hidden="true"><Route size={21} strokeWidth={1.6} /></span>
            <span>پرودچی</span>
          </Link>

          <nav className="landing-nav" aria-label="ناوبری صفحه">
            <a href="#how">چطور کار می‌کند</a>
            <a href="#paths">مسیرها</a>
          </nav>

          <div className="landing-header-actions">
            <Link href="/app/login" className="landing-login">ورود</Link>
            <Link href="/app/signup" className="landing-header-cta">
              <span>شروع رایگان</span>
              <span className="landing-header-cta-icon" aria-hidden="true">←</span>
            </Link>
            <button
              type="button"
              className={`landing-menu-toggle${menuOpen ? " is-open" : ""}`}
              aria-label={menuOpen ? "بستن فهرست" : "باز کردن فهرست"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMenuOpen(value => !value)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="landing-mobile-overlay" onClick={() => setMenuOpen(false)}>
          <nav id="landing-mobile-menu" className="landing-mobile-menu" aria-label="فهرست موبایل" onClick={event => event.stopPropagation()}>
            <a href="#how" onClick={() => setMenuOpen(false)}>چطور کار می‌کند <span aria-hidden="true">↖</span></a>
            <a href="#paths" onClick={() => setMenuOpen(false)}>مسیرها <span aria-hidden="true">↖</span></a>
            <Link href="/app/login" onClick={() => setMenuOpen(false)}>ورود به حساب <span aria-hidden="true">←</span></Link>
          </nav>
        </div>
      )}
    </header>
  )
}

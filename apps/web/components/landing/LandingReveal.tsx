"use client"

import { useEffect } from "react"

export function LandingReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".landing")
    if (!root || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const items = root.querySelectorAll<HTMLElement>(".landing-reveal")
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add("is-visible")
        observer.unobserve(entry.target)
      })
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.08 })

    items.forEach((item) => observer.observe(item))
    root.classList.add("landing-motion-ready")

    return () => {
      observer.disconnect()
      root.classList.remove("landing-motion-ready")
    }
  }, [])

  return null
}

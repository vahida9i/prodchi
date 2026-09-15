"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"

export default function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.getMe()
        router.push("/home")
      } catch {
        router.push("/login")
      }
    }
    checkAuth()
  }, [router])

  return null
}
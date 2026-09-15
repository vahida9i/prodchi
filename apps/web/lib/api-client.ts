const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new ApiError(response.status, error.error || 'Request failed', error.details)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // Auth
  signup(email: string, password: string) {
    return this.post<{ userId: string }>('/auth/signup', { email, password })
  }

  login(email: string, password: string) {
    return this.post<{ userId: string }>('/auth/login', { email, password })
  }

  logout() {
    return this.post<{ success: boolean }>('/auth/logout')
  }

  setRole(roleId: string) {
    return this.post<{ success: boolean }>('/auth/onboarding/role', { roleId })
  }

  getMe() {
    return this.get<{ user: { id: string; email: string; role: string; roleTrackId: string | null; cohortId: string | null } }>('/auth/me')
  }

  // Challenges
  getChallenges(tier?: string) {
    const params = tier ? `?tier=${tier}` : ''
    return this.get<{ challenges: Array<{ id: string; title: string; description: string; difficulty: number; estimatedMinutes: number; xpValue: number; skillIds: string[] }> }>(`/challenges${params}`)
  }

  getChallenge(id: string) {
    return this.get<{ id: string; title: string; description: string; difficulty: number; estimatedMinutes: number; xpValue: number; applicantSteps: any[]; skillIds: string[] }>(`/challenges/${id}`)
  }

  // Attempts
  createAttempt(challengeId: string) {
    return this.post<{ attemptId: string; step: any }>('/attempts', { challengeId })
  }

  answerAttempt(attemptId: string, stepIndex: number, optionId?: string, freeText?: string) {
    return this.post<{ nextStep: any | null }>(`/attempts/${attemptId}/answer`, { stepIndex, optionId, freeText })
  }

  completeAttempt(attemptId: string) {
    return this.post<{ assessment: any; xpEarned: number; leveledUp: boolean; newBadges: any[] }>(`/attempts/${attemptId}/complete`)
  }

  getAttempt(attemptId: string) {
    return this.get<{ id: string; challengeId: string; startedAt: string; completedAt: string | null; path: any[]; assessment: any; xpEarned: number | null }>(`/attempts/${attemptId}`)
  }

  // Profile
  getProfile() {
    return this.get<{
      profile: { overallScore: number; skillBreakdown: any[]; challengesCompleted: number; caseStudiesCompleted: number; updatedAt: string }
      streak: { currentStreak: number; longestStreak: number; lastActiveDay: string | null }
      level: number
      totalXp: number
      badges: Array<{ id: string; name: string; description: string; iconRef: string; earnedAt: string }>
    }>('/profile')
  }

  getLeaderboard() {
    return this.get<{ leaderboard: Array<{ rank: number; userId: string; email: string; weeklyXp: number }>; userRank: { rank: number; weeklyXp: number } | null }>('/profile/leaderboard')
  }

  getBadges() {
    return this.get<{ badges: Array<{ id: string; name: string; description: string; iconRef: string; unlockCondition: any; earned: boolean; earnedAt: string | null }> }>('/profile/badges')
  }

  // Admin
  createSkillCategory(data: { name: string; roleId: string; order?: number }) {
    return this.post<any>('/admin/skill-categories', data)
  }

  updateSkillCategory(id: string, data: { name?: string; order?: number }) {
    return this.patch<any>(`/admin/skill-categories/${id}`, data)
  }

  deleteSkillCategory(id: string) {
    return this.delete<any>(`/admin/skill-categories/${id}`)
  }

  createSkill(data: { name: string; skillCategoryId: string; order?: number; unlockThreshold?: number | null }) {
    return this.post<any>('/admin/skills', data)
  }

  updateSkill(id: string, data: { name?: string; order?: number; unlockThreshold?: number | null }) {
    return this.patch<any>(`/admin/skills/${id}`, data)
  }

  deleteSkill(id: string) {
    return this.delete<any>(`/admin/skills/${id}`)
  }

  importChallenge(data: any) {
    return this.post<{ challengeId: string }>('/admin/challenges/import', data)
  }

  getAdminChallenges(status?: string) {
    const params = status ? `?status=${status}` : ''
    return this.get<{ challenges: any[] }>(`/admin/challenges${params}`)
  }

  getAdminChallenge(id: string) {
    return this.get<any>(`/admin/challenges/${id}`)
  }

  updateChallengeStatus(id: string, status: 'draft' | 'published') {
    return this.patch<any>(`/admin/challenges/${id}/status`, { status })
  }

  deleteChallenge(id: string) {
    return this.delete<any>(`/admin/challenges/${id}`)
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = new ApiClient()
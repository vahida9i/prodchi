const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

export interface SanitizedQuestion {
  key: string
  text: string
  choices: Array<{ index: number; text: string }>
}

export interface RevealTable {
  caption?: string
  columns: string[]
  rows: string[][]
}

/**
 * What a choice reveals: prose, a data table, or both. The API always sends the
 * normalized block, and the renderer tolerates a bare string so nothing breaks
 * if a payload predates the table format.
 */
export interface RevealBlock {
  text?: string
  table?: RevealTable
}

export type AuthoredReveal = string | RevealBlock

export interface SessionHistoryEntry {
  questionText: string
  choiceText: string
  reveal: RevealBlock
}

// ---------------------------------------------------------------------------
// End-of-run feedback (deterministic, rule-based — mirrors
// @baaten/shared-types/feedback evaluateRun, frozen on the session at
// completion)
// ---------------------------------------------------------------------------

export type FeedbackVerdict = 'strongest' | 'reasonable' | 'missed'
export type FeedbackHeadline = 'strong' | 'solid' | 'mixed' | 'struggled'
export type FeedbackTrajectory = 'finished-stronger' | 'steady' | 'faded'

export interface FeedbackArea {
  area: string
  count: number
  bestHits: number
  reasonableCalls: number
  rate: number
  evidence: string
}

export interface FeedbackGrowth {
  area: string
  evidence: string
  atQuestion: string
  questionText: string
  strongest: { text: string; because?: string }
}

export interface QuestionFeedback {
  key: string
  questionText: string
  chosenText: string
  verdict: FeedbackVerdict
  area: string
  mismatch: boolean
  strongest: { text: string; because?: string } | null
}

export interface DimensionFeedback {
  id: string
  label: string
  guidance: string
  count: number
  bestHits: number
  rate: number
  evidence: string
  status: 'strength' | 'growth' | 'neutral'
}

export interface FeedbackReport {
  headline: FeedbackHeadline
  rate: number
  strengths: FeedbackArea[]
  growth: FeedbackGrowth[]
  /** Unit layer: the rubric strands in declared order, or [] when unrubriced. */
  dimensions: DimensionFeedback[]
  traversal: { steps: number; strongestRunSteps: number; earlyExit: boolean }
  trajectory: FeedbackTrajectory
  perQuestion: QuestionFeedback[]
}

export interface LevelProgressInfo {
  status: 'locked' | 'unlocked' | 'passed'
  bestStars: number
  bestXp: number
  xpEarned: number
  attempts: number
  /** The level's latest finished run — what the recap link opens; null if none. */
  lastSessionId: string | null
}

export interface LevelOnPath {
  id: string
  number: number
  title: string
  /** Authored brief on the business and its customers — shown before the run. */
  summary: string | null
  industry: { id: string; name: string }
  difficulty: 'easy' | 'medium' | 'hard'
  type: 'challenge' | 'single_question'
  xpPerBest: number
  progress: LevelProgressInfo
}

/** The completion payload the API returns when a level session reaches END. */
export interface LevelCompletion {
  hits: number
  answered: number
  accuracy: number
  stars: number
  /** XP credited to the level (first-pass value; unchanged by replays). */
  xpEarned: number
  /** XP this run added to the account — 0 when replaying a passed level. */
  xpGained: number
  bestXp: number
  bestStars: number
  attempts: number
  firstPass: boolean
  levelNumber: number
  nextLevelNumber: number | null
  totalXp: number
  playerLevel: number
  leveledUp: boolean
  streak: { currentStreak: number; longestStreak: number }
  newBadges: Array<{ id: string; name: string; description: string; iconRef: string }>
}

export interface ProgressSummary {
  totalXp: number
  playerLevel: number
  levelsPassed: number
  levelsTotal: number
  totalStars: number
  accuracy: number
  streak: { currentStreak: number; longestStreak: number; lastActiveDay: string | null }
  industries: Array<{
    id: string
    name: string
    levelsTotal: number
    levelsPassed: number
    stars: number
    completed: boolean
  }>
}

export interface BadgeInfo {
  id: string
  name: string
  description: string
  iconRef: string
  unlockCondition: { type?: string; threshold?: number; industryId?: string }
  earned: boolean
  earnedAt: string | null
}

export interface Leaderboard {
  leaderboard: Array<{ rank: number; userId: string; player: string; weeklyXp: number }>
  userRank: { rank: number; weeklyXp: number } | null
}

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
      const body = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new ApiError(
        response.status,
        body.error || (Array.isArray(body.errors) ? 'Validation failed' : 'Request failed'),
        body.details,
        Array.isArray(body.errors) ? body.errors : undefined
      )
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

  // Sessions (guided candidate session engine)
  answerSession(sessionId: string, choiceIndex: number) {
    return this.post<{ reveal: RevealBlock; question: SanitizedQuestion | null; status: 'in_progress' | 'completed'; result: LevelCompletion | null }>(`/sessions/${sessionId}/answer`, { choiceIndex })
  }

  getSession(sessionId: string) {
    return this.get<{
      id: string
      challengeId: string
      challengeTitle: string
      /** Authored brief on the business — shown under the title on the challenge screen. */
      summary: string | null
      status: 'in_progress' | 'completed'
      answeredCount: number
      startedAt: string
      completedAt: string | null
      question: SanitizedQuestion | null
      history: SessionHistoryEntry[]
    }>(`/sessions/${sessionId}`)
  }

  getSessionSummary(sessionId: string) {
    return this.get<{
      id: string
      challengeTitle: string
      completedAt: string
      levelNumber: number | null
      score: { hits: number; answered: number; accuracy: number; xp: number; stars: number } | null
      feedback: FeedbackReport | null
      path: SessionHistoryEntry[]
    }>(`/sessions/${sessionId}/summary`)
  }

  // Level path (progression + gamification)
  getLevels() {
    return this.get<{ levels: LevelOnPath[] }>('/levels')
  }

  startLevel(levelId: string) {
    return this.post<{ sessionId: string; resumed: boolean; status: string; question: SanitizedQuestion | null; level: { id: string; number: number; type: string } }>(`/levels/${levelId}/start`)
  }

  getProgress() {
    return this.get<ProgressSummary>('/progress')
  }

  getBadges() {
    return this.get<{ badges: BadgeInfo[] }>('/progress/badges')
  }

  getLeaderboard() {
    return this.get<Leaderboard>('/progress/leaderboard')
  }
  // Roles (onboarding)
  getRoles() {
    return this.get<{ roles: Array<{ id: string; name: string }> }>('/roles')
  }

  // Admin: challenges
  importChallenge(data: unknown) {
    return this.post<{ challengeId: string; type: string; updated: boolean }>('/admin/challenges/import', data)
  }

  getAdminChallenges(status?: 'active' | 'retired') {
    const params = status ? `?status=${status}` : ''
    return this.get<{ challenges: Array<{ id: string; importKey: string; title: string; difficulty: 'easy' | 'medium' | 'hard'; status: 'active' | 'retired'; createdAt: string }> }>(`/admin/challenges${params}`)
  }

  getAdminChallenge(id: string) {
    return this.get<{
      id: string
      importKey: string
      title: string
      /** Role name, so the internal view can be pasted straight back into an update. */
      role: string
      difficulty: string
      startKey: string
      questions: Record<string, {
        text: string
        bestChoice: number
        choices: Array<{
          text: string
          stage: string
          reveal: RevealBlock
          next: string
          /** Per-choice grading tier — best / reasonable / poor; absent on untagged (legacy) choices. */
          quality?: 'best' | 'reasonable' | 'poor'
          /** One-line reason why this choice is best; shown in miss-feedback. */
          because?: string
          /** Which rubric strands this choice exercises, by criterion id. */
          criteria?: string[]
        }>
      }>
      /** Unit-layer rubric (optional): what the challenge assesses, in its own vocabulary. */
      assessment?: {
        criteria: Array<{ id: string; label: string; guidance: string }>
      }
      status: string
      createdAt: string
      updatedAt: string
    }>(`/admin/challenges/${id}`)
  }

  updateChallengeStatus(id: string, status: 'active' | 'retired') {
    return this.patch<{ id: string; status: string }>(`/admin/challenges/${id}/status`, { status })
  }

  deleteChallenge(id: string) {
    return this.delete<{ success: boolean }>(`/admin/challenges/${id}`)
  }

  // Admin: failed import history
  getFailedImports() {
    return this.get<{
      failedImports: Array<{
        id: string
        createdAt: string
        errors: Array<{ path: string; message: string }>
        summary: { id: string | null; title: string | null; questionCount: number | null }
      }>
    }>('/admin/imports')
  }

  // Admin: level path + industries
  getAdminLevels() {
    return this.get<{
      levels: Array<{
        id: string
        number: number
        industry: { id: string; name: string }
        difficulty: 'easy' | 'medium' | 'hard'
        type: 'challenge' | 'single_question'
        status: 'active' | 'retired'
        challenge: { id: string; importKey: string; title: string; status: string }
        playerCount: number
      }>
    }>('/admin/levels')
  }

  /** Imported, active challenges that are not assigned to a level yet. */
  getUnassignedChallenges() {
    return this.get<{
      challenges: Array<{ id: string; importKey: string; title: string; difficulty: 'easy' | 'medium' | 'hard'; type: 'challenge' | 'single_question' }>
    }>('/admin/levels/unassigned')
  }

  createLevel(data: { number: number; industryId: string; difficulty: string; challengeId: string }) {
    return this.post<{ id: string; number: number; type: string }>('/admin/levels', data)
  }

  updateLevel(id: string, data: { number?: number; industryId?: string; difficulty?: string; status?: 'active' | 'retired' }) {
    return this.patch<{ id: string; number: number; status: string; difficulty: string }>(`/admin/levels/${id}`, data)
  }

  deleteLevel(id: string) {
    return this.delete<{ success: boolean }>(`/admin/levels/${id}`)
  }

  getIndustries() {
    return this.get<{ industries: Array<{ id: string; name: string; order: number; levelCount: number }> }>('/admin/industries')
  }

  createIndustry(name: string, order: number = 0) {
    return this.post<{ id: string; name: string; order: number }>('/admin/industries', { name, order })
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any,
    /** Itemized `{ path, message }` reasons from import-style failures. */
    public errors?: Array<{ path: string; message: string }>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = new ApiClient()
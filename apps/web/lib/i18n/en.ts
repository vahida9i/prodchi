export interface Translations {
  appName: string
  appTitle: string
  appDescription: string
  nav: {
    home: string
    progress: string
    profile: string
    admin: string
    signOut: string
    switchTrack: string
    level: string
    stars: string
    xp: string
    streak: string
    days: string
  }
  auth: {
    signIn: string
    signUp: string
    createAccount: string
    email: string
    password: string
    emailPlaceholder: string
    noAccount: string
    hasAccount: string
    onboardingTitle: string
    onboardingSubtitle: string
    continue: string
    errorInvalidCredentials: string
    errorGeneral: string
  }
  roles: {
    defaultDescription: string
    byName: {
      'Product Design': { name: string; description: string }
      'Product Management': { name: string; description: string }
    }
  }
  path: {
    title: string
    subtitle: string
    startLevel: string
    resumeLevel: string
    completed: string
    locked: string
    singleQuestionBadge: string
    scenarioBadge: string
    unlockedBadge: string
    empty: string
    lockedLevelAria: string
    levelAria: string
    difficulties: { easy: string; medium: string; hard: string }
  }
  session: {
    step: string
    of: string
    exit: string
    confirmChoice: string
    submitting: string
    outcome: string
    consequenceNotice: string
    nextStep: string
    finishScenario: string
    answered: string
    leave: string
    questionNumber: string
    sessionComplete: string
    whatYouFound: string
    findingsRecap: string
    loadError: string
    submitError: string
    invalidState: string
    levelPassed: string
    levelAttempt: string
    bestCalls: string
    xpAwarded: string
    noNewXp: string
    xpTotal: string
    leveledUp: string
    newBadges: string
    nextLevelUnlocked: string
    fullPathOnSummary: string
    takeYourTime: string
    viewSummary: string
    backToPath: string
    continue: string
  }
  summary: {
    title: string
    subtitle: string
    xpEarned: string
    starsEarned: string
    accuracy: string
    reviewPath: string
    continuePath: string
    retry: string
    overallStrength: string
    overallWeakness: string
    whatToTryNext: string
    cardTitle: string
    levelBadge: string
    bestCallsBadge: string
    xpBadge: string
    reasoningRecord: string
    completedAt: string
    noAssessment: string
    noSteps: string
    pathRecap: string
    youChose: string
    notFound: string
    backToLibrary: string
    notCompletedYet: string
    loadError: string
    walk: string
    walkEarly: string
    headlines: { strong: string; solid: string; mixed: string; struggled: string }
    trajectories: { 'finished-stronger': string; steady: string; faded: string }
    tones: { strength: string; growth: string; steady: string; unused: string }
    report: {
      strengthLead: string
      strengthLeadWithRest: string
      strengthNoStandout: string
      strengthNone: string
      weaknessGaps: string
      weaknessNoneHigh: string
      weaknessNoneMid: string
      earlyExit: string
      faded: string
      nothingToFix: string
      strongestMove: string
      strongestMoveBecause: string
      listSeparator: string
      listJoin: string
    }
  }
  progress: {
    title: string
    subtitle: string
    trackSkills: string
    badgesTitle: string
    noBadges: string
    levelsPassed: string
    totalXP: string
    currentStreak: string
    proficiencies: { strong: string; developing: string; emerging: string; unproven: string }
    loadError: string
    scopeWithRole: string
    scopeDefault: string
    totalXPWithLevel: string
    accuracyLabel: string
    streakTitle: string
    dayStreak: string
    longestLabel: string
    streakNote: string
    day: string
    days: string
    industriesTitle: string
    levelsPassedOf: string
    leaderboardTitle: string
    leaderboardRowXp: string
    leaderboardYou: string
    leaderboardEmpty: string
    earned: string
    earnedOn: string
  }
  profile: {
    title: string
    emailLabel: string
    roleLabel: string
    joinedLabel: string
    actions: string
    loadError: string
    skillProfileTitle: string
    statsLine: string
    buildsAsYouPlay: string
    emptyPrompt: string
    goToPath: string
    strongCallRate: string
    decisionsGraded: string
    scenariosFinished: string
    skillsTitleWithRole: string
    skillsTitleDefault: string
    scopedWithRole: string
    scopedDefault: string
    radarCaption: string
    radarAria: string
    strengthsTitle: string
    growthTitle: string
    allSkillsTitle: string
    notYetObserved: string
    needsMoreEvidence: string
    unprovenLabel: string
  }
  admin: {
    title: string
    importTab: string
    challengesTab: string
    levelsTab: string
    failedTab: string
    pasteJson: string
    importButton: string
    importing: string
    successImport: string
  }
}

export const en: Translations = {
  appName: 'Prodchi',
  appTitle: 'Prodchi - Product Skill Practice',
  appDescription: 'Work through product scenarios, one decision at a time',
  
  // Navigation & User Shell
  nav: {
    home: 'Path',
    progress: 'Skills & Badges',
    profile: 'Profile',
    admin: 'Admin',
    signOut: 'Sign Out',
    switchTrack: 'Switch Track',
    level: 'Level',
    stars: 'Stars',
    xp: 'XP',
    streak: 'Streak',
    days: 'days',
  },

  // Auth & Onboarding
  auth: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    createAccount: 'Create Account',
    email: 'Email',
    password: 'Password',
    emailPlaceholder: 'you@example.com',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    onboardingTitle: 'Choose Your Practice Track',
    onboardingSubtitle: 'Select the role you want to practice. You can switch tracks at any time.',
    continue: 'Continue',
    errorInvalidCredentials: 'Invalid email or password',
    errorGeneral: 'Something went wrong. Please try again.',
  },

  // Role names and descriptions
  roles: {
    defaultDescription: 'Practice real-world decisions your role faces every day.',
    byName: {
      'Product Design': {
        name: 'Product Design',
        description: 'User research, wireframing, visual design, usability testing, and UX problem solving.',
      },
      'Product Management': {
        name: 'Product Management',
        description: 'Diagnosis, product strategy, prioritization, roadmapping, and business metrics.',
      },
    },
  },

  // Home / Path Map
  path: {
    title: 'Your Progression Path',
    subtitle: 'Solve realistic challenges step-by-step. Each choice impacts your outcome.',
    startLevel: 'Start',
    resumeLevel: 'Resume',
    completed: 'Completed',
    locked: 'Locked',
    singleQuestionBadge: 'Quick Call',
    scenarioBadge: 'Scenario',
    unlockedBadge: 'Next Up',
    empty: 'No levels on the path yet. Check back soon!',
    lockedLevelAria: 'Locked level',
    levelAria: 'Level {n}',
    difficulties: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  },

  // Session Runner
  session: {
    step: 'Decision',
    of: 'of',
    exit: 'Exit Scenario',
    confirmChoice: 'Confirm Decision',
    submitting: 'Submitting...',
    outcome: 'Outcome',
    consequenceNotice: 'Review the outcome before making your next move.',
    nextStep: 'Next Decision',
    finishScenario: 'View Evaluation',
    answered: '{n} answered',
    leave: 'Leave',
    questionNumber: 'Question {n}',
    sessionComplete: 'Session complete',
    whatYouFound: 'What you found',
    findingsRecap: 'What you have found',
    loadError: 'Failed to load session',
    submitError: 'Failed to submit answer',
    invalidState: 'This session is in an invalid state. Start the challenge again from the library.',
    levelPassed: 'Level {n} passed',
    levelAttempt: 'Level {n} — attempt {m}',
    bestCalls: '{hits}/{answered} best calls',
    xpAwarded: '+{xp} XP',
    noNewXp: 'no new XP (best run {xp} XP)',
    xpTotal: '{xp} XP total',
    leveledUp: 'You reached player level {n}!',
    newBadges: 'New badges',
    nextLevelUnlocked: 'Level {n} is unlocked — find it on your path.',
    fullPathOnSummary: 'Your full reasoning path is on the summary.',
    takeYourTime: 'Take your time — continue when you are ready.',
    viewSummary: 'View summary',
    backToPath: 'Back to path',
    continue: 'Continue',
  },

  // Run Summary & Evaluation
  summary: {
    title: 'Your Run, Assessed',
    subtitle: 'Deterministic, rule-based feedback on your reasoning and decision path.',
    xpEarned: 'XP Earned',
    starsEarned: 'Stars',
    accuracy: 'Accuracy',
    reviewPath: 'Review Decision Path',
    continuePath: 'Continue on Path',
    retry: 'Play Again',
    overallStrength: 'Key Strength',
    overallWeakness: 'Growth Opportunity',
    whatToTryNext: 'What to Try Next',
    cardTitle: 'Session Summary',
    levelBadge: 'Level {n}',
    bestCallsBadge: '{hits}/{answered} best calls',
    xpBadge: '+{xp} XP',
    reasoningRecord: 'A record of your reasoning path',
    completedAt: 'Completed {date}',
    noAssessment: 'This run has no assessment attached — the path below is the whole record.',
    noSteps: 'No steps recorded.',
    pathRecap: 'Your path, step by step ({n})',
    youChose: 'You chose: {text}',
    notFound: 'Summary not found',
    backToLibrary: 'Back to library',
    notCompletedYet: 'This session is not completed yet.',
    loadError: 'Failed to load summary',
    walk: 'Your walk: {steps} steps · the strongest run takes {strongest}.',
    walkEarly: 'Your walk: {steps} steps · the strongest run takes {strongest} — you wrapped up early.',
    headlines: {
      strong: 'Strong Run',
      solid: 'Solid, with gaps',
      mixed: 'Mixed Run',
      struggled: 'A Difficult Run',
    },
    trajectories: {
      'finished-stronger': 'You finished stronger than you started.',
      steady: 'Steady reasoning throughout the run.',
      faded: 'You started stronger than you finished.',
    },
    tones: {
      strength: 'Strength',
      growth: 'Growth Area',
      steady: 'Steady',
      unused: 'Not Exercised',
    },
    report: {
      strengthLead: 'Your strongest ground was {lead} ({result}).',
      strengthLeadWithRest: 'Your strongest ground was {lead} ({result}); {rest} held up too.',
      strengthNoStandout: 'No single strand stood out, but you kept the run defensible end to end ({rate}% weighted).',
      strengthNone: 'No strand came through as a strength on this run ({rate}% weighted).',
      weaknessGaps: 'The weak ground was {labels} — where a defensible call was available and the run took it instead of the strongest move.',
      weaknessNoneHigh: 'No clear weak spot: the calls open to you were the strongest ones.',
      weaknessNoneMid: 'Nothing fell apart, but no strand locked in — the run stayed in the middle.',
      earlyExit: 'You finished in {steps} steps where the strongest run takes {strongest} — the steps you skipped are usually the diagnostic ones.',
      faded: 'Your later calls were weaker than your opening ones — give the end of the run the same care as the start.',
      nothingToFix: 'Nothing to fix on this run — replay it for stars, or take the next level.',
      strongestMove: 'The strongest move was: {text}',
      strongestMoveBecause: 'The strongest move was: {text} — {because}',
      listSeparator: ', ',
      listJoin: ' and ',
    },
  },

  // Skills & Progress
  progress: {
    title: 'Skill Profile',
    subtitle: 'Measured from how you actually answered scenario decisions.',
    trackSkills: 'Track Competencies',
    badgesTitle: 'Earned Badges',
    noBadges: 'No badges unlocked yet. Keep progressing along the path!',
    levelsPassed: 'Levels Passed',
    totalXP: 'Total XP',
    currentStreak: 'Current Streak',
    proficiencies: {
      strong: 'Strong',
      developing: 'Developing',
      emerging: 'Emerging',
      unproven: 'Unproven',
    },
    loadError: 'Failed to load progress',
    scopeWithRole: 'Showing {role} progress — XP, streak, badges and leaderboard are per-track.',
    scopeDefault: 'Showing your current track — XP, streak, badges and leaderboard are per-track.',
    totalXPWithLevel: 'Total XP · level {level}',
    accuracyLabel: 'Best-call accuracy',
    streakTitle: 'Streak',
    dayStreak: '{n}-day streak',
    longestLabel: 'Longest: {n} {unit}',
    streakNote: 'a day counts when a level is passed.',
    day: 'day',
    days: 'days',
    industriesTitle: 'Industries',
    levelsPassedOf: '{passed}/{total} levels passed',
    leaderboardTitle: 'Weekly leaderboard',
    leaderboardRowXp: '{xp} XP',
    leaderboardYou: 'You: #{rank} with {xp} XP this week',
    leaderboardEmpty: 'No XP earned in your cohort this week yet.',
    earned: 'earned',
    earnedOn: 'Earned {date}',
  },

  // Profile Page
  profile: {
    title: 'Account & Progression',
    emailLabel: 'Email Address',
    roleLabel: 'Active Role Track',
    joinedLabel: 'Member Since',
    actions: 'Actions',
    loadError: 'Failed to load your profile',
    skillProfileTitle: 'Your skill profile',
    statsLine: 'Based on {decisions} decisions across {scenarios} finished scenarios — every number is how consistently your calls were the strongest ones.',
    buildsAsYouPlay: 'Your profile builds as you play.',
    emptyPrompt: "Complete a level to see your first capabilities. Your choices are graded against the scenario's answer key — the profile grows one honest decision at a time.",
    goToPath: 'Go to your path',
    strongCallRate: 'strong-call rate',
    decisionsGraded: 'decisions graded',
    scenariosFinished: 'scenarios finished',
    skillsTitleWithRole: '{role} skills',
    skillsTitleDefault: "Your role's skills",
    scopedWithRole: 'Scoped to {role} — switching tracks switches this profile.',
    scopedDefault: 'Scoped to your current track — switching tracks switches this profile.',
    radarCaption: 'Each axis is one skill; the filled shape is how consistently your calls were the strongest ones. Skills with no decisions yet sit at the center.',
    radarAria: "Radar chart of the role's skills",
    strengthsTitle: 'Strengths',
    growthTitle: 'Where you lose ground',
    allSkillsTitle: 'All skills',
    notYetObserved: 'not yet observed',
    needsMoreEvidence: 'needs more evidence',
    unprovenLabel: 'Not yet observed',
  },

  // Admin
  admin: {
    title: 'Challenge Administration',
    importTab: 'Import JSON',
    challengesTab: 'All Challenges',
    levelsTab: 'Level Path',
    failedTab: 'Import Errors',
    pasteJson: 'Paste Challenge JSON',
    importButton: 'Validate & Import',
    importing: 'Importing...',
    successImport: 'Challenge imported successfully!',
  },
}


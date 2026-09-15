# Baaten - Product Design Skill Practice App

A skill-practice application for Product Designers with AI-powered assessment.

## Architecture

- **Web App**: Next.js 14+ (App Router), TypeScript, React, Tailwind CSS, shadcn/ui
- **API Server**: Node.js, TypeScript, Fastify
- **Database**: PostgreSQL 15+, Prisma ORM
- **Assessment**: Anthropic API (Claude)

## Project Structure

```
baaten/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Fastify API server
├── packages/
│   ├── db/           # Prisma schema, migrations, seed
│   └── shared-types/ # Zod schemas, validators, rubrics
└── docs/
    └── challenge-generator-prompt.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and other secrets

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed the database
pnpm db:seed
```

### Development

```bash
# Start all services
pnpm dev

# Or start individually:
# API: pnpm --filter api dev
# Web: pnpm --filter web dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session cookies |
| `ANTHROPIC_API_KEY` | Anthropic API key for assessments |
| `ADMIN_SEED_EMAIL` | Initial admin email |
| `ADMIN_SEED_PASSWORD` | Initial admin password |
| `NEXT_PUBLIC_API_URL` | API URL for frontend |
| `WEB_URL` | Frontend URL for CORS |
| `PORT` | API server port (default: 4000) |

## API Endpoints

### Auth
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/onboarding/role` - Select role (one-time)

### Challenges (User)
- `GET /api/v1/challenges` - List published challenges
- `GET /api/v1/challenges/:id` - Get challenge details

### Attempts
- `POST /api/v1/attempts` - Start new attempt
- `POST /api/v1/attempts/:id/answer` - Submit answer
- `POST /api/v1/attempts/:id/complete` - Complete & assess
- `GET /api/v1/attempts/:id` - Get attempt state

### Profile
- `GET /api/v1/profile` - Get capability profile, streak, badges
- `GET /api/v1/profile/leaderboard` - Weekly leaderboard
- `GET /api/v1/profile/badges` - All badges with earned status

### Admin: Skills
- `POST /api/v1/admin/skill-categories` - Create category
- `PATCH /api/v1/admin/skill-categories/:id` - Update category
- `DELETE /api/v1/admin/skill-categories/:id` - Delete category
- `POST /api/v1/admin/skills` - Create skill
- `PATCH /api/v1/admin/skills/:id` - Update skill
- `DELETE /api/v1/admin/skills/:id` - Delete skill

### Admin: Challenges
- `POST /api/v1/admin/challenges/import` - Import challenge JSON
- `GET /api/v1/admin/challenges` - List challenges (filter by status)
- `GET /api/v1/admin/challenges/:id` - Full challenge view
- `PATCH /api/v1/admin/challenges/:id/status` - Publish/unpublish
- `DELETE /api/v1/admin/challenges/:id` - Delete (if no attempts)

## Challenge Import Format

See `packages/shared-types/challenge-schema.ts` for the full Zod schema.

Key requirements:
- `metadata`: title, description, estimatedMinutes, roleId, difficulty (1-5), tier (free/pro), xpValue, skillIds[]
- `hiddenCase`: Server-only context (company, product, problem, etc.)
- `applicantSteps[]`: Client-facing steps with stage, inputType, context, question, options
- `answerSheet[]`: Server-only scoring with reasoningSignal, consequence, reveal, nextStepIndex

## Phases

1. **Phase 0**: Repo, DB, seed
2. **Phase 1**: Auth + role gating
3. **Phase 2**: Admin API: skills + import
4. **Phase 3**: Admin UI
5. **Phase 4**: User-facing challenge/attempt API
6. **Phase 5**: Assessment Service (Anthropic)
7. **Phase 6**: Gamification + CapabilityProfile
8. **Phase 7**: User-facing frontend
9. **Phase 8**: Leaderboard + badge list

## Testing

```bash
# Run tests (when implemented)
pnpm test
```

## Deployment

Build the API and web apps separately:

```bash
pnpm build
```

## License

MIT
# ---------------------------------------------------------------------------
# Prodchi — Docker + task orchestration
#
# Targets for GNU Make 3.81, which is what macOS ships with the Xcode Command
# Line Tools: no .ONESHELL, no $(file ...), no != assignments.
#
#   make           this help
#   make doctor    check docker/compose/daemon + host port conflicts
#   make up        dev stack  (HMR, bind mounts)
#   make up-prod   prod stack (built images, no mounts)
# ---------------------------------------------------------------------------

SHELL := /bin/sh

ENV_FILE ?= .env.docker
COMPOSE  ?= docker compose --env-file $(ENV_FILE)

# The base file is prod-shaped; the dev overlay layers bind mounts + HMR on top.
COMPOSE_PROD := $(COMPOSE) -f docker-compose.yml
COMPOSE_DEV  := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml

# The recipes need a few of the same values Compose interpolates. A leading '-'
# keeps make quiet when the file does not exist yet; the ?= lines then supply
# defaults, so every target works on a fresh clone.
-include $(ENV_FILE)

POSTGRES_USER     ?= postgres
POSTGRES_PASSWORD ?= postgres
POSTGRES_DB       ?= prodchi
DB_PORT           ?= 5433
API_PORT          ?= 4000
WEB_PORT          ?= 3000

.DEFAULT_GOAL := help

.PHONY: help env doctor install up up-prod down restart logs ps build \
        migrate seed reset-content db-reset psql shell-api shell-web \
        typecheck test e2e clean nuke

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
help: ## Show this help
	@echo "Prodchi — task runner"
	@echo ""
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(firstword $(MAKEFILE_LIST))
	@echo ""
	@echo "  Dev stack : make up       (HMR, source edits apply live)"
	@echo "  Prod stack: make up-prod  (built images, no bind mounts)"

env: ## Create a host .env from .env.example when missing (for the pnpm flows)
	@if [ -f .env ]; then \
		echo ".env already exists"; \
	else \
		cp .env.example .env; \
		echo "created .env from .env.example"; \
	fi
	@[ -f $(ENV_FILE) ] || echo "warning: $(ENV_FILE) is missing — Compose will use its inline defaults"

doctor: ## Preflight: docker, compose, daemon, env file and host port conflicts
	@echo "--- tooling ---"
	@command -v docker >/dev/null 2>&1 && echo "docker:   $$(docker --version)" || { echo "docker:   MISSING — install Docker Desktop or colima"; exit 1; }
	@docker compose version >/dev/null 2>&1 && echo "compose:  v$$(docker compose version --short)" || { echo "compose:  MISSING — the docker compose plugin is required"; exit 1; }
	@docker info >/dev/null 2>&1 && echo "daemon:   running" || { echo "daemon:   NOT running — start Docker Desktop"; exit 1; }
	@echo "--- config ---"
	@[ -f $(ENV_FILE) ] && echo "$(ENV_FILE): present" || echo "$(ENV_FILE): missing (inline defaults in use)"
	@echo "--- host ports (web/api/db) ---"
	@for p in $(WEB_PORT) $(API_PORT) $(DB_PORT); do \
		if lsof -nP -iTCP:$$p -sTCP:LISTEN >/dev/null 2>&1; then \
			echo "port $$p: IN USE — change WEB_PORT/API_PORT/DB_PORT in $(ENV_FILE)"; \
		else \
			echo "port $$p: free"; \
		fi; \
	done

install: ## Install workspace dependencies with pnpm (host, not Docker)
	pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stacks
# ---------------------------------------------------------------------------
up: ## Start the dev stack (HMR, bind mounts; builds images on first run)
	$(COMPOSE_DEV) up -d --build

up-prod: ## Start the prod-style stack (built images, no bind mounts)
	$(COMPOSE_PROD) up -d --build

down: ## Stop and remove the stack's containers (volumes are kept)
	$(COMPOSE_DEV) down --remove-orphans

restart: ## Restart the stack's containers
	$(COMPOSE_DEV) restart

logs: ## Tail logs — SVC=api|web|db (all services when SVC is unset)
	$(COMPOSE_DEV) logs -f $(SVC)

ps: ## Show container status
	$(COMPOSE_DEV) ps

build: ## Build the prod and dev images
	$(COMPOSE_PROD) build
	$(COMPOSE_DEV) build

# ---------------------------------------------------------------------------
# Database / content (one-shot `tools` containers)
#
# These come from the BASE file on purpose: no bind mount, so the repo's .env
# files are absent and the explicit environment wins. packages/db/seed.ts would
# otherwise let a mounted packages/db/.env override DATABASE_URL.
# ---------------------------------------------------------------------------
migrate: ## Apply Prisma migrations (starts db first if needed)
	$(COMPOSE_PROD) up -d db
	$(COMPOSE_PROD) --profile tools run --rm migrate

seed: ## Seed roles, industries, badges and the admin user
	$(COMPOSE_PROD) up -d db
	$(COMPOSE_PROD) --profile tools run --rm seed

reset-content: ## Import the fixtures and lay out the level path (API must be up)
	$(COMPOSE_PROD) up -d db
	$(COMPOSE_PROD) --profile tools run --rm reset-content

db-reset: ## Drop and recreate the database, then migrate + seed (DESTRUCTIVE)
	@echo "Dropping and recreating database \"$(POSTGRES_DB)\"…"
	$(COMPOSE_PROD) up -d db
	$(COMPOSE_PROD) exec -T db psql -U $(POSTGRES_USER) -d postgres \
		-c "DROP DATABASE IF EXISTS \"$(POSTGRES_DB)\" WITH (FORCE);" \
		-c "CREATE DATABASE \"$(POSTGRES_DB)\";"
	@$(MAKE) --no-print-directory migrate
	@$(MAKE) --no-print-directory seed

psql: ## Open a psql shell on the db service (interactive)
	$(COMPOSE_PROD) exec db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

# ---------------------------------------------------------------------------
# Shells
# ---------------------------------------------------------------------------
shell-api: ## Open a shell in the running api container
	$(COMPOSE_DEV) exec api sh

shell-web: ## Open a shell in the running web container
	$(COMPOSE_DEV) exec web sh

# ---------------------------------------------------------------------------
# Checks (host-side pnpm; the suites need no container)
# ---------------------------------------------------------------------------
typecheck: ## Typecheck every workspace package
	pnpm typecheck

test: ## Run the shared-types unit suite
	pnpm --filter @prodchi/shared-types test

e2e: ## Run the e2e suites against the stack's API (needs API_PORT=4000)
	@if [ "$(API_PORT)" != "4000" ]; then \
		echo "Both e2e suites hardcode http://localhost:4000/api/v1."; \
		echo "Run 'make e2e API_PORT=4000' or set API_PORT=4000 in $(ENV_FILE)."; \
		exit 1; \
	fi
	@echo "Note: the suites import content and create throwaway candidates."
	pnpm test:e2e

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Stop the stack and delete the images built from this repo
	$(COMPOSE_DEV) down --rmi local --remove-orphans

nuke: ## Stop the stack AND delete its volumes (database data included)
	@echo "This deletes the db volume (all data) plus the node_modules volumes."
	$(COMPOSE_DEV) down --volumes --rmi local --remove-orphans


.PHONY: help setup install env db db-migrate db-reset dev build clean test lint format up down logs

# Default help command
help:
	@echo "PKP - Personal Knowledge Pack"
	@echo ""
	@echo "Available commands:"
	@echo "  make setup      - Initial setup (install dependencies + set up environment)"
	@echo "  make install    - Install dependencies"
	@echo "  make env        - Set up environment file"
	@echo "  make db         - Set up database (show instructions)"
	@echo "  make db-migrate - Run database migrations automatically"
	@echo "  make db-reset   - Reset database and run all migrations"
	@echo "  make dev        - Start development server"
	@echo "  make up         - Start development server (alias for dev)"
	@echo "  make build      - Production build"
	@echo "  make lint       - Lint code"
	@echo "  make format     - Format code"
	@echo "  make clean      - Clean build files and cache"
	@echo "  make logs       - Show development server logs"
	@echo ""

# Initial setup
setup: install env
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "1. Edit apps/web/.env file and add your API keys"
	@echo "2. Set up database in Supabase dashboard"
	@echo "3. Run 'make dev' to start the development server"
	@echo ""

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	pnpm install

# Set up environment file
env:
	@echo "🔧 Setting up environment file..."
	@if [ ! -f apps/web/.env ]; then \
		cp apps/web/.env.example apps/web/.env; \
		echo "✅ Created apps/web/.env file"; \
		echo "⚠️  Please edit .env file and add your API keys"; \
	else \
		echo "ℹ️  apps/web/.env file already exists"; \
	fi
	@echo ""
	@echo "Required API keys:"
	@echo "  - Clerk: https://dashboard.clerk.com/"
	@echo "  - Supabase: https://supabase.com/dashboard/project/_/settings/api-keys"
	@echo "  - Gemini: https://aistudio.google.com/app/apikey"
	@echo ""

# Set up database (requires manual execution)
db:
	@echo "🗄️  Database setup"
	@echo ""
	@echo "Follow these steps to set up the database:"
	@echo "1. Open Supabase dashboard: https://supabase.com/dashboard"
	@echo "2. Open SQL Editor for your project"
	@echo "3. Run the content of supabase/migrations/001_initial_schema.sql"
	@echo ""
	@echo "Or use 'make db-migrate' for automatic migration (requires DATABASE_URL)"

# Run database migrations automatically
db-migrate:
	@echo "🗄️  Running database migrations..."
	@if [ -z "$(DATABASE_URL)" ]; then \
		if [ -f apps/web/.env ]; then \
			export $$(grep -v '^#' apps/web/.env | grep DATABASE_URL | xargs) 2>/dev/null; \
		fi; \
	fi; \
	if [ -z "$$DATABASE_URL" ] && [ -z "$(DATABASE_URL)" ]; then \
		echo "❌ DATABASE_URL is not set"; \
		echo ""; \
		echo "Add DATABASE_URL to apps/web/.env:"; \
		echo "  DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"; \
		echo ""; \
		echo "Get it from: https://supabase.com/dashboard/project/_/settings/database"; \
		echo "  -> Connection string -> URI"; \
		exit 1; \
	fi; \
	for f in supabase/migrations/*.sql; do \
		echo "Running $$f..."; \
		psql "$$DATABASE_URL" -f "$$f" || psql "$(DATABASE_URL)" -f "$$f"; \
	done; \
	echo "✅ Migrations complete"

# Reset database (dangerous!)
db-reset:
	@echo "⚠️  This will delete all data! Are you sure? [y/N]"
	@read answer; \
	if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
		echo "🗄️  Resetting database..."; \
		make db-migrate; \
	else \
		echo "Cancelled."; \
	fi

# Start development server
dev:
	@echo "🚀 Starting development server..."
	@echo "URL: http://localhost:3000"
	@cd apps/web && pnpm dev

# Start development server (alias)
up: dev

# Production build
build:
	@echo "🏗️  Creating production build..."
	@cd apps/web && pnpm build

# Show development server logs (for background execution)
logs:
	@echo "📋 Showing development server logs..."
	@tail -f apps/web/.next/trace

# Lint code
lint:
	@echo "🔍 Linting code..."
	@cd apps/web && pnpm lint

# Format code (using Biome)
format:
	@echo "✨ Formatting code..."
	@pnpm biome check --write .

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	@rm -rf apps/web/.next
	@rm -rf apps/web/node_modules
	@rm -rf node_modules
	@rm -rf packages/core/dist
	@echo "✅ Cleanup complete"

# Generate CRON_SECRET
generate-secret:
	@echo "🔐 Generating random string for CRON_SECRET..."
	@openssl rand -base64 32
	@echo ""
	@echo "Add this value to CRON_SECRET in apps/web/.env"

# Update packages
update:
	@echo "📦 Updating packages..."
	@pnpm update

# Run tests (when tests are added)
test:
	@echo "🧪 Running tests..."
	@cd apps/web && pnpm test || echo "⚠️  Test script not found"

# Type check
typecheck:
	@echo "🔍 Type checking..."
	@cd apps/web && pnpm tsc --noEmit
	@cd packages/core && pnpm tsc --noEmit

# Run all checks (lint + type check + build)
check: lint typecheck build
	@echo "✅ All checks complete"

# Show project info
info:
	@echo "📊 Project Information"
	@echo ""
	@echo "Node.js version:"
	@node --version
	@echo ""
	@echo "pnpm version:"
	@pnpm --version
	@echo ""
	@echo "Project structure:"
	@echo "  - Web app: apps/web"
	@echo "  - Core package: packages/core"
	@echo "  - Database: supabase/"
	@echo ""

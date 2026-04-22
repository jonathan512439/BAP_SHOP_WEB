# AGENTS.md - BAP_SHOP-WEB

## Project Structure
- **apps/store**: Vue.js storefront (Vite, runs on port 5173)
- **apps/admin**: Vue.js admin panel (Vite, runs on port 5174)
- **worker**: Cloudflare Workers API (Hono, runs with `wrangler dev --local`)
- **packages/shared**: Shared types and utilities

## Key Commands
```bash
# Development
pnpm dev:store     # Start storefront
pnpm dev:admin     # Start admin panel
pnpm dev:worker    # Start Cloudflare worker

# Validation (run before committing)
pnpm validate      # typecheck + test

# Individual checks
pnpm typecheck     # TypeScript for all packages
pnpm test          # All tests
pnpm test:store    # Storefront tests
pnpm test:admin    # Admin tests
pnpm test:worker   # Worker tests (uses @cloudflare/vitest-pool-workers)

# Worker utilities
pnpm --filter worker hash-password      # Generate Argon2id hash
pnpm --filter worker verify-password    # Verify password
pnpm --filter worker migrate:image-variants
pnpm --filter worker backup:d1          # Backup D1 to R2
```

## Environment
- Copy `.dev.vars.example` to `.dev.vars` (never commit secrets)
- Secrets in `.dev.vars`: `ADMIN_PEPPER`, `TURNSTILE_SECRET`, `ENVIRONMENT`

## Testing
- Worker tests use `@cloudflare/vitest-pool-workers` (isolated Workers environment)
- Run worker tests in watch mode: `pnpm --filter worker test:watch`

## Tech Stack
- Vue 3 + Vite + Pinia + Vue Router
- Cloudflare Workers + Hono + D1 + R2
- TypeScript, Zod validation
- pnpm workspaces

## Important Files
- `PRODUCTION_CHECKLIST.md` - Deployment verification steps
- `.dev.vars` - Local secrets (must be created from `.dev.vars.example` if exists)
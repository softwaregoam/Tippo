# Tippo development and releases

- Use the existing checkout. Do not create a worktree unless the user requests one.
- `dev` is the integration branch. Create feature branches from `dev` when needed.
- `main` serves the live Tippo website. Do not push or merge to `main` as part of routine development; the user reviews dev and explicitly authorizes a production release.
- Commit and push only files belonging to the current request. Preserve unrelated local changes, including the payment-router changes.
- Development and Vercel Preview must use their own Supabase project. Never copy production transactions, users, DOKU keys, or payment-router secrets to dev.
- Follow `docs/DEVELOPMENT.md` for environment setup. Do not bypass `validateDevelopmentEnvironment` to run dev against production.
- Validate database migrations in dev first. A Git push does not apply SQL or Edge Function secrets to Supabase; report backend deployment and frontend deployment separately.
- Default to payment flags off in dev. Sandbox is optional; production checkout and production test flags must stay off.
- Run checks appropriate to the change. Do not add tests for simple copy or styling changes. Do not claim remote database readiness from mocks or local tests.

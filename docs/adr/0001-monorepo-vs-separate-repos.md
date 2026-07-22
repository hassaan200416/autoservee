# ADR 0001: monorepo over separate repos

**Decision:** one monorepo (pnpm workspaces + Turborepo) holding both apps and shared packages.

**Why:** a 2-person team maintaining separate repos with duplicated types costs more
time than it saves. Shared DB types and a shared Supabase client mean a schema
change surfaces as a type error in both apps immediately, instead of silently
drifting out of sync.

**Revisit if:** the team grows enough to need independent deploy pipelines or
separate access control per app.

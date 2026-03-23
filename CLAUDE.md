# CLAUDE.md — Instruksjoner for Claude Code

## Prosjekt
ketl regnskap — norsk AI-drevet regnskapssystem (SaaS).

## Oppgavestyring
Alle oppgaver ligger som **GitHub Issues** i dette repoet. Bruk CLI:
```bash
# List åpne issues
gh issue list --limit 100

# Se detaljer for én issue
gh issue view <nummer>

# Filtrer på label
gh issue list --label "must-have"
gh issue list --label "priority:critical"

# Lukk en issue etter fullføring
gh issue close <nummer> --comment "Implementert i <commit-hash>"
```

Jobb med issues i prioritert rekkefølge:
1. `priority:critical` — regulatoriske frister
2. `priority:high` — grunnmur og kjernelogikk
3. `must-have` — MVP-funksjonalitet
4. `nice-to-have` — forbedringer

## Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS v4, shadcn/ui v4
- **Backend:** Firebase Cloud Functions v2 (Node 22), Firestore, Firebase Auth, Firebase Storage
- **AI:** Firebase AI Logic (Gemini 2.5 Flash via Vertex AI)
- **Betaling:** Stripe (Checkout, kundeportal, webhooks)
- **CI/CD:** GitHub Actions → Firebase Hosting + Functions
- **Firebase-prosjekt:** `ketl-regnskap`

## Prosjektstruktur
```
src/
  app/                    # Next.js App Router — alle sider
    dashboard/            # Autentiserte sider (bilag, klienter, rapporter, etc.)
    admin/                # Admin-panel (brukere, feature flags)
    login/                # Autentisering
  components/             # Delte React-komponenter
    ui/                   # shadcn/ui base-komponenter
    motion/               # Framer Motion animasjoner
  hooks/                  # Custom React hooks (use-bilag, use-klienter, etc.)
  lib/                    # Kjernelogikk
    firebase/             # Firebase config, auth, firestore, storage, AI
    stripe/               # Stripe pricing
    kontoplan.ts          # NS 4102 standard norsk kontoplan
    mva-koder.ts          # SAF-T MVA-koder
    saft-eksport.ts       # SAF-T Financial 1.30 XML-generator
    audit.ts              # Revisjonslogg (Regnskapsloven §§ 8-5, 10-1)
    brreg.ts              # Brønnøysundregistrene oppslag
    eksport.ts            # CSV-eksport for bilag og posteringer
  modules/
    ai-assistant/         # AI chat-widget (Gemini)
  types/                  # TypeScript-typer for hele domenet
functions/
  src/
    index.ts              # Cloud Functions — REST API, Stripe, AI-analyse, webhooks
    middleware.ts          # Auth, admin, API-nøkkel, rate limiting, validering
    openapi.ts            # OpenAPI 3.0 spec
firestore.rules           # Firestore sikkerhetsregler
```

## Kodekonvensjoner
- **Språk:** All kode, kommentarer, variabelnavn og UI-tekst på **norsk (bokmål)**
- **Typer:** Streng TypeScript (`strict: true`). Bruk `type` fremfor `interface`. Alle typer i `src/types/index.ts`
- **Imports:** Bruk `@/`-alias (`@/components/...`, `@/hooks/...`, `@/lib/...`, `@/types`)
- **Komponenter:** Funksjonelle React-komponenter med hooks. shadcn/ui for UI. Framer Motion for animasjoner
- **Backend-validering:** Zod-skjemaer for all input. `withAuth`/`withAdmin`/`withApiKeyOrAuth` middleware
- **Firestore-stier:** `users/{uid}/bilag`, `users/{uid}/klienter`, `users/{uid}/motparter`, etc.
- **Feilhåndtering:** `showToast.error()` i frontend. `fail(res, statusCode, melding)` i backend
- **Audit:** Logg alle CRUD-operasjoner via `loggHandling()` fra `@/lib/audit.ts`
- **Git:** Commit-meldinger på norsk, prefiks med type: `fix(bilag):`, `feat(rapporter):`, `chore:`

## Viktige domenetyper
- **Bilag** — regnskapsbilag med posteringer (debet/kredit), status-flyt: ubehandlet → foreslått → bokført/avvist → kreditert/arkivert
- **Postering** — enkelt debet/kredit-linje med kontonr (NS 4102), MVA-kode (SAF-T)
- **Klient** — regnskapsklient (bedrift) med orgnr, kontaktperson
- **Motpart** — kunde eller leverandør tilknyttet en klient

## Regnskapsregler å huske
- Bokføringsloven § 9: Bokførte bilag kan ikke slettes, kun krediteres (reverseres)
- Bokføringsloven § 13: 5 års oppbevaringsplikt for bilag
- NS 4102: Standard norsk kontoplan (klasse 1-8)
- SAF-T Financial 1.30: Standardformat for regnskapseksport til Skatteetaten
- MVA-koder: SAF-T-kodesystem for norsk MVA-melding

## Build og test
```bash
# Frontend
npm ci && npm run build    # Bygger Next.js (statisk eksport)
npm run dev                # Utviklingsserver
npm test                   # Vitest

# Cloud Functions
cd functions && npm ci && npm run build
```

## Ting å huske
- `next.config.ts` bruker `output: "export"` (statisk) — ingen server-side rendering
- Firebase Hosting serverer statiske filer + rewrites til Cloud Functions for `/api/**`
- AI-analyse av bilag skjer automatisk via Firestore-trigger (`analyserBilag`) i Cloud Functions
- Alle Firestore-data er isolert per bruker (`users/{uid}/...`)
- Bruk `serverTimestamp()` for `createdAt`/`updatedAt`-felt

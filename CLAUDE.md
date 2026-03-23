# CLAUDE.md — Instruksjoner for Claude Code

## Prosjekt
ketl regnskap — norsk AI-drevet regnskapssystem (SaaS).

## Oppgavestyring

Alle oppgaver ligger som **GitHub Issues** i dette repoet (`andreas-t-hjertaker/ketl-regnskap`).
Per mars 2026: 119 issues totalt, ~90 åpne.

### Grunnleggende kommandoer
```bash
# List alle åpne issues (standard: 30 stk)
gh issue list

# List ALLE åpne (opp til 200)
gh issue list --limit 200

# Inkluder lukkede
gh issue list --state all --limit 200

# Se full detalj (beskrivelse, labels, akseptansekriterier)
gh issue view <nummer>

# Lukk etter fullføring
gh issue close <nummer> --comment "Implementert i <commit-hash>"
```

### Filtrering — slik finner du riktig issue
```bash
# === PRIORITET ===
gh issue list --label "priority:critical"    # Må gjøres først, blokkerer annet
gh issue list --label "priority:high"        # Viktig, bør gjøres snart
gh issue list --label "priority:medium"      # Kan vente litt

# === FASE (utviklingsrekkefølge) ===
gh issue list --label "fase:1-grunnmur"      # Firestore CRUD, erstatte mock-data
gh issue list --label "fase:2-pipeline"      # AI-bokføringspipeline
gh issue list --label "fase:3-agent"         # Agentisk arkitektur (MCP, multi-agent)

# === OMRÅDE ===
gh issue list --label "backend"              # Firestore, Cloud Functions, server-logikk
gh issue list --label "frontend"             # React-komponenter, UI, hooks
gh issue list --label "ai-agent"             # Agent-arkitektur, Claude SDK, MCP
gh issue list --label "infrastruktur"        # Firebase config, CI/CD, deploy
gh issue list --label "compliance"           # Lovkrav/forskriftskrav
gh issue list --label "integration"          # Tredjepartsintegrasjoner (Altinn, bank, etc.)
gh issue list --label "security"             # Sikkerhet og personvern
gh issue list --label "ux"                   # Brukeropplevelse

# === STATUS ===
gh issue list --label "must-have"            # Kritisk for MVP/lansering
gh issue list --label "nice-to-have"         # Forbedring, ikke blokkerende

# === KOMBINASJONER (AND-logikk) ===
gh issue list --label "backend" --label "must-have"
gh issue list --label "ai-agent" --label "fase:3-agent"
gh issue list --label "compliance" --label "priority:critical"

# === FRITEKSTSØK ===
gh issue list --search "MCP"
gh issue list --search "MVA"
gh issue list --search "bankavstemming"
gh issue list --search "Altinn"

# === JSON for scripting ===
gh issue list --json number,title,state,labels
gh issue list --label "must-have" --json number,title --jq '.[] | "#\(.number) \(.title)"'
```

### Prioritert arbeidsrekkefølge
1. `priority:critical` — regulatoriske frister (Altinn 3, A-melding, EHF)
2. `priority:high` — grunnmur og kjernelogikk (MCP, OCR, testing)
3. `must-have` uten prioritetslabel — MVP-funksjonalitet
4. `nice-to-have` — forbedringer og fremtidige features

### Issue-nummerering
- **#1–#20**: Fase 1 grunnmur + tidlige bugfikser (de fleste LUKKET)
- **#22–#55**: Kjernedomene — compliance, faktura, bank, API (blanding av åpne/lukkede)
- **#56–#60**: MCP-server arkitektur (ÅPNE)
- **#61–#70**: Tredjepartsintegrasjoner — Altinn, bank, Peppol, Tripletex (ÅPNE)
- **#71–#84**: Agentisk arkitektur — orkestrator, HITL, minne, runtime (ÅPNE)
- **#85–#100**: Regnskap avansert — årsoppgjør, lønn, reskontro (ÅPNE)
- **#101–#119**: Infra og optimalisering — multi-tenant, testing, paginering (ÅPNE)

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

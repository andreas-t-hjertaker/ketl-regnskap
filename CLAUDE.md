# CLAUDE.md — Instruksjoner for Claude Code

## Prosjekt
ketl regnskap — norsk AI-drevet regnskapssystem (SaaS).
Firebase-prosjekt: `ketl-regnskap` | Region: `europe-west1`

## Oppgavestyring

Alle oppgaver ligger som **GitHub Issues** i dette repoet.
**Les ALLTID issue-beskrivelsen med `gh issue view <nummer>` før du begynner** — den inneholder akseptansekriterier og kontekst. Sjekk også kommentarfeltet for tilbakemeldinger og kjente problemer.

### Finn issues
```bash
gh issue list --limit 100                          # Alle åpne
gh issue list --label "priority:critical"           # Kritisk — gjør først
gh issue list --label "priority:high"               # Høy prioritet
gh issue list --label "must-have"                   # MVP-krav
gh issue list --label "must-have" --label "backend"  # Kombinér labels
gh issue list --search "MCP"                        # Fritekstsøk
gh issue view 102                                   # Les detaljer + kommentarer
```

### Lukk issues
```bash
gh issue close <nummer> --comment "Implementert i <commit-hash>. <kort beskrivelse>"
```

### Prioritert arbeidsrekkefølge
1. `priority:critical` — regulatoriske frister og grunnmur
2. `priority:high` — kjernelogikk
3. `must-have` — MVP-funksjonalitet
4. `nice-to-have` — forbedringer

## Åpne issues — hurtigreferanse

### GJENÅPNEDE (har tilbakemelding — les kommentarene!)
- **#34** 2FA — login MFA-resolver mangler, brukere låses ute
- **#74** Feedback — `registrerKorreksjon()` kalles aldri
- **#99** Reskontro — aldring fra bilagsdato, skal være forfallsdato
- **#103** Testing — kun enhetstester, mangler React/E2E/integrasjon
- **#105** Paginering — `getCollectionPaginated()` er død kode, hooks laster alt
- **#110** Offline — kun banner, mangler Firestore persistering + service worker

### Kritisk prioritet
- **#102** Multi-tenant arkitektur (organisasjoner, team, invitasjoner)
- **#25** Fakturering (opprett, send, motta fakturaer)
- **#23** MVA-melding til Altinn 3
- **#61** Altinn 3 + Maskinporten
- **#107** A-melding nytt JSON API — frist 1. april 2026
- **#108** Altinn tilgangspakker — frist 19. juni 2026
- **#106** EHF 3.0 / Peppol — obligatorisk 2027

### Høy prioritet
- **#115** Bankavstemming (CSV-import ferdig, mangler Open Banking)
- **#114** Bilag OCR-pipeline
- **#113** MCP-server i Next.js
- **#56** MCP-server grunnstruktur
- **#71** Orkestratoragent
- **#63** Neonomics Open Banking
- **#104** Staging-miljø

### Filreferanser for vanlige oppgaver
| Oppgave | Filer |
|---------|-------|
| Bilag CRUD | `src/hooks/use-bilag.ts`, `src/app/dashboard/bilag/page.tsx` |
| Ny side i dashboard | `src/app/dashboard/<navn>/page.tsx` + oppdater `src/components/sidebar.tsx` |
| Ny hook | `src/hooks/use-<navn>.ts` — bruk `subscribeToCollection` for sanntid |
| Ny type | `src/types/index.ts` — alle domenetyper samlet her |
| Backend API | `functions/src/index.ts` — legg til handler + route i `routes[]` |
| Firestore-regler | `firestore.rules` — legg til match-blokk |
| AI-analyse | `functions/src/index.ts` linje ~1300 (`analyserBilag`) |
| Tester | `src/__tests__/<navn>.test.ts` — Vitest |

## Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS v4, shadcn/ui v4, Recharts
- **Backend:** Firebase Cloud Functions v2 (Node 22), Firestore, Auth, Storage
- **AI:** Gemini 2.5 Flash via Firebase AI Logic + Vertex AI
- **Betaling:** Stripe (Checkout, kundeportal, webhooks)
- **CI/CD:** GitHub Actions → Firebase Hosting + Functions

## Prosjektstruktur
```
src/
  app/dashboard/          # Autentiserte sider
    bilag/                # Bilagsliste + ny + purring
    klienter/             # Klientoversikt
    motparter/            # Kunde/leverandør
    rapporter/            # Resultat, balanse, MVA, SAF-T, reskontro
    kontoplan/            # NS 4102 administrasjon
    avskrivninger/        # Anleggsmidler og avskrivningsplan
    budsjett/             # Budsjett vs. regnskap
    cashflow/             # Cashflow-prognose
    bankavst/             # Bankkontoavstemming (CSV-import)
    prosjekter/           # Prosjektregnskap
    aarsoppgjor/          # Årsoppgjør (grunnstruktur)
    notater/              # Notater
    revisjonslogg/        # Audit trail
    innstillinger/        # Profil, 2FA, AI-innstillinger
    utvikler/             # API-nøkler, webhooks
    abonnement/           # Stripe
  components/
    ui/                   # shadcn/ui (button, card, form, data-table, etc.)
    motion/               # Framer Motion animasjoner
    sidebar.tsx           # Navigasjon — OPPDATER NÅR DU LEGGER TIL SIDER
    fristmonitor.tsx      # Regnskapsfrister
    anomali-widget.tsx    # AI anomalideteksjon
    ai-forklaring.tsx     # Agent-forklarbarhet
    offline-banner.tsx    # Offline-varsling
    mobile-bottom-nav.tsx # Mobilnavigasjon
  hooks/                  # Custom hooks — ett per domene
  lib/
    firebase/             # Config, auth, firestore, storage, AI
    kontoplan.ts          # NS 4102 kontoer
    mva-koder.ts          # SAF-T MVA-koder
    saft-eksport.ts       # SAF-T Financial 1.30 XML
    audit.ts              # Revisjonslogg
    ai-feedback.ts        # AI læringssignaler
  modules/ai-assistant/   # Gemini chat-widget
  types/index.ts          # ALLE domenetyper
functions/src/
  index.ts                # Cloud Functions (1800+ linjer)
  middleware.ts           # Auth, rate limiting, validering
  openapi.ts              # OpenAPI 3.0 spec
```

## Kodekonvensjoner
- **Språk:** All kode, kommentarer, variabelnavn og UI-tekst på **norsk (bokmål)**
- **Typer:** Streng TypeScript (`strict: true`). Bruk `type` fremfor `interface`. Alle typer i `src/types/index.ts`
- **Imports:** Bruk `@/`-alias (`@/components/...`, `@/hooks/...`, `@/lib/...`, `@/types`)
- **Komponenter:** Funksjonelle React-komponenter med hooks. shadcn/ui for UI. Framer Motion for animasjoner
- **Backend:** Zod-skjemaer for all input. `withAuth`/`withAdmin`/`withApiKeyOrAuth` middleware
- **Firestore-stier:** `users/{uid}/bilag`, `users/{uid}/klienter`, `users/{uid}/motparter`, etc.
- **Feilhåndtering:** `showToast.error()` i frontend. `fail(res, statusCode, melding)` i backend
- **Audit:** Logg alle CRUD-operasjoner via `loggHandling()` fra `@/lib/audit.ts`
- **Git:** Commit-meldinger på norsk. Prefiks: `fix(bilag):`, `feat(rapporter):`, `chore:`, `test:`

## Regnskapsregler
- **Bokføringsloven § 9:** Bokførte bilag kan IKKE slettes, kun krediteres (reverseres)
- **Bokføringsloven § 13:** 5 års oppbevaringsplikt
- **NS 4102:** Standard norsk kontoplan (klasse 1-8)
- **SAF-T 1.30:** Skatteetatens standard XML-format
- **MVA-koder:** SAF-T-kodesystem for norsk MVA

## Build og test
```bash
npm ci && npm run build    # Frontend (statisk eksport)
npm test                   # Vitest — 107 tester
cd functions && npm ci && npm run build  # Cloud Functions
```

## Viktig
- `next.config.ts` bruker `output: "export"` — statisk, ingen SSR
- Firebase Hosting + rewrites til Cloud Functions for `/api/**`
- AI-analyse via Firestore-trigger `analyserBilag` i Cloud Functions
- Bruk `serverTimestamp()` for `createdAt`/`updatedAt`
- Les ALLTID issue-kommentarer — de inneholder tilbakemelding på hva som mangler

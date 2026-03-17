# ketl cloud

SaaS-boilerplate med Next.js, Firebase og TypeScript — klar til bruk for nye prosjekter.

## Kom i gang

```bash
# 1. Klon repoet
git clone https://github.com/andreas-t-hjertaker/sandbox.git
cd sandbox

# 2. Konfigurer miljøvariabler
cp .env.local.example .env.local
# Fyll inn verdiene fra Firebase Console

# 3. Installer avhengigheter
npm install
cd functions && npm install && cd ..

# 4. Start utviklingsserver
npm run dev
```

## Bruk som mal for nytt prosjekt

1. **Opprett nytt repo** fra denne malen (bruk "Use this template" på GitHub)
2. **Opprett Firebase-prosjekt** på [console.firebase.google.com](https://console.firebase.google.com)
3. **Oppdater konfigurasjon:**
   - `.env.local` — Firebase-nøkler fra prosjektet
   - `.firebaserc` — Endre `default` til ditt prosjekt-ID
4. **Aktiver Auth-metoder** i Firebase Console → Authentication → Sign-in method:
   - E-post/passord
   - Google
5. **Push til `main`** — GitHub Actions bygger og deployer automatisk

## Tech stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui v4 |
| Backend | Firebase Cloud Functions (Node.js 22) |
| Database | Cloud Firestore (NoSQL, sanntidssynk) |
| Autentisering | Firebase Auth (Google, e-post/passord) |
| Lagring | Firebase Cloud Storage |
| AI | Firebase AI Logic (Gemini) |
| Analytics | Firebase Analytics |
| Hosting | Firebase Hosting (statisk eksport) |
| Testing | Vitest, Testing Library |
| CI/CD | GitHub Actions → Firebase |

## Prosjektstruktur

```
src/
├── app/
│   ├── layout.tsx                 # Root layout (tema, auth, tooltips, toasts)
│   ├── page.tsx                   # Landingsside
│   ├── loading.tsx                # Global lasteindikator
│   ├── robots.ts                  # robots.txt
│   ├── sitemap.ts                 # sitemap.xml
│   ├── login/
│   │   ├── layout.tsx             # Metadata for innlogging
│   │   └── page.tsx               # Innloggingsside (e-post, Google, registrering)
│   └── dashboard/
│       ├── layout.tsx             # Beskyttet layout med sidebar + topplinje
│       ├── page.tsx               # Dashboard-oversikt med tjenestestatus
│       ├── loading.tsx            # Dashboard laste-skeleton
│       ├── dokumenter/page.tsx    # Datatabell-eksempel
│       └── innstillinger/page.tsx # Skjema-eksempel (React Hook Form + Zod)
├── components/
│   ├── ui/                        # shadcn/ui komponenter
│   │   ├── button, card, badge, separator, input, label
│   │   ├── sheet, avatar, dropdown-menu, tooltip, skeleton
│   │   ├── table, data-table      # Generisk datatabell med sortering/søk
│   │   ├── form, textarea         # Skjema-primitiver
│   │   ├── sonner                 # Toast-wrapper
│   │   └── spinner                # Lasteindikator
│   ├── auth-provider.tsx          # AuthContext-wrapper
│   ├── theme-provider.tsx         # Tema-wrapper (lys/mørk/system)
│   ├── theme-toggle.tsx           # Tema-bytte-knapp
│   ├── sidebar.tsx                # Dashboard-sidebar (desktop + mobil)
│   ├── protected-route.tsx        # Auth-vakt
│   ├── analytics-provider.tsx     # Automatisk sidevisnings-sporing
│   └── error-boundary.tsx         # Feilgrense med fallback-UI
├── hooks/
│   ├── use-auth.ts                # Auth context + hook
│   └── use-theme.ts               # Tema context + hook
├── lib/
│   ├── utils.ts                   # cn(), formatDate(), formatRelativeTime(), etc.
│   ├── toast.ts                   # showToast.success/error/info/loading
│   └── firebase/
│       ├── config.ts              # Firebase-initialisering (env vars med fallback)
│       ├── auth.ts                # Auth-hjelpere (Google, e-post, passord-reset)
│       ├── firestore.ts           # CRUD, sanntidslyttere, paginering, batch
│       ├── storage.ts             # Opplasting med fremdrift
│       ├── analytics.ts           # Event- og sidevisnings-sporing
│       ├── ai.ts                  # Gemini (tekst, streaming, chat)
│       └── index.ts               # Re-exports
├── types/
│   └── index.ts                   # ApiResponse, User, WithId, WithTimestamps, etc.
└── __tests__/
    └── utils.test.ts              # Enhetstester for utilities

functions/
├── src/index.ts                   # Cloud Functions (health, API med auth + Zod)
├── package.json
└── tsconfig.json

firebase.json                      # Hosting, Functions, Firestore, Storage-konfig
firestore.rules                    # Sikkerhetsregler for Firestore
storage.rules                      # Sikkerhetsregler for Storage
.github/workflows/
└── firebase-deploy.yml            # CI/CD pipeline
```

## Arkitektur

### Statisk eksport + klient-side Firebase

Prosjektet bruker `output: "export"` i Next.js — alt serveres som statiske filer via Firebase Hosting. All forretningslogikk kjører i nettleseren med Firebase JS SDK.

### Autentisering

```
Bruker → Login-side → Firebase Auth → AuthProvider (context)
                                         ↓
                                   ProtectedRoute → Dashboard
```

`AuthProvider` lytter på `onAuthStateChanged` og deler brukertilstand via React context. `ProtectedRoute` omdirigerer til `/login` hvis bruker ikke er innlogget.

### API via Cloud Functions

```
Klient → fetch() med Bearer-token → Cloud Functions (europe-west1)
                                         ↓
                                   verifyIdToken() → Firestore
```

Beskyttede endepunkter validerer Firebase ID-tokens. Zod brukes for request-validering.

### CI/CD

Push til `main` → GitHub Actions bygger frontend + functions → deployer til Firebase.

## Skript

| Kommando | Beskrivelse |
|----------|-------------|
| `npm run dev` | Start utviklingsserver |
| `npm run build` | Bygg for produksjon (statisk eksport) |
| `npm run test` | Kjør tester med Vitest |
| `npm run lint` | Lint med ESLint |

## Miljøvariabler

| Variabel | Beskrivelse |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API-nøkkel (trygg å eksponere) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth-domene |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Prosjekt-ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage-bøtte |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender-ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App-ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics measurement-ID |

> **NB:** Firebase API-nøkler er prosjektidentifikatorer og er trygge å eksponere i klienten. Sikkerhet håndteres av Firebase Security Rules og Auth.

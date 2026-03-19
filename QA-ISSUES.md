## Issue #20: Rapporter: Periodeliste er hardkodet for 2026
Labels: priority:medium, frontend, fase:1-grunnmur

## Beskrivelse
`src/app/dashboard/rapporter/page.tsx` linje 38–44 har en hardkodet liste med perioder:

```tsx
const periodeAlternativer = [
  { key: "2026-01", label: "Januar 2026" },
  { key: "2026-02", label: "Februar 2026" },
  // ...
];
```

## Løsning
Generer periodelisten dynamisk basert på tilgjengelige bilag-datoer:

```tsx
const perioder = useMemo(() => {
  const måneder = new Set(bilag.map(b => b.dato.slice(0, 7)));
  return [...måneder].sort().map(m => ({
    key: m,
    label: new Date(m + "-01").toLocaleDateString("nb-NO", { month: "long", year: "numeric" })
  }));
}, [bilag]);
```

## Alvorlighetsgrad
Lav — vil feile i 2027.

---

## Issue #19: Dashboard: "God morgen" er hardkodet — bør være tidsavhengig
Labels: priority:medium, frontend

## Beskrivelse
`src/app/dashboard/page.tsx` linje 81 sier alltid "God morgen" uavhengig av tid.

## Løsning
```tsx
function hilsen() {
  const timer = new Date().getHours();
  if (timer < 12) return "God morgen";
  if (timer < 17) return "God ettermiddag";
  return "God kveld";
}
```

## Alvorlighetsgrad
Lav — UX-polering.

---

## Issue #18: Fjern duplisert resultatregnskap-logikk i use-rapporter.ts
Labels: priority:medium, frontend

## Beskrivelse
`use-rapporter.ts` inneholder to nesten identiske implementasjoner av resultatregnskap-beregningen:

1. `resultatregnskap` (useMemo, linje 69–104) — **fungerer ikke** (se issue #13)
2. `resultatForPeriode` (vanlig funksjon, linje 106–138) — fungerer korrekt

## Løsning
Fjern `resultatregnskap`-memoen helt og behold kun `resultatForPeriode`. Wrap den i `useCallback` for å unngå unødvendige re-renders.

## Alvorlighetsgrad
Lav — kodevedlikehold.

---

## Issue #17: AI-pipeline mangler retry-logikk for Vertex AI-kall
Labels: priority:high, backend, fase:2-pipeline

## Beskrivelse
`processDocument`-funksjonen i `functions/src/index.ts` gjør Vertex AI-kall uten retry. Vertex AI kan returnere 429 (rate limit) eller 503 (service unavailable), spesielt ved høy last.

## Løsning
Implementer eksponentiell backoff:

```ts
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      if (err.status === 429 || err.status === 503) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}
```

## Alvorlighetsgrad
**Viktig** — robusthet i produksjon.

---

## Issue #16: klientId mangler som tillatt felt i Firestore rules for bilag
Labels: priority:high, infrastruktur, fase:1-grunnmur

## Beskrivelse
`firestore.rules` validerer feltene for bilag-collection, men inkluderer ikke `klientId` i listen over tillatte felter. 

Bilag må kunne knyttes til en klient for at:
- `deleteKlient`-sjekken skal fungere (filtrere bilag per klient)
- Klientvelgeren skal kunne filtrere bilag
- Rapporter skal kunne genereres per klient

## Løsning
Legg til `klientId` som et valgfritt strengfelt i bilag-valideringsreglene:

```
allow create: if ... && (
  !request.resource.data.keys().hasAny(['klientId']) || 
  request.resource.data.klientId is string
);
```

## Alvorlighetsgrad
**Viktig** — blokkerer klient-filtrering av bilag.

---

## Issue #15: Vertex AI bruker hardkodet us-central1 — bør være konfigurerbart
Labels: priority:high, backend, fase:2-pipeline

## Beskrivelse
`functions/src/index.ts` linje ~40:

```ts
const vertexAI = new VertexAI({ project: projectId, location: "us-central1" });
```

Hvis Firebase-prosjektet kjører i `europe-west1` (som er naturlig for norsk regnskap/GDPR), vil dette enten feile eller gi unødvendig latens og datahåndtering utenfor EU.

## Løsning
Bruk environment variable eller Firebase-konfig:

```ts
const location = process.env.VERTEX_AI_LOCATION ?? "europe-west1";
const vertexAI = new VertexAI({ project: projectId, location });
```

## Alvorlighetsgrad
**Viktig** — ytelse og GDPR-hensyn.

---

## Issue #14: BUG: deleteKlient sjekker ALLE bilag i stedet for klient-spesifikke
Labels: priority:critical, frontend, fase:1-grunnmur

## Beskrivelse
`src/hooks/use-klienter.ts` linje 106–108:

```tsx
const bilag = await getCollection(\`users/\${uid}/bilag\`, ...([
  // where("klientId", "==", id) - importeres ikke her for enkelhet
] as []));
if (bilag.length > 0) {
  showToast.error("Kan ikke slette klient med tilknyttede bilag.");
  return;
}
```

Where-klausulen er utkommentert. Koden henter **alle** brukerens bilag uten filter. Konsekvens: ingen klient kan slettes så lenge brukeren har bilag — uavhengig av hvilken klient.

## Løsning
1. Importer `where` fra firebase-helperne
2. Aktiver filteret:

```tsx
import { where } from "firebase/firestore";

const bilag = await getCollection(
  \`users/\${uid}/bilag\`,
  where("klientId", "==", id)
);
```

Krever også at `klientId` settes på bilag-dokumenter (se relatert issue om Firestore rules).

## Alvorlighetsgrad
**Kritisk** — forhindrer sletting av klienter i alle tilfeller.

---

## Issue #13: BUG: useMemo med parameter i use-rapporter.ts — resultatregnskap fungerer ikke
Labels: priority:critical, frontend, fase:1-grunnmur

## Beskrivelse
`src/hooks/use-rapporter.ts` linje 69–104:

```tsx
const resultatregnskap = useMemo(
  (periode?: string): Resultatregnskap => {
    const filtrert = periode
      ? posteringer.filter((p) => p.dato.startsWith(periode))
      : posteringer;
    // ...
  },
  [posteringer]
);
```

`useMemo` sender aldri argumenter til callback. `periode` vil alltid være `undefined`, og `resultatregnskap` returnerer alltid resultat for alle posteringer.

Heldigvis brukes `resultatForPeriode()` (linje 106–138) i rapporter-siden, som fungerer korrekt. Men `resultatregnskap` eksporteres fra hooken og er villedende.

## Løsning
Fjern den ødelagte `resultatregnskap`-memoen. Behold kun `resultatForPeriode` som en `useCallback`:

```tsx
const resultatForPeriode = useCallback(
  (periode: string): Resultatregnskap => {
    const filtrert = periode === "alt"
      ? posteringer
      : posteringer.filter((p) => p.dato.startsWith(periode));
    // ... resten av logikken
  },
  [posteringer]
);
```

Fjern `resultatregnskap` fra return-verdien.

## Alvorlighetsgrad
**Kritisk** — eksportert verdi er ubrukelig/villedende.

---

## Issue #12: BUG: asChild finnes ikke på Button (shadcn v4) — bygget feiler
Labels: priority:critical, frontend, fase:1-grunnmur

## Beskrivelse
`src/app/dashboard/bilag/page.tsx` linje 252 bruker `asChild` prop på `<Button>`:

```tsx
<Button variant="ghost" size="sm" asChild>
  <a href={selectedBilag.vedleggUrl} target="_blank" rel="noopener noreferrer">
    <ExternalLink className="h-4 w-4" />
  </a>
</Button>
```

shadcn/ui v4 har fjernet `asChild` (Radix-primitiv fra v3). TypeScript-kompilering feiler:

```
Property 'asChild' does not exist on type 'IntrinsicAttributes & ButtonProps & VariantProps<...>'
```

## Løsning
Bytt til en vanlig `<a>`-tag med button-styling, eller bruk className direkte:

```tsx
<a
  href={selectedBilag.vedleggUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center justify-center h-8 px-3 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
>
  <ExternalLink className="h-4 w-4" />
</a>
```

## Alvorlighetsgrad
**Blokkerer** — bygget kompilerer ikke.

---


import type { AssistantContext } from "../types";

/** Bygg system-instruksjon for AI-assistenten basert på kontekst */
export function buildSystemPrompt(
  context: AssistantContext,
  customPrompt?: string
): string {
  const parts: string[] = [
    `Du er en hjelpsom AI-assistent for ${context.appName}.`,
    "",
    "Brukerinformasjon:",
    `- Navn: ${context.user?.displayName || "Ukjent"}`,
    `- E-post: ${context.user?.email || "Ukjent"}`,
    `- Nåværende side: ${context.currentPath}`,
  ];

  if (context.customContext) {
    parts.push("", context.customContext);
  }

  parts.push(
    "",
    "Retningslinjer:",
    "- Svar alltid på norsk med mindre brukeren skriver på et annet språk",
    "- Vær kortfattet og presis",
    "- Bruk markdown for formatering når det er hensiktsmessig",
    "- Du har tilgang til informasjon om applikasjonen og brukeren"
  );

  if (customPrompt) {
    parts.push("", customPrompt);
  }

  return parts.join("\n");
}

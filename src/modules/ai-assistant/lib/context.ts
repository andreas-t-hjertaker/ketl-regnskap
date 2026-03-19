import type { User } from "@/types";
import type { AssistantContext } from "../types";

/** Bygg standard kontekst fra brukerdata og nåværende sti */
export function getDefaultContext(
  user: User | null,
  pathname: string
): AssistantContext {
  const pageContext = getPageContext(pathname);

  return {
    user: user
      ? {
          displayName: user.displayName,
          email: user.email,
          uid: user.uid,
        }
      : undefined,
    appName: "ketl regnskap",
    currentPath: pathname,
    customContext: pageContext,
  };
}

/** Hent sidespesifikk kontekst for AI-assistenten */
function getPageContext(pathname: string): string | undefined {
  if (pathname === "/dashboard") {
    return "Brukeren ser på regnskapsoversikten (dashboard) med KPI-kort for omsetning, kostnader, resultat og ubehandlede bilag.";
  }
  if (pathname.startsWith("/dashboard/bilag")) {
    return "Brukeren ser på bilagssiden. Her kan de laste opp kvitteringer og fakturaer. AI foreslår bokføring automatisk. Du kan hjelpe med å forklare posteringsforslag og NS 4102 kontoplan.";
  }
  if (pathname.startsWith("/dashboard/klienter")) {
    return "Brukeren ser på klientoversikten. Her administreres regnskapsklienter (bedrifter). Du kan hjelpe med informasjon om klientoppsett og regnskapsplikter.";
  }
  if (pathname.startsWith("/dashboard/rapporter")) {
    return "Brukeren ser på rapportsiden med resultatregnskap, balanse, MVA-rapport og SAF-T-eksport. Du kan hjelpe med å forklare tallene og regnskapsstandarder.";
  }
  if (pathname.startsWith("/dashboard/abonnement")) {
    return "Brukeren ser på abonnementssiden for ketl regnskap.";
  }
  if (pathname.startsWith("/dashboard/innstillinger")) {
    return "Brukeren ser på kontoinnstillinger.";
  }
  return undefined;
}

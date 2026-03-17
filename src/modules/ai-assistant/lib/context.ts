import type { User } from "@/types";
import type { AssistantContext } from "../types";

/** Bygg standard kontekst fra brukerdata og nåværende sti */
export function getDefaultContext(
  user: User | null,
  pathname: string
): AssistantContext {
  return {
    user: user
      ? {
          displayName: user.displayName,
          email: user.email,
          uid: user.uid,
        }
      : undefined,
    appName: "ketl cloud",
    currentPath: pathname,
  };
}

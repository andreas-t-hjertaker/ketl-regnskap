import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formater dato med norsk som standard locale */
export function formatDate(
  date: Date | string | number,
  locale = "nb-NO"
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/** Relativ tidsformatering ("2 timer siden", "akkurat nå" osv.) */
export function formatRelativeTime(date: Date | string | number): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 60) return "akkurat nå";

  const units: [string, number][] = [
    ["minutt", 60],
    ["time", 3600],
    ["dag", 86400],
    ["uke", 604800],
    ["måned", 2592000],
    ["år", 31536000],
  ];

  for (let i = units.length - 1; i >= 0; i--) {
    const [name, secs] = units[i];
    const count = Math.floor(diffSec / secs);
    if (count >= 1) {
      // Norsk flertall
      const plurals: Record<string, string> = {
        minutt: "minutter",
        time: "timer",
        dag: "dager",
        uke: "uker",
        måned: "måneder",
        år: "år",
      };
      const unit = count === 1 ? name : (plurals[name] || name);
      return `${count} ${unit} siden`;
    }
  }

  return "akkurat nå";
}

/** Avkort streng med ellipsis */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

/** Promise-basert forsinkelse */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generer en enkel unik ID */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

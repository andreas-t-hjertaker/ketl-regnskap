"use client";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

type Dokument = {
  navn: string;
  type: string;
  opprettet: string;
  status: string;
};

const mockData: Dokument[] = [
  { navn: "Prosjektplan Q1", type: "PDF", opprettet: "2026-01-15", status: "Publisert" },
  { navn: "API-dokumentasjon", type: "Markdown", opprettet: "2026-02-03", status: "Utkast" },
  { navn: "Brukerundersøkelse", type: "Regneark", opprettet: "2026-02-14", status: "Publisert" },
  { navn: "Designsystem v2", type: "Figma", opprettet: "2026-03-01", status: "Under arbeid" },
  { navn: "Onboarding-guide", type: "PDF", opprettet: "2026-03-05", status: "Publisert" },
  { navn: "Sikkerhetsrapport", type: "PDF", opprettet: "2026-03-10", status: "Utkast" },
  { navn: "Teknisk arkitektur", type: "Markdown", opprettet: "2026-01-20", status: "Publisert" },
  { navn: "Møtereferat 12. mars", type: "Dokument", opprettet: "2026-03-12", status: "Publisert" },
  { navn: "Budsjett 2026", type: "Regneark", opprettet: "2026-01-05", status: "Under arbeid" },
  { navn: "Testrapport sprint 4", type: "PDF", opprettet: "2026-02-28", status: "Utkast" },
  { navn: "Infrastruktur-oversikt", type: "Markdown", opprettet: "2026-03-15", status: "Publisert" },
  { navn: "Release notes v0.1.0", type: "Markdown", opprettet: "2026-03-17", status: "Publisert" },
];

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  Publisert: "default",
  Utkast: "outline",
  "Under arbeid": "secondary",
};

const columns: ColumnDef<Dokument>[] = [
  { key: "navn", header: "Navn", sortable: true },
  { key: "type", header: "Type", sortable: true },
  { key: "opprettet", header: "Opprettet", sortable: true },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (value) => (
      <Badge variant={statusVariant[String(value)] || "secondary"}>
        {String(value)}
      </Badge>
    ),
  },
];

export default function DokumenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dokumenter</h1>
        <p className="text-muted-foreground">
          Oversikt over alle prosjektdokumenter.
        </p>
      </div>

      <DataTable
        data={mockData}
        columns={columns}
        searchable
        searchKey="navn"
        pageSize={8}
      />
    </div>
  );
}

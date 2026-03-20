/**
 * OpenAPI 3.1 spesifikasjon for KETL Regnskap API.
 * Serveres som JSON fra GET /openapi.json
 * og som Scalar-UI fra GET /docs
 */

export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "KETL Regnskap API",
    version: "1.0.0",
    description:
      "REST API for KETL Regnskap — norsk AI-drevet regnskapssystem. " +
      "Autentisering via Firebase ID-token (Bearer) eller API-nøkkel (x-api-key). " +
      "Rate limit: 100 forespørsler/minutt per IP.",
    contact: {
      name: "KETL Support",
      url: "https://ketlcloud.web.app",
    },
    license: {
      name: "Proprietær",
    },
  },
  servers: [
    {
      url: "https://api-api-endpoint.run.app",
      description: "Produksjonsserver (Cloud Run)",
    },
    {
      url: "http://localhost:5001/ketlcloud/europe-west1/api",
      description: "Lokal utviklingsserver",
    },
  ],
  security: [
    { BearerAuth: [] },
    { ApiKeyAuth: [] },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Firebase ID-token. Hentes via Firebase Auth SDK.",
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "API-nøkkel opprettet i dashbordet (/dashboard/utvikler). Format: sk_live_...",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Ikke autentisert" },
        },
      },
      Klient: {
        type: "object",
        required: ["navn", "orgnr", "kontaktperson", "epost"],
        properties: {
          navn: { type: "string", example: "Eksempel AS" },
          orgnr: { type: "string", pattern: "^\\d{9}$", example: "987654321" },
          kontaktperson: { type: "string", example: "Ola Nordmann" },
          epost: { type: "string", format: "email", example: "ola@eksempel.no" },
          telefon: { type: "string", example: "+47 900 00 000" },
          adresse: { type: "string", example: "Gateveien 1, 0001 Oslo" },
          bransje: { type: "string", example: "IT og teknologi" },
        },
      },
      KlientMedId: {
        allOf: [
          { $ref: "#/components/schemas/Klient" },
          {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", example: "abc123" },
              opprettet: { type: "string", format: "date-time" },
            },
          },
        ],
      },
      Postering: {
        type: "object",
        required: ["kontonr", "kontonavn", "debet", "kredit"],
        properties: {
          kontonr: { type: "string", example: "6000" },
          kontonavn: { type: "string", example: "Kontorkostnader" },
          debet: { type: "number", example: 1250.0 },
          kredit: { type: "number", example: 0 },
          mvaKode: { type: "string", example: "1" },
          beskrivelse: { type: "string" },
        },
      },
      Bilag: {
        type: "object",
        properties: {
          id: { type: "string" },
          bilagsnr: { type: "integer", example: 1001 },
          dato: { type: "string", format: "date", example: "2026-03-15" },
          beskrivelse: { type: "string", example: "Kontorkostnader Q1" },
          belop: { type: "number", example: 1250.0 },
          klientId: { type: "string" },
          status: {
            type: "string",
            enum: ["ubehandlet", "foreslått", "bokført", "avvist", "kreditert", "arkivert"],
          },
          kategori: { type: "string" },
          leverandor: { type: "string" },
          posteringer: {
            type: "array",
            items: { $ref: "#/components/schemas/Postering" },
          },
        },
      },
      Resultatregnskap: {
        type: "object",
        properties: {
          driftsinntekter: {
            type: "array",
            items: {
              type: "object",
              properties: {
                konto: { type: "string" },
                navn: { type: "string" },
                belop: { type: "number" },
              },
            },
          },
          driftskostnader: {
            type: "array",
            items: {
              type: "object",
              properties: {
                konto: { type: "string" },
                navn: { type: "string" },
                belop: { type: "number" },
              },
            },
          },
          totalInntekter: { type: "number" },
          totalKostnader: { type: "number" },
          resultat: { type: "number" },
        },
      },
    },
  },
  paths: {
    "/": {
      get: {
        summary: "API-info",
        operationId: "getRoot",
        security: [],
        tags: ["Status"],
        responses: {
          "200": {
            description: "API-versjon og status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                        version: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/me": {
      get: {
        summary: "Hent innlogget bruker",
        operationId: "getMe",
        tags: ["Bruker"],
        responses: {
          "200": {
            description: "Brukerinformasjon",
          },
          "401": { description: "Ikke autentisert" },
        },
      },
    },
    "/v1/klienter": {
      get: {
        summary: "List klienter",
        operationId: "listKlienter",
        tags: ["Klienter"],
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        description: "Krever scope: `klienter:read`",
        responses: {
          "200": {
            description: "Liste med klienter",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/KlientMedId" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Ikke autentisert" },
          "403": { description: "Mangler scope klienter:read" },
        },
      },
      post: {
        summary: "Opprett klient",
        operationId: "createKlient",
        tags: ["Klienter"],
        description: "Krever scope: `klienter:write`",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Klient" },
            },
          },
        },
        responses: {
          "201": { description: "Klient opprettet" },
          "400": { description: "Valideringsfeil" },
          "401": { description: "Ikke autentisert" },
        },
      },
    },
    "/v1/klienter/{id}": {
      get: {
        summary: "Hent klient",
        operationId: "getKlient",
        tags: ["Klienter"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Klientdata" },
          "404": { description: "Ikke funnet" },
        },
      },
      put: {
        summary: "Oppdater klient",
        operationId: "updateKlient",
        tags: ["Klienter"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Klient" },
            },
          },
        },
        responses: {
          "200": { description: "Oppdatert" },
          "404": { description: "Ikke funnet" },
        },
      },
      delete: {
        summary: "Slett klient",
        operationId: "deleteKlient",
        tags: ["Klienter"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Slettet" },
          "404": { description: "Ikke funnet" },
        },
      },
    },
    "/v1/bilag": {
      get: {
        summary: "List bilag",
        operationId: "listBilag",
        tags: ["Bilag"],
        description: "Krever scope: `bilag:read`",
        parameters: [
          {
            name: "klientId",
            in: "query",
            schema: { type: "string" },
            description: "Filtrer på klient",
          },
        ],
        responses: {
          "200": {
            description: "Liste med bilag",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Bilag" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/bilag/{id}": {
      get: {
        summary: "Hent bilag",
        operationId: "getBilag",
        tags: ["Bilag"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Bilag med posteringer" },
          "404": { description: "Ikke funnet" },
        },
      },
    },
    "/v1/bilag/{id}/godkjenn": {
      patch: {
        summary: "Godkjenn AI-forslag",
        operationId: "godkjennBilag",
        tags: ["Bilag"],
        description: "Godkjenner AI-foreslåtte posteringer og bokfører bilaget. Krever scope: `bilag:write`",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Bilaget er bokført" },
          "400": { description: "Bilaget har ingen AI-forslag" },
        },
      },
    },
    "/v1/bilag/{id}/avvis": {
      patch: {
        summary: "Avvis AI-forslag",
        operationId: "avvisBilag",
        tags: ["Bilag"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Forslag avvist" } },
      },
    },
    "/v1/bilag/{id}/krediter": {
      post: {
        summary: "Krediter bokført bilag",
        operationId: "krediterBilag",
        tags: ["Bilag"],
        description: "Oppretter korrigeringsbilag med reverserte posteringer (Bokfl. § 9). Krever scope: `bilag:write`",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Korrigeringsbilag opprettet" },
          "400": { description: "Bilaget er ikke bokført" },
        },
      },
    },
    "/v1/rapporter/resultat": {
      get: {
        summary: "Resultatregnskap",
        operationId: "getResultat",
        tags: ["Rapporter"],
        description: "Krever scope: `rapporter:read`",
        parameters: [
          {
            name: "periode",
            in: "query",
            schema: { type: "string" },
            description: 'Periode — "YYYY-MM", "YYYY" eller "alt"',
            example: "2026-03",
          },
          { name: "klientId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Resultatregnskap",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/Resultatregnskap" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api-keys": {
      get: {
        summary: "List API-nøkler",
        operationId: "listApiKeys",
        tags: ["API-nøkler"],
        security: [{ BearerAuth: [] }],
        responses: { "200": { description: "Liste med API-nøkler (uten hashedKey)" } },
      },
      post: {
        summary: "Opprett API-nøkkel",
        operationId: "createApiKey",
        tags: ["API-nøkler"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "Produksjon" },
                  scopes: {
                    type: "array",
                    items: { type: "string" },
                    example: ["bilag:read", "rapporter:read"],
                    description: "Tomme scopes gir standard lesescopes",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Nøkkel opprettet — returner og lagre key-feltet umiddelbart!",
          },
        },
      },
    },
    "/api-keys/{id}": {
      delete: {
        summary: "Tilbakekall API-nøkkel",
        operationId: "revokeApiKey",
        tags: ["API-nøkler"],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Nøkkel tilbakekalt" } },
      },
    },
  },
  tags: [
    { name: "Status", description: "API-helse og versjonsinformasjon" },
    { name: "Bruker", description: "Brukerinformasjon" },
    { name: "Klienter", description: "Regnskapsklienter (bedrifter)" },
    { name: "Bilag", description: "Bilag, kvitteringer og posteringer" },
    { name: "Rapporter", description: "Resultatregnskap, balanse og MVA" },
    { name: "API-nøkler", description: "Administrasjon av API-nøkler" },
  ],
};

/** Generer HTML-side med Scalar API-dokumentasjon */
export function genererDocsHtml(specUrl: string): string {
  return `<!doctype html>
<html>
<head>
  <title>KETL API — Dokumentasjon</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <script
    id="api-reference"
    data-url="${specUrl}"
    data-configuration='{"theme":"purple","layout":"modern"}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}

import { NextRequest, NextResponse } from "next/server";

interface SiretRequest {
  nomCommercial: string;
  siren: string;
  siretSiege: string;
  ville: string;
  codePostal?: string;
  departement?: string;
}

interface SiretResponse {
  siret: string;
  confirmer: boolean;
  source: "cache" | "api-gov" | "pappers" | "claude" | "fallback";
}

// cache serveur par SIREN+ville (persiste entre requêtes dans le process)
const serverCache = new Map<string, SiretResponse>();

// file d'attente pour respecter la limite 7 req/s de l'API gouvernementale
let lastApiCall = 0;
async function throttle() {
  const now = Date.now();
  const elapsed = now - lastApiCall;
  if (elapsed < 145) {
    await new Promise((r) => setTimeout(r, 145 - elapsed));
  }
  lastApiCall = Date.now();
}

async function searchApiGov(
  nomCommercial: string,
  siren: string,
  ville: string,
  codePostal?: string,
  departement?: string
): Promise<string | null> {
  await throttle();

  const params = new URLSearchParams({ q: nomCommercial, per_page: "25" });
  if (codePostal) params.set("code_postal", codePostal);
  else if (departement) params.set("departement", departement);
  else params.set("commune", ville);

  const url = `https://recherche-entreprises.api.gouv.fr/search?${params}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const results: Array<{
    siren: string;
    matching_etablissements?: Array<{
      siret: string;
      etat_administratif: string;
      libelle_commune: string;
      code_postal: string;
      etablissement_siege: boolean;
    }>;
  }> = data.results ?? [];

  // trouver l'entreprise avec le bon SIREN
  const entreprise = results.find((r) => r.siren === siren);
  if (!entreprise) return null;

  const etabs = entreprise.matching_etablissements ?? [];
  const villeNorm = ville.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // chercher un établissement ouvert dans la bonne ville
  const candidats = etabs.filter((e) => {
    if (e.etat_administratif !== "A") return false;
    const libNorm = (e.libelle_commune ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    const cpMatch = codePostal ? e.code_postal === codePostal : true;
    return libNorm.includes(villeNorm) || cpMatch;
  });

  if (candidats.length === 0) return null;

  // préférer non-siège
  const nonSiege = candidats.find((e) => !e.etablissement_siege);
  return (nonSiege ?? candidats[0]).siret;
}

async function searchPappers(
  siren: string,
  ville: string,
  codePostal?: string
): Promise<string | null> {
  const apiKey = process.env.PAPPERS_API_KEY;
  if (!apiKey || !siren) return null;

  const url = `https://api.pappers.fr/v2/entreprise?api_token=${apiKey}&siren=${siren}&etablissements_par_page=100`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const etabs: Array<{
    siret: string;
    siege?: boolean;
    ferme?: boolean;
    ville?: string;
    code_postal?: string;
  }> = data.etablissements ?? [];

  const villeNorm = ville.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const candidats = etabs.filter((e) => {
    if (e.ferme) return false;
    const eVille = (e.ville ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const cpMatch = codePostal ? e.code_postal === codePostal : true;
    return eVille.includes(villeNorm) || villeNorm.includes(eVille) || cpMatch;
  });

  if (candidats.length === 0) return null;
  const nonSiege = candidats.find((e) => !e.siege);
  return (nonSiege ?? candidats[0]).siret ?? null;
}

async function searchClaude(
  nomCommercial: string,
  siren: string,
  ville: string
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: `Trouve le SIRET de l'établissement de "${nomCommercial}" (SIREN ${siren}) situé à ${ville}. Je veux le SIRET de l'établissement local, PAS le siège. Réponds UNIQUEMENT avec le SIRET à 14 chiffres ou "INTROUVABLE".`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) return null;
  const data = await res.json();

  const text: string =
    data.content
      ?.filter((b: { type: string }) => b.type === "text")
      ?.map((b: { text: string }) => b.text)
      ?.join("") ?? "";

  const match = text.match(/\b(\d{14})\b/);
  if (match && match[1].startsWith(siren)) return match[1];
  return null;
}

export async function POST(req: NextRequest) {
  const body: SiretRequest = await req.json();
  const { nomCommercial, siren, siretSiege, ville, codePostal, departement } = body;

  if (!siren) {
    return NextResponse.json<SiretResponse>({
      siret: siretSiege ?? "",
      confirmer: true,
      source: "fallback",
    });
  }

  const cacheKey = `${siren}|${ville.toLowerCase()}`;

  if (serverCache.has(cacheKey)) {
    return NextResponse.json(serverCache.get(cacheKey)!);
  }

  // Étape 1 — API gouvernementale
  try {
    const siret = await searchApiGov(nomCommercial, siren, ville, codePostal, departement);
    if (siret) {
      const result: SiretResponse = { siret, confirmer: false, source: "api-gov" };
      serverCache.set(cacheKey, result);
      if (process.env.NODE_ENV === "development") {
        console.log(`[SIRET] ${nomCommercial} / ${ville} → API-GOV → ${siret}`);
      }
      return NextResponse.json(result);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.warn("[SIRET] API-GOV error:", e);
  }

  // Étape 2 — Pappers
  try {
    const siret = await searchPappers(siren, ville, codePostal);
    if (siret) {
      const result: SiretResponse = { siret, confirmer: false, source: "pappers" };
      serverCache.set(cacheKey, result);
      if (process.env.NODE_ENV === "development") {
        console.log(`[SIRET] ${nomCommercial} / ${ville} → PAPPERS → ${siret}`);
      }
      return NextResponse.json(result);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.warn("[SIRET] Pappers error:", e);
  }

  // Étape 3 — Claude API + web_search
  try {
    const siret = await searchClaude(nomCommercial, siren, ville);
    if (siret) {
      const result: SiretResponse = { siret, confirmer: false, source: "claude" };
      serverCache.set(cacheKey, result);
      if (process.env.NODE_ENV === "development") {
        console.log(`[SIRET] ${nomCommercial} / ${ville} → CLAUDE → ${siret}`);
      }
      return NextResponse.json(result);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.warn("[SIRET] Claude error:", e);
  }

  // Fallback
  const fallback: SiretResponse = { siret: siretSiege ?? "", confirmer: true, source: "fallback" };
  serverCache.set(cacheKey, fallback);
  if (process.env.NODE_ENV === "development") {
    console.log(`[SIRET] ${nomCommercial} / ${ville} → FALLBACK → ${siretSiege}`);
  }
  return NextResponse.json(fallback);
}

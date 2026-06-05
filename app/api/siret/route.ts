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
  source: "cache" | "api-gov" | "pappers" | "openai" | "fallback";
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

/** Normalise une chaîne pour comparaison : minuscules + sans accents */
function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Vérifie si deux noms de ville correspondent */
function villeMatch(libelle: string, villeNorm: string) {
  if (!libelle || !villeNorm) return false;
  const l = norm(libelle);
  return l.includes(villeNorm) || villeNorm.includes(l);
}

// ─── Étape 1 : recherche-entreprises.api.gouv.fr (API gouvernementale gratuite) ─
// C'est l'API officielle qui alimente aussi le site annuaire-entreprises.data.gouv.fr.
// On cherche par nom + ville/code postal → matching_etablissements filtrés sur ce lieu.
async function searchApiGov(
  nomCommercial: string,
  siren: string,
  ville: string,
  codePostal?: string,
  departement?: string
): Promise<string | null> {
  await throttle();

  const params = new URLSearchParams({ q: nomCommercial, per_page: "25" });
  // Le paramètre `commune` attend un code INSEE, pas un nom → on privilégie
  // code_postal (5 chiffres) puis departement (2 chiffres). Sinon, recherche
  // texte simple et filtrage local sur le libellé de commune.
  if (codePostal) params.set("code_postal", codePostal);
  else if (departement) params.set("departement", departement);

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

  const entreprise = results.find((r) => r.siren === siren);
  if (!entreprise) return null;

  const etabs = entreprise.matching_etablissements ?? [];
  const villeNorm = norm(ville);

  // cpMatch: false par défaut → ne JAMAIS accepter un établissement d'une autre ville
  const candidats = etabs.filter((e) => {
    if (e.etat_administratif !== "A") return false;
    const cpMatch = codePostal ? e.code_postal === codePostal : false;
    return villeMatch(e.libelle_commune, villeNorm) || cpMatch;
  });

  if (candidats.length === 0) return null;
  const nonSiege = candidats.find((e) => !e.etablissement_siege);
  return (nonSiege ?? candidats[0]).siret;
}

// ─── Étape 2 : Pappers (si PAPPERS_API_KEY disponible) ───────────────────────
// Pappers retourne TOUS les établissements d'un SIREN (utile quand l'étape 1,
// limitée aux établissements correspondant à la recherche, ne trouve rien).
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

  const villeNorm = norm(ville);

  const candidats = etabs.filter((e) => {
    if (e.ferme) return false;
    const cpMatch = codePostal ? e.code_postal === codePostal : false;
    return villeMatch(e.ville ?? "", villeNorm) || cpMatch;
  });

  if (candidats.length === 0) return null;
  const nonSiege = candidats.find((e) => !e.siege);
  return (nonSiege ?? candidats[0]).siret ?? null;
}

// ─── Vérification d'un SIRET via l'API gouvernementale ───────────────────────
// Confirme qu'un SIRET (peu importe sa provenance) existe, est ACTIF, et que sa
// commune correspond bien à la ville attendue. Évite d'accepter une hallucination
// de l'IA ou un SIRET d'une autre ville. Retourne true si le SIRET est valide.
async function verifySiret(
  siret: string,
  ville: string,
  codePostal?: string
): Promise<boolean> {
  await throttle();

  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&per_page=5`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return false;

  const data = await res.json();
  const results: Array<{
    matching_etablissements?: Array<{
      siret: string;
      etat_administratif: string;
      libelle_commune: string;
      code_postal: string;
    }>;
  }> = data.results ?? [];

  const villeNorm = norm(ville);
  for (const r of results) {
    const etab = (r.matching_etablissements ?? []).find((e) => e.siret === siret);
    if (!etab) continue;
    if (etab.etat_administratif !== "A") return false; // fermé → refusé
    const cpMatch = codePostal ? etab.code_postal === codePostal : false;
    return villeMatch(etab.libelle_commune, villeNorm) || cpMatch;
  }
  return false;
}

// ─── Étape 3 : OpenAI avec web search (si OPENAI_API_KEY disponible) ──────────
// Cas difficiles : grands groupes éclatés en plusieurs entités juridiques
// (ex: Airbus Helicopters / Airbus Atlantic — SIREN différents). Le contact peut
// travailler dans un établissement d'un AUTRE SIREN que celui du fichier.
// On laisse donc OpenAI proposer un SIRET sans contrainte de SIREN, PUIS on le
// vérifie systématiquement via l'API gouvernementale (existe + actif + bonne ville).
async function searchOpenAI(
  nomCommercial: string,
  siren: string,
  ville: string,
  codePostal?: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Trouve le SIRET (14 chiffres) de l'établissement où travaille un salarié de "${nomCommercial}" (groupe SIREN ${siren}) situé à ${ville}${
    codePostal ? ` (code postal ${codePostal})` : ""
  }. Je veux l'établissement LOCAL à ${ville}, PAS le siège social. Attention : dans les grands groupes, cet établissement peut appartenir à une filiale au SIREN différent (ex: Airbus Helicopters vs Airbus Atlantic). Réponds UNIQUEMENT avec le SIRET à 14 chiffres, sans espace, ou le mot INTROUVABLE.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-search-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) return null;
  const data = await res.json();

  const answer: string = data.choices?.[0]?.message?.content?.trim() ?? "";
  const match = answer.match(/\b(\d{14})\b/);
  if (!match) return null;

  const siret = match[1];
  // Vérification gouvernementale obligatoire avant d'accepter (anti-hallucination).
  const ok = await verifySiret(siret, ville, codePostal);
  return ok ? siret : null;
}

// ─── Handler principal ────────────────────────────────────────────────────────
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

  // Étape 1 — recherche-entreprises.api.gouv.fr (gratuit)
  try {
    const siret = await searchApiGov(nomCommercial, siren, ville, codePostal, departement);
    if (siret) {
      const result: SiretResponse = { siret, confirmer: false, source: "api-gov" };
      serverCache.set(cacheKey, result);
      return NextResponse.json(result);
    }
  } catch { /* timeout ou erreur réseau */ }

  // Étape 2 — Pappers (si PAPPERS_API_KEY configurée)
  try {
    const siret = await searchPappers(siren, ville, codePostal);
    if (siret) {
      const result: SiretResponse = { siret, confirmer: false, source: "pappers" };
      serverCache.set(cacheKey, result);
      return NextResponse.json(result);
    }
  } catch { /* timeout ou erreur réseau */ }

  // Étape 3 — OpenAI web search (si OPENAI_API_KEY configurée)
  try {
    const siret = await searchOpenAI(nomCommercial, siren, ville, codePostal);
    if (siret) {
      const result: SiretResponse = { siret, confirmer: false, source: "openai" };
      serverCache.set(cacheKey, result);
      return NextResponse.json(result);
    }
  } catch { /* timeout ou erreur réseau */ }

  // Fallback — SIRET du siège à confirmer
  const fallback: SiretResponse = { siret: siretSiege ?? "", confirmer: true, source: "fallback" };
  serverCache.set(cacheKey, fallback);
  return NextResponse.json(fallback);
}

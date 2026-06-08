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
  adresse: string; // adresse de l'établissement trouvé (aperçu uniquement)
  confirmer: boolean;
  source: "cache" | "api-gov" | "groupe" | "pappers" | "openai" | "fallback";
}

// résultat interne d'une recherche : SIRET + adresse de l'établissement
type EtabResult = { siret: string; adresse: string };

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

/** Vérifie qu'un nom d'entreprise trouvé correspond au nom commercial recherché.
 *  Exige qu'au moins un mot significatif (≥3 lettres) soit commun. Bloque les
 *  faux positifs d'OpenAI (société sans rapport) tout en acceptant les filiales
 *  (ex: "Neo2" ⊂ "NEO2 RA", "Airbus" ⊂ "Airbus Atlantic"). */
function nomMatch(nomTrouve: string, nomCommercial: string) {
  const cible = norm(nomTrouve);
  const tokens = norm(nomCommercial)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return true; // pas de nom exploitable → on ne bloque pas
  return tokens.some((t) => cible.includes(t));
}

// ─── Étape 1 : recherche-entreprises.api.gouv.fr (API gouvernementale gratuite) ─
// C'est l'API officielle qui alimente aussi le site annuaire-entreprises.data.gouv.fr.
async function searchApiGov(
  nomCommercial: string,
  siren: string,
  ville: string,
  codePostal?: string,
  departement?: string
): Promise<EtabResult | null> {
  await throttle();

  const params = new URLSearchParams({ q: nomCommercial, per_page: "25" });
  // `commune` attend un code INSEE → on privilégie code_postal puis departement.
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
      adresse?: string;
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
  const choisi = candidats.find((e) => !e.etablissement_siege) ?? candidats[0];
  return { siret: choisi.siret, adresse: choisi.adresse ?? "" };
}

// ─── Étape 2 : recherche par nom commercial + ville, TOUS SIREN du groupe ────
// Gère les groupes éclatés en filiales (ex: NEO2 → NEO2 NORD à Lille, NEO2 RA à
// Lyon ; SIREN différents). On cherche par nom + lieu et on accepte tout
// établissement actif dont le nom d'entreprise correspond au nom commercial.
// Gratuit et déterministe (tri stable des candidats).
async function searchGroupeByNom(
  nomCommercial: string,
  ville: string,
  codePostal?: string,
  departement?: string
): Promise<EtabResult | null> {
  if (!codePostal && !departement) return null; // sans localisation → trop large
  await throttle();

  const params = new URLSearchParams({ q: nomCommercial, per_page: "25" });
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
    nom_complet?: string;
    matching_etablissements?: Array<{
      siret: string;
      etat_administratif: string;
      libelle_commune: string;
      code_postal: string;
      adresse?: string;
      etablissement_siege: boolean;
    }>;
  }> = data.results ?? [];

  const villeNorm = norm(ville);
  const candidats: Array<{ siret: string; adresse: string; siege: boolean }> = [];

  for (const r of results) {
    // l'entreprise trouvée doit porter le nom commercial recherché (ex: "neo2")
    if (!nomMatch(r.nom_complet ?? "", nomCommercial)) continue;
    for (const e of r.matching_etablissements ?? []) {
      if (e.etat_administratif !== "A") continue;
      const cpMatch = codePostal ? e.code_postal === codePostal : false;
      if (!villeMatch(e.libelle_commune, villeNorm) && !cpMatch) continue;
      candidats.push({
        siret: e.siret,
        adresse: e.adresse ?? "",
        siege: e.etablissement_siege,
      });
    }
  }

  if (candidats.length === 0) return null;
  // déterminisme : non-siège d'abord, puis tri par SIRET croissant
  candidats.sort((a, b) =>
    a.siege === b.siege ? a.siret.localeCompare(b.siret) : a.siege ? 1 : -1
  );
  return { siret: candidats[0].siret, adresse: candidats[0].adresse };
}

// ─── Étape 3 : Pappers (si PAPPERS_API_KEY disponible, tous établissements) ──
async function searchPappers(
  siren: string,
  ville: string,
  codePostal?: string
): Promise<EtabResult | null> {
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
    adresse_ligne_1?: string;
  }> = data.etablissements ?? [];

  const villeNorm = norm(ville);

  const candidats = etabs.filter((e) => {
    if (e.ferme) return false;
    const cpMatch = codePostal ? e.code_postal === codePostal : false;
    return villeMatch(e.ville ?? "", villeNorm) || cpMatch;
  });

  if (candidats.length === 0) return null;
  const choisi = candidats.find((e) => !e.siege) ?? candidats[0];
  const adresse = [choisi.adresse_ligne_1, choisi.code_postal, choisi.ville]
    .filter(Boolean)
    .join(" ");
  return { siret: choisi.siret ?? "", adresse };
}

// ─── Vérification d'un SIRET via l'API gouvernementale ───────────────────────
// Confirme qu'un SIRET (peu importe sa provenance) existe, est ACTIF, que sa
// commune correspond à la ville attendue ET que le nom de l'entreprise correspond
// au nom commercial recherché. Retourne l'adresse si valide, sinon null.
async function verifySiret(
  siret: string,
  nomCommercial: string,
  ville: string,
  codePostal?: string
): Promise<EtabResult | null> {
  await throttle();

  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&per_page=5`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const results: Array<{
    nom_complet?: string;
    matching_etablissements?: Array<{
      siret: string;
      etat_administratif: string;
      libelle_commune: string;
      code_postal: string;
      adresse?: string;
      nom_commercial?: string;
      liste_enseignes?: string[];
    }>;
  }> = data.results ?? [];

  const villeNorm = norm(ville);
  for (const r of results) {
    const etab = (r.matching_etablissements ?? []).find((e) => e.siret === siret);
    if (!etab) continue;
    if (etab.etat_administratif !== "A") return null; // fermé → refusé
    const cpMatch = codePostal ? etab.code_postal === codePostal : false;
    const villeOk = villeMatch(etab.libelle_commune, villeNorm) || cpMatch;
    if (!villeOk) return null; // mauvaise ville → refusé
    // vérification du nom : nom_complet OU nom_commercial OU enseignes
    const nomCible = [r.nom_complet, etab.nom_commercial, ...(etab.liste_enseignes ?? [])]
      .filter(Boolean)
      .join(" ");
    if (!nomMatch(nomCible, nomCommercial)) return null; // entreprise sans rapport → refusé
    return { siret, adresse: etab.adresse ?? "" };
  }
  return null;
}

// ─── Étape 4 : OpenAI avec web search (si OPENAI_API_KEY disponible) ──────────
// Cas difficiles : grands groupes éclatés en plusieurs entités juridiques
// (ex: Airbus Helicopters / Airbus Atlantic, Neo2 / Neo2 RA — SIREN différents).
// OpenAI propose un SIRET sans contrainte de SIREN, PUIS verifySiret valide tout.
async function searchOpenAI(
  nomCommercial: string,
  siren: string,
  ville: string,
  codePostal?: string
): Promise<EtabResult | null> {
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

  // Vérification gouvernementale obligatoire (existe + actif + ville + nom).
  return verifySiret(match[1], nomCommercial, ville, codePostal);
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body: SiretRequest = await req.json();
  const { nomCommercial, siren, siretSiege, ville, codePostal, departement } = body;

  if (!siren) {
    return NextResponse.json<SiretResponse>({
      siret: siretSiege ?? "",
      adresse: "",
      confirmer: true,
      source: "fallback",
    });
  }

  const cacheKey = `${siren}|${ville.toLowerCase()}`;
  if (serverCache.has(cacheKey)) {
    return NextResponse.json(serverCache.get(cacheKey)!);
  }

  const finish = (etab: EtabResult, source: SiretResponse["source"]) => {
    const result: SiretResponse = {
      siret: etab.siret,
      adresse: etab.adresse,
      confirmer: false,
      source,
    };
    serverCache.set(cacheKey, result);
    return NextResponse.json(result);
  };

  // Étape 1 — recherche-entreprises.api.gouv.fr, SIREN strict (gratuit)
  try {
    const etab = await searchApiGov(nomCommercial, siren, ville, codePostal, departement);
    if (etab) return finish(etab, "api-gov");
  } catch { /* timeout ou erreur réseau */ }

  // Étape 2 — recherche par nom commercial + ville, tous SIREN du groupe (gratuit)
  try {
    const etab = await searchGroupeByNom(nomCommercial, ville, codePostal, departement);
    if (etab) return finish(etab, "groupe");
  } catch { /* timeout ou erreur réseau */ }

  // Étape 3 — Pappers (si PAPPERS_API_KEY configurée)
  try {
    const etab = await searchPappers(siren, ville, codePostal);
    if (etab) return finish(etab, "pappers");
  } catch { /* timeout ou erreur réseau */ }

  // Étape 3 — OpenAI web search (si OPENAI_API_KEY configurée)
  try {
    const etab = await searchOpenAI(nomCommercial, siren, ville, codePostal);
    if (etab) return finish(etab, "openai");
  } catch { /* timeout ou erreur réseau */ }

  // Fallback — SIRET du siège à confirmer
  const fallback: SiretResponse = {
    siret: siretSiege ?? "",
    adresse: "",
    confirmer: true,
    source: "fallback",
  };
  serverCache.set(cacheKey, fallback);
  return NextResponse.json(fallback);
}

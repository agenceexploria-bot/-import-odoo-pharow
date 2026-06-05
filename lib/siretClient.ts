import { PharowRow } from "./csvParser";
import { parseVille } from "./villeParser";

export interface SiretResult {
  siret: string;
  confirmer: boolean;
  source: "cache" | "api-gov" | "pappers" | "openai" | "fallback";
}

// cache côté front par SIREN+ville
const cache = new Map<string, SiretResult>();

export async function resolveSiret(
  row: PharowRow,
  onProgress?: (msg: string) => void
): Promise<SiretResult> {
  const siren = (row["SIREN"] ?? "").trim();
  const siretSiege = (row["SIRET du siège"] ?? "").trim();
  const nomCommercial = (row["Nom commercial"] ?? "").trim();
  const villeInfo = parseVille(row["Ville de résidence"] ?? "");

  const cacheKey = `${siren}|${villeInfo.ville.toLowerCase()}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  onProgress?.(`Recherche SIRET — API gouvernementale…`);

  try {
    const res = await fetch("/api/siret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomCommercial,
        siren,
        siretSiege,
        ville: villeInfo.ville,
        codePostal: villeInfo.codePostal,
        departement: villeInfo.departement,
      }),
    });

    if (!res.ok) throw new Error("API error");
    const data: SiretResult = await res.json();
    cache.set(cacheKey, data);
    return data;
  } catch {
    const fallback: SiretResult = {
      siret: siretSiege,
      confirmer: true,
      source: "fallback",
    };
    cache.set(cacheKey, fallback);
    return fallback;
  }
}

export function clearSiretCache() {
  cache.clear();
}

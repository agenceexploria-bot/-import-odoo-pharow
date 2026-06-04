// app/api/siret/route.ts
// Remplace l'ancienne version Anthropic par OpenAI

import { NextRequest, NextResponse } from "next/server";

const cache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const { siren, nomCommercial, ville } = await req.json();

    if (!siren || !ville) {
      return NextResponse.json({ error: "siren et ville requis" }, { status: 400 });
    }

    const cacheKey = `${siren}__${ville.toLowerCase().trim()}`;
    if (cache.has(cacheKey)) {
      return NextResponse.json({ siret: cache.get(cacheKey), source: "cache" });
    }

    // 1. Essai API gouvernementale
    try {
      const govUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(nomCommercial)}&siren=${siren}&limit=25`;
      const govRes = await fetch(govUrl, { signal: AbortSignal.timeout(5000) });
      if (govRes.ok) {
        const govData = await govRes.json();
        const etabs = govData?.results?.[0]?.matching_etablissements ?? [];
        const villeNorm = ville.replace(/\s*\(.*\)/, "").trim().toLowerCase();

        const match = etabs.find((e: any) => {
          const libelle = (e.libelle_commune ?? "").toLowerCase();
          return libelle.includes(villeNorm) || villeNorm.includes(libelle);
        });

        if (match?.siret) {
          cache.set(cacheKey, match.siret);
          return NextResponse.json({ siret: match.siret, source: "api-gouv" });
        }
      }
    } catch (_) {
      // timeout ou erreur réseau → on passe à OpenAI
    }

    // 2. Fallback OpenAI avec web search (function calling)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ siret: null, source: "no-ai-key" });
    }

    const prompt = `Trouve le SIRET de l'établissement de "${nomCommercial}" (SIREN ${siren}) situé à ${ville}. Je veux le SIRET de l'établissement LOCAL, PAS le siège social. Réponds UNIQUEMENT avec le SIRET à 14 chiffres (sans espace) ou le mot INTROUVABLE. Rien d'autre.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-search-preview", // modèle avec accès web
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error("OpenAI error:", err);
      return NextResponse.json({ siret: null, source: "openai-error" });
    }

    const openaiData = await openaiRes.json();
    const answer = openaiData?.choices?.[0]?.message?.content?.trim() ?? "";

    // Extraire 14 chiffres consécutifs si présents
    const siretMatch = answer.match(/\b\d{14}\b/);
    if (siretMatch) {
      const siret = siretMatch[0];
      cache.set(cacheKey, siret);
      return NextResponse.json({ siret, source: "openai" });
    }

    return NextResponse.json({ siret: null, source: "not-found" });
  } catch (error: any) {
    console.error("SIRET route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

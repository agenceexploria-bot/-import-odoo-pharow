import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `Tu es ActIA, l'assistant IA intégré à Acticonvert — l'outil interne d'Actiwork pour convertir des exports Pharow/Kaspr en fichiers CSV prêts pour l'import dans Odoo.

Ton rôle :
• Répondre aux questions sur l'utilisation d'Acticonvert
• Rechercher des SIRET et SIREN d'entreprises françaises à la demande
• Expliquer le mapping des colonnes Pharow → Odoo et aider à comprendre les résultats de conversion

Fonctionnement d'Acticonvert (4 étapes) :
1. Importer — déposer un fichier CSV exporté depuis Pharow ou Kaspr
2. Vérifier le mapping — revoir les correspondances colonnes → champs Odoo (mapping fixe pour Pharow/Kaspr)
3. Convertir — traitement automatique + résolution des SIRET (API gouvernementale → Pappers → Claude web search)
4. Télécharger — récupérer le CSV prêt pour l'import Odoo

Mapping Pharow/Kaspr → Odoo :
- "Prénom + Nom" → name (formaté NOM Prénom)
- "Email" → email (champ requis dans Odoo)
- "Poste occupé" → function + job_position_id (catégorisé automatiquement)
- "URL LinkedIn" → website
- "Tél portable" → phone
- "Tél Kaspr (1/2/3)" → mobile (meilleur numéro des 3)
- "SIRET du siège" → SIRET (vérifié via API INSEE + Pappers)
- "Nom commercial" → Company (fixé à Actiwork)
- "SIREN" → utilisé pour la résolution SIRET, non exporté dans le CSV
- "Ville de résidence" → usage interne uniquement, non exporté

Options de conversion :
- Prospecteur : "AW - A prospecter par BD (Audrey)" | "AW - A prospecter par Guillaume" | "Aucune étiquette"
- Résolution SIRET : activable/désactivable. Quand activée, l'app interroge l'API gouvernementale (recherche-entreprises.api.gouv.fr), puis par nom commercial + ville, puis Pappers si disponible, puis OpenAI web search si nécessaire.
- Format de sortie : CSV uniquement, séparateur virgule, UTF-8, compatible import Odoo.

"SIRET À CONFIRMER" = l'API n'a pas trouvé l'établissement local de l'entreprise. Le SIRET du siège est utilisé comme valeur par défaut. L'utilisateur doit vérifier manuellement dans Odoo.

Réponds en français, de façon concise et directe. Utilise l'outil de recherche SIRET dès que l'utilisateur demande de trouver un SIRET ou des informations sur un établissement.`;

const TOOLS = [
  {
    name: "rechercher_siret",
    description:
      "Recherche le SIRET ou SIREN d'un établissement d'une entreprise française à partir de son nom et de sa ville. Utilise cet outil dès que l'utilisateur demande le SIRET, le SIREN ou des informations sur un établissement précis.",
    input_schema: {
      type: "object" as const,
      properties: {
        nom_entreprise: {
          type: "string",
          description: "Nom commercial ou raison sociale de l'entreprise (ex: 'Air Liquide', 'Michelin', 'Schneider Electric')",
        },
        ville: {
          type: "string",
          description: "Ville où se trouve l'établissement recherché (ex: 'Paris', 'Lyon', 'Clermont-Ferrand')",
        },
        siren: {
          type: "string",
          description: "Numéro SIREN à 9 chiffres si déjà connu (optionnel)",
        },
      },
      required: ["nom_entreprise", "ville"],
    },
  },
];

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, string> };

interface AnthropicMessage {
  stop_reason: string;
  content: ContentBlock[];
}

async function callClaude(messages: object[]): Promise<AnthropicMessage> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      content:
        "⚠️ ActIA n'est pas encore activée — la clé API est manquante sur le serveur. Contactez l'administrateur Actiwork.",
    });
  }

  const { messages } = await req.json();

  try {
    const msg1 = await callClaude(messages);

    if (msg1.stop_reason === "tool_use") {
      const toolBlock = msg1.content.find(
        (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
      );

      if (toolBlock?.name === "rechercher_siret") {
        const { nom_entreprise, ville, siren = "" } = toolBlock.input;

        // Derive base URL from request headers
        const proto = req.headers.get("x-forwarded-proto") ?? "https";
        const host = req.headers.get("host") ?? "localhost:3000";
        const baseUrl =
          process.env.NODE_ENV === "development"
            ? "http://localhost:3000"
            : `${proto}://${host}`;

        let toolResult: object;
        try {
          const siretRes = await fetch(`${baseUrl}/api/siret`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nomCommercial: nom_entreprise,
              siren,
              siretSiege: "",
              ville,
            }),
          });
          toolResult = siretRes.ok
            ? await siretRes.json()
            : { error: "API SIRET indisponible" };
        } catch {
          toolResult = { error: "Erreur réseau lors de la recherche SIRET" };
        }

        const msg2 = await callClaude([
          ...messages,
          { role: "assistant", content: msg1.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: JSON.stringify(toolResult),
              },
            ],
          },
        ]);

        const text = msg2.content.find(
          (b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text"
        );
        return NextResponse.json({ content: text?.text ?? "Aucune réponse." });
      }
    }

    const text = msg1.content.find(
      (b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text"
    );
    return NextResponse.json({ content: text?.text ?? "Aucune réponse." });
  } catch (err) {
    console.error("[ActIA]", err);
    return NextResponse.json({
      content: "Une erreur s'est produite. Veuillez réessayer.",
    });
  }
}

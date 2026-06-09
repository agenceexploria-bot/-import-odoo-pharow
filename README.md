# Acticonvert — Pharow → Contacts Odoo (Actiwork)

Transforme un export CSV Pharow/Kaspr en fichier CSV prêt à importer dans Odoo (module Contacts).

**Parcours** : charger CSV → choisir étiquette → convertir → télécharger

Déployé sur : [convert-pharow-odoo.netlify.app](https://convert-pharow-odoo.netlify.app)

---

## Lancer en local

### Prérequis
- [Node.js LTS](https://nodejs.org) installé

### Commandes
```bash
cd import-odoo-pharow
npm install
npm run dev
```
Ouvrir [http://localhost:3000](http://localhost:3000)

---

## Déployer sur Netlify

1. **Pousser sur GitHub** — le repo est déjà connecté à Netlify via `agenceexploria-bot`.

2. **Chaque `git push` sur `main` redéploie automatiquement.**

3. **Configurer les variables d'environnement** (optionnel — activent les étapes de secours SIRET) :
   - Dans Netlify → Site configuration → Environment variables
   - `PAPPERS_API_KEY` : active la recherche via Pappers (tous établissements du SIREN)
   - `OPENAI_API_KEY` : active la recherche via OpenAI web search (grands groupes multi-entités)
   - Sans ces clés, la recherche SIRET utilise uniquement l'API gouvernementale + fallback siège.

---

## Architecture

```
app/
  page.tsx                    ← UI principale (4 étapes)
  api/siret/route.ts          ← API route SIRET (côté serveur)
  api/actia/route.ts          ← API route assistant ActIA
lib/
  csvParser.ts                ← Parsing CSV Pharow (2 formats Excel/standard)
  transform.ts                ← Transformations colonnes → CSV Odoo
  posteMatcher.ts             ← Matching poste Odoo (mots-clés + fuzzy)
  siretClient.ts              ← Client front → /api/siret (avec cache session)
  villeParser.ts              ← Extraction ville / code postal / département
```

## Cascade recherche SIRET

1. Cache session (SIREN + ville)
2. API gouvernementale `recherche-entreprises.api.gouv.fr` — recherche par SIREN strict
3. API gouvernementale — recherche par nom commercial + ville (groupes éclatés en filiales)
4. Pappers *(si `PAPPERS_API_KEY` configurée)* — tous établissements du SIREN
5. OpenAI web search *(si `OPENAI_API_KEY` configurée)* — grands groupes multi-entités + vérification gouvernementale
6. Fallback : SIRET du siège + "SIRET A CONFIRMER" dans la colonne comment

> **Note** : les SIREN/SIRET tronqués par Excel (zéro initial supprimé) sont automatiquement corrigés avant toute recherche.

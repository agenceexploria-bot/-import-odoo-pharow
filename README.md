# Import Odoo — Pharow → Contacts Odoo (Actiwork)

Transforme un export CSV Pharow/Kaspr en fichier CSV prêt à importer dans Odoo (module Contacts).

**Parcours** : charger CSV → choisir étiquette → cliquer → télécharger

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

## Déployer sur Vercel (recommandé)

1. **Créer un dépôt GitHub** — pousser ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # créer un repo sur github.com puis :
   git remote add origin https://github.com/VOTRE_ORG/import-odoo-pharow.git
   git push -u origin main
   ```

2. **Connecter Vercel** — aller sur [vercel.com](https://vercel.com) → "New Project" → importer le dépôt GitHub → Deploy.

3. **Configurer la variable d'environnement** (optionnel — active la recherche SIRET par IA en secours) :
   - Dans Vercel → Settings → Environment Variables
   - Ajouter : `ANTHROPIC_API_KEY` = votre clé Anthropic
   - Sans cette clé, la recherche SIRET utilise uniquement l'API gouvernementale + fallback siège.

4. **Chaque `git push` redéploie automatiquement.**

---

## Architecture

```
app/
  page.tsx                    ← UI principale (4 étapes)
  api/siret/route.ts          ← API route SIRET (côté serveur)
lib/
  csvParser.ts                ← Parsing CSV Pharow (2 formats)
  transform.ts                ← Transformations colonnes → CSV Odoo
  posteMatcher.ts             ← Matching poste Odoo (mots-clés + fuzzy)
  siretClient.ts              ← Client front → /api/siret
  villeParser.ts              ← Extraction ville / code postal / département
```

## Cascade recherche SIRET

1. Cache session (SIREN + ville)
2. API gouvernementale `recherche-entreprises.api.gouv.fr`
3. Claude API + web_search *(si `ANTHROPIC_API_KEY` configurée)*
4. Fallback : SIRET du siège + "SIRET A CONFIRMER" dans la colonne comment

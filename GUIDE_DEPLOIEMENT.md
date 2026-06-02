# Guide de déploiement — Import Odoo (pour Kenzo)

Ce guide explique, étape par étape, comment mettre l'application en ligne pour que
toute l'équipe puisse l'utiliser via une simple adresse web. **Aucune compétence
technique requise.** Compte tenu du choix retenu, on déploie **sans clé IA** (gratuit,
recherche SIRET via l'API gouvernementale). On pourra ajouter l'IA plus tard.

Durée totale : ~20 minutes. Tout est gratuit.

---

## Vue d'ensemble (le principe)

```
Ton PC (le code)  →  GitHub (coffre-fort du code)  →  Vercel (met en ligne)  →  URL pour l'équipe
```

- **GitHub** = l'endroit où le code est stocké en sécurité.
- **Vercel** = le service qui transforme le code en site web accessible.
- À chaque modification envoyée sur GitHub, Vercel met à jour le site tout seul.

---

## Étape 1 — Créer un compte GitHub (5 min)

> 💡 Conseil sécurité : crée le compte avec une **adresse email Actiwork**
> (ex. `tech@actiwork...`), pas une adresse perso. Comme ça l'app reste à
> l'entreprise même si quelqu'un part.

1. Aller sur [github.com](https://github.com)
2. Cliquer **Sign up**
3. Renseigner email pro, mot de passe, nom d'utilisateur
4. Valider l'email reçu

---

## Étape 2 — Installer GitHub Desktop (5 min)

C'est l'outil le plus simple pour envoyer le code sur GitHub, sans ligne de commande.

1. Télécharger [GitHub Desktop](https://desktop.github.com)
2. Installer, puis **se connecter** avec le compte GitHub de l'étape 1

---

## Étape 3 — Envoyer le code sur GitHub (3 min)

1. Dans GitHub Desktop : menu **File → Add local repository**
2. Choisir le dossier :
   `E:\Claude Code\Actiwork\import-odoo-pharow`
3. S'il propose **"create a repository"**, accepter.
   - Name : `import-odoo-pharow`
   - Laisser le reste par défaut → **Create repository**
4. En bas à gauche, écrire un résumé : `Version initiale` → cliquer **Commit to main**
5. En haut, cliquer **Publish repository**
   - ⚠️ **Décocher "Keep this code private"** seulement si tu veux le rendre public.
     Pour un usage interne, **laisse coché Private** (recommandé).
   - Cliquer **Publish repository**

✅ Le code est maintenant sur GitHub, en privé.

> 🔒 Le fichier `.gitignore` empêche déjà d'envoyer le dossier `node_modules`
> et tout fichier de secret (`.env`). Rien de sensible ne part sur GitHub.

---

## Étape 4 — Créer un compte Vercel et déployer (5 min)

1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer **Sign Up** → choisir **Continue with GitHub**
   (ça relie automatiquement Vercel à ton GitHub)
3. Autoriser Vercel à accéder à tes dépôts
4. Sur le tableau de bord Vercel : **Add New… → Project**
5. Trouver `import-odoo-pharow` dans la liste → cliquer **Import**
6. Laisser **tous les réglages par défaut** (Vercel détecte Next.js tout seul)
7. Cliquer **Deploy**
8. Patienter ~1 à 2 minutes → écran de félicitations 🎉

✅ Vercel affiche une adresse du type :
`https://import-odoo-pharow.vercel.app`

**C'est cette adresse que tu partages à toute l'équipe.** Ils l'ouvrent dans
leur navigateur, rien à installer.

---

## Étape 5 — Tester

1. Ouvrir l'URL Vercel
2. Charger un export Pharow de test
3. Choisir une étiquette → Lancer → Télécharger le CSV
4. Vérifier que le CSV s'importe bien dans Odoo

---

## Et après ? Modifier l'application

Quand on veut changer quelque chose (ajouter un commercial, ajuster une règle) :
1. La modif se fait dans le code (par toi ou par l'équipe technique)
2. Dans GitHub Desktop : **Commit** puis **Push origin**
3. Vercel redéploie automatiquement en ~1 min. L'URL ne change pas.

---

## Plus tard (optionnel) — Activer le secours par IA

Si on constate trop de "SIRET A CONFIRMER" et qu'on veut améliorer la recherche :

1. Obtenir une clé sur [console.anthropic.com](https://console.anthropic.com)
   (compte au nom de l'entreprise)
2. Sur Vercel : projet → **Settings → Environment Variables**
3. Ajouter :
   - **Key** : `ANTHROPIC_API_KEY`
   - **Value** : la clé (commence par `sk-ant-...`)
   - Environnement : cocher **Production**
4. **Save**, puis onglet **Deployments → ⋯ → Redeploy**

> 🔒 La clé reste **uniquement sur le serveur Vercel**. Elle n'est jamais
> visible dans le navigateur ni dans le code. Les utilisateurs ne la voient
> jamais. C'est la façon propre et sécurisée de gérer un secret.

---

## Récapitulatif sécurité

| Bonne pratique | Pourquoi |
|---|---|
| Compte GitHub/Vercel avec email **entreprise** | L'app survit au départ d'un employé |
| Dépôt GitHub en **Private** | Le code reste interne |
| `.gitignore` en place | Aucun secret ni dossier lourd envoyé |
| Clé API (si ajoutée) **uniquement dans Vercel** | Jamais exposée au navigateur |
| URL Vercel partagée à l'équipe | Personne n'installe rien, zéro maintenance côté utilisateur |

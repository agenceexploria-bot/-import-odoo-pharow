# Guide d'installation — Acticonvert (Pharow → Odoo)

> **Instructions pour Claude Code**
> La personne qui te remet ce document part de zéro. Elle n'est pas technique.
> Ton rôle est de l'accompagner étape par étape, de tout orchestrer, et de vérifier
> chaque étape avant de passer à la suivante. Sois pédagogue, simple, et rassure-la
> à chaque étape réussie.

---

## Ce que tu vas installer

Une application web qui convertit des exports CSV Pharow/Kaspr en fichiers prêts à importer dans Odoo. Elle sera hébergée gratuitement sur Netlify et accessible via une URL publique.

---

## Étape 1 — Installer les outils sur la machine

### 1.1 Node.js
- Demande à la personne d'aller sur [https://nodejs.org](https://nodejs.org)
- Télécharger et installer la version **LTS** (bouton vert à gauche)
- Vérifier l'installation en ouvrant un terminal et en tapant :
```bash
node -v
npm -v
```
Les deux commandes doivent afficher un numéro de version. Si c'est ok, passe à l'étape suivante.

### 1.2 Git
- Aller sur [https://git-scm.com](https://git-scm.com) → télécharger et installer
- Vérifier :
```bash
git -v
```
Doit afficher un numéro de version.

---

## Étape 2 — Créer un compte GitHub

- Aller sur [https://github.com](https://github.com) → "Sign up"
- Créer un compte gratuit avec son email
- Confirmer l'email reçu
- **Sauvegarder** : email + mot de passe utilisés

---

## Étape 3 — Récupérer le code source

### 3.1 Forker le repo
- Aller sur : [https://github.com/agenceexploria-bot/-import-odoo-pharow](https://github.com/agenceexploria-bot/-import-odoo-pharow)
- Cliquer sur le bouton **"Fork"** en haut à droite
- Laisser les options par défaut → cliquer **"Create fork"**
- Elle a maintenant sa propre copie du repo sur son compte GitHub

### 3.2 Cloner sur sa machine
- Sur sa page GitHub, ouvrir le repo forké
- Cliquer sur le bouton vert **"Code"** → copier l'URL HTTPS
- Ouvrir un terminal et exécuter :
```bash
git clone URL_COPIÉE
cd import-odoo-pharow
npm install
```
- Vérifier que `npm install` se termine sans erreur

---

## Étape 4 — Créer un compte Netlify

- Aller sur [https://netlify.com](https://netlify.com) → "Sign up"
- Choisir **"Sign up with GitHub"** (plus simple — connecte directement les deux comptes)
- Autoriser Netlify à accéder à GitHub

---

## Étape 5 — Déployer sur Netlify

- Dans Netlify, cliquer sur **"Add new project"** → **"Import an existing project"**
- Choisir **GitHub** → sélectionner le repo `import-odoo-pharow`
- Netlify détecte automatiquement Next.js — ne rien changer
- Cliquer **"Deploy"**
- Attendre 2-3 minutes → Netlify fournit une URL publique (ex: `mon-app.netlify.app`)
- Ouvrir l'URL → l'app doit s'afficher ✅

---

## Étape 6 — Variables d'environnement (optionnel)

Ces clés activent des étapes supplémentaires de recherche SIRET.
**L'app fonctionne parfaitement sans elles** — passe cette étape si tu veux démarrer simplement.

### OPENAI_API_KEY (recherche SIRET pour grands groupes)
- Créer un compte sur [https://platform.openai.com](https://platform.openai.com)
- Aller dans **API Keys** → **"Create new secret key"**
- Copier la clé (elle ne s'affiche qu'une seule fois)

### PAPPERS_API_KEY (recherche SIRET via Pappers)
- Créer un compte sur [https://www.pappers.fr](https://www.pappers.fr)
- Aller dans **Mon compte** → **API** → récupérer la clé

### Ajouter les clés dans Netlify
- Dans Netlify → **Site configuration** → **Environment variables**
- Ajouter chaque clé : nom exact (`OPENAI_API_KEY`, `PAPPERS_API_KEY`) + valeur
- Cliquer **"Save"** puis **redéployer** le site (Deploys → "Trigger deploy")

---

## Étape 7 — Vérification finale

Demande à la personne de :
1. Ouvrir son URL Netlify
2. Importer un fichier CSV Pharow de test
3. Vérifier que la conversion fonctionne et que le CSV téléchargé est correct

Si tout fonctionne → installation terminée ✅

---

## En cas de problème

- **`npm install` échoue** → vérifier que Node.js est bien installé (étape 1.1)
- **Netlify ne trouve pas le repo** → vérifier que le fork GitHub est bien créé (étape 3.1)
- **L'app s'affiche mais les SIRET ne se résolvent pas** → normal sans clés API, le fallback siège est utilisé
- **Autre erreur** → copier le message d'erreur exact et demander de l'aide

---

## Résumé des comptes à créer

| Service | Utilité | Coût |
|---|---|---|
| GitHub | Héberger le code | Gratuit |
| Netlify | Héberger l'app web | Gratuit |
| OpenAI | SIRET grands groupes (optionnel) | Payant à l'usage |
| Pappers | SIRET via Pappers (optionnel) | Payant |

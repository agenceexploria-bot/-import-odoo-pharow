# Guide d'installation — Acticonvert (Pharow → Odoo)

> **Instructions pour Claude Code**
> La personne qui te remet ce document part de zéro et n'est pas technique.
> Ton rôle est de l'accompagner étape par étape, d'expliquer le pourquoi de
> chaque action, de vérifier chaque étape avant de passer à la suivante, et
> de la rassurer à chaque étape réussie. Ne saute aucune étape.

---

## Ce que tu vas installer et pourquoi

**Acticonvert** est une application web qui transforme automatiquement des fichiers
CSV exportés depuis Pharow ou Kaspr en fichiers prêts à importer dans Odoo.

Pour que cette app soit accessible depuis n'importe quel navigateur (sans rien
installer sur son PC), elle doit être hébergée sur internet. On utilise **Netlify**
pour ça — c'est gratuit et automatique.

Le code source de l'app est stocké sur **GitHub** — c'est le "coffre-fort" du code.
Chaque fois qu'une modification est envoyée sur GitHub, Netlify met automatiquement
l'app à jour sur internet.

```
Son PC  →  GitHub (stocke le code)  →  Netlify (met en ligne)  →  URL publique
```

---

## Ce dont l'app a besoin pour fonctionner

**L'app utilise plusieurs services pour trouver les SIRET des entreprises :**

### 1. API gouvernementale — GRATUITE, aucun compte nécessaire
C'est le service principal. Il interroge la base officielle de l'État français
(`recherche-entreprises.api.gouv.fr`) et couvre environ 80 à 90% des cas.
Aucune clé, aucun abonnement — ça marche tout seul.

### 2. Pappers — GRATUIT (offre de base)
Pappers est un service qui donne accès aux données légales des entreprises françaises.
Il existe en secours quand l'API gouvernementale ne trouve pas l'établissement.
L'offre gratuite ("Offre 0 — 0€/mois") suffit pour un usage normal.
Une clé API est nécessaire mais le compte est gratuit.

### 3. OpenAI — PAYANT à l'usage (optionnel)
Utilisé uniquement pour les cas très difficiles : grands groupes éclatés en
plusieurs entités juridiques (ex: Airbus Helicopters vs Airbus Atlantic).
Sans cette clé, ces cas rares seront marqués "SIRET À CONFIRMER".
Coût réel : quelques centimes par fichier au maximum.

**L'app fonctionne très bien avec uniquement l'API gouvernementale gratuite.**
Pappers et OpenAI sont des améliorations optionnelles.

---

## Étape 1 — Installer les outils sur la machine

### Pourquoi ?
Pour récupérer le code source et l'envoyer sur GitHub, deux outils sont nécessaires
sur la machine : **Node.js** (qui fait tourner l'app en local) et **Git**
(qui gère l'envoi du code vers GitHub).

### 1.1 Installer Node.js
- Aller sur [https://nodejs.org](https://nodejs.org)
- Télécharger la version **LTS** (bouton vert à gauche — LTS = stable et recommandée)
- Lancer l'installateur et suivre les étapes (tout laisser par défaut)
- Une fois installé, ouvrir un terminal et vérifier :
```bash
node -v
npm -v
```
Les deux commandes doivent afficher un numéro de version (ex: `v20.11.0`).
Si c'est le cas → ✅ Node.js est installé.

### 1.2 Installer Git
- Aller sur [https://git-scm.com](https://git-scm.com) → télécharger et installer
- Tout laisser par défaut pendant l'installation
- Vérifier dans le terminal :
```bash
git -v
```
Doit afficher un numéro de version. Si c'est le cas → ✅ Git est installé.

---

## Étape 2 — Créer un compte GitHub

### Pourquoi ?
GitHub est l'endroit où le code source de l'app sera stocké. Netlify se connecte
à GitHub pour récupérer le code et mettre l'app en ligne automatiquement.
Sans compte GitHub, Netlify ne peut pas déployer l'app.

### Comment faire ?
- Aller sur [https://github.com](https://github.com) → cliquer **"Sign up"**
- Renseigner une adresse email, un mot de passe, un nom d'utilisateur
- Confirmer l'email reçu dans la boîte mail
- **Important** : noter quelque part l'email et le mot de passe utilisés

✅ Compte GitHub créé.

---

## Étape 3 — Récupérer le code source

### Pourquoi ?
Le code de l'app existe déjà sur GitHub. Il faut en faire une copie personnelle
(appelée "fork") pour pouvoir la connecter à son propre Netlify.

### 3.1 Forker le repo (créer sa propre copie)
- Aller sur : [https://github.com/agenceexploria-bot/-import-odoo-pharow](https://github.com/agenceexploria-bot/-import-odoo-pharow)
- Cliquer sur le bouton **"Fork"** en haut à droite
- Laisser toutes les options par défaut → cliquer **"Create fork"**

✅ Une copie personnelle du code est maintenant sur son compte GitHub.

### 3.2 Cloner le code sur sa machine

### Pourquoi ?
"Cloner" signifie télécharger le code depuis GitHub vers son ordinateur.
C'est nécessaire pour que Netlify puisse le lire et déployer l'app.

- Sur sa page GitHub, ouvrir le repo forké (`import-odoo-pharow`)
- Cliquer sur le bouton vert **"Code"** → onglet **"HTTPS"** → copier l'URL affichée
- Ouvrir un terminal et taper (en remplaçant l'URL par celle copiée) :
```bash
git clone URL_COPIÉE
cd import-odoo-pharow
npm install
```
- `npm install` télécharge les dépendances de l'app — attendre que ça se termine
- Si aucun message d'erreur rouge → ✅ le code est prêt sur la machine

---

## Étape 4 — Créer un compte Netlify

### Pourquoi ?
Netlify est le service qui va mettre l'app en ligne gratuitement et la rendre
accessible depuis n'importe quel navigateur via une URL publique.
Il se connecte directement à GitHub, donc chaque modification du code
est automatiquement déployée sans manipulation supplémentaire.

### Comment faire ?
- Aller sur [https://netlify.com](https://netlify.com) → cliquer **"Sign up"**
- Choisir **"Sign up with GitHub"** — c'est la méthode la plus simple car
  ça relie automatiquement les deux comptes
- Autoriser Netlify à accéder à GitHub quand c'est demandé

✅ Compte Netlify créé et connecté à GitHub.

---

## Étape 5 — Déployer l'app sur Netlify

### Pourquoi ?
C'est l'étape qui met l'app en ligne. Netlify va lire le code sur GitHub,
le compiler, et le rendre accessible via une URL publique.

### Comment faire ?
- Dans Netlify, cliquer **"Add new project"** → **"Import an existing project"**
- Choisir **"GitHub"** comme source
- Sélectionner le repo `import-odoo-pharow` dans la liste
- Netlify détecte automatiquement que c'est une app Next.js — **ne rien modifier**
- Cliquer **"Deploy"**
- Attendre 2 à 3 minutes

✅ Netlify affiche une URL publique (ex: `mon-app.netlify.app`).
Ouvrir cette URL dans un navigateur → l'app doit s'afficher.

---

## Étape 6 — Ajouter les clés API (optionnel)

### Pourquoi dans Netlify et pas dans le code ?
Les clés API sont des secrets — comme des mots de passe. Si on les mettait dans
le code sur GitHub, n'importe qui pourrait les voir et les utiliser à nos frais.
Netlify les stocke de façon chiffrée et privée, et les transmet à l'app au moment
du déploiement, sans jamais les exposer.

### 6.1 Clé Pappers (gratuite)
- Créer un compte sur [https://www.pappers.fr](https://www.pappers.fr)
- Choisir l'**Offre 0 — 0€/mois** (suffisant pour un usage normal)
- Aller dans **Mon compte → API** → copier la clé affichée

### 6.2 Clé OpenAI (payante, optionnel)
- Créer un compte sur [https://platform.openai.com](https://platform.openai.com)
- Aller dans **API Keys** → **"Create new secret key"**
- Copier la clé (elle ne s'affiche qu'une seule fois — la noter immédiatement)
- Ajouter un moyen de paiement dans les paramètres du compte

### 6.3 Ajouter les clés dans Netlify
- Dans Netlify → **Site configuration** → **Environment variables**
- Pour chaque clé : cliquer **"Add variable"**
  - Nom exact : `PAPPERS_API_KEY` ou `OPENAI_API_KEY`
  - Valeur : la clé copiée
- Cliquer **"Save"**
- Aller dans **Deploys** → **"Trigger deploy"** pour que les clés soient prises en compte

✅ Les clés sont actives au prochain déploiement.

---

## Étape 7 — Vérification finale

Demander à la personne de :
1. Ouvrir son URL Netlify dans un navigateur
2. Importer un fichier CSV Pharow de test
3. Lancer la conversion
4. Vérifier que le CSV téléchargé contient bien les SIRET avec leurs zéros initiaux
5. Vérifier que les colonnes correspondent aux champs Odoo attendus

✅ Si tout fonctionne → installation terminée.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| `node -v` ne répond pas | Node.js mal installé | Réinstaller depuis nodejs.org |
| `npm install` plante | Node.js trop vieux | Installer la version LTS |
| Netlify ne trouve pas le repo | Fork non créé | Refaire l'étape 3.1 |
| L'app s'affiche mais SIRET = 0 | Clés API absentes | Normal — l'API gov fonctionne seule |
| Beaucoup de "SIRET À CONFIRMER" | Cas difficiles sans OpenAI | Ajouter la clé OpenAI (étape 6.2) |
| Autre erreur | — | Copier le message exact et demander de l'aide |

---

## Résumé des comptes à créer

| Service | Utilité | Coût |
|---|---|---|
| GitHub | Stocker le code source | Gratuit |
| Netlify | Héberger l'app sur internet | Gratuit |
| Pappers | Recherche SIRET (secours) | Gratuit (Offre 0) |
| OpenAI | Recherche SIRET grands groupes | Payant à l'usage (optionnel) |

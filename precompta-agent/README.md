# Agent Pré-Comptable

Outil en ligne de commande qui analyse automatiquement les pièces jointes de vos emails Gmail (factures, reçus, notes de frais) via Claude (Anthropic) et crée des **brouillons** à destination de votre expert-comptable.

> **L'agent ne fait jamais d'envoi automatique.** Il crée uniquement des brouillons que vous validez et envoyez vous-même.

---

## Structure du projet

```
precompta-agent/
├── main.py              # Point d'entrée CLI
├── config.py            # Chargement de la configuration .env
├── gmail_client.py      # Connexion Gmail, recherche, téléchargement, brouillons
├── claude_client.py     # Analyse des pièces via API Claude
├── draft_builder.py     # Génération du corps HTML des brouillons
├── utils.py             # Logger, hash, formatage
├── requirements.txt
├── .env.example
├── .gitignore
└── pieces_temp/         # Créé automatiquement, supprimé après traitement
```

---

## Étape 1 — Créer le projet Google Cloud et activer l'API Gmail

### 1.1 Créer un projet

1. Allez sur [https://console.cloud.google.com](https://console.cloud.google.com)
2. Cliquez sur le sélecteur de projet (en haut à gauche) → **Nouveau projet**
3. Donnez-lui un nom (ex. `agent-precompta`) → **Créer**

### 1.2 Activer l'API Gmail

1. Dans le menu de gauche → **API et services** → **Bibliothèque**
2. Recherchez **Gmail API** → cliquez dessus → **Activer**

### 1.3 Configurer l'écran de consentement OAuth

1. **API et services** → **Écran de consentement OAuth**
2. Type d'utilisateur : **Externe** → **Créer**
3. Remplissez :
   - Nom de l'application : `Agent Pré-Comptable`
   - Email d'assistance : votre adresse Gmail
4. Cliquez **Enregistrer et continuer** jusqu'à la fin (les étapes "Champs d'application" et "Utilisateurs test" peuvent rester vides pour un usage personnel)
5. Revenez au tableau de bord → cliquez **Publier l'application** si demandé (pour usage personnel, "En test" suffit)

> Si l'application reste en mode "Test", ajoutez votre adresse Gmail dans **Utilisateurs test**.

### 1.4 Créer les identifiants OAuth

1. **API et services** → **Identifiants** → **+ Créer des identifiants** → **ID client OAuth**
2. Type d'application : **Application de bureau**
3. Nom : `agent-precompta-desktop`
4. Cliquez **Créer**
5. Téléchargez le fichier JSON → **renommez-le `credentials.json`**
6. Placez `credentials.json` dans le dossier `precompta-agent/`

---

## Étape 2 — Installation

### 2.1 Prérequis

- Python 3.11 ou supérieur
- pip

### 2.2 Créer l'environnement virtuel

```bash
# Dans le dossier precompta-agent/
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 2.3 Installer les dépendances

```bash
pip install -r requirements.txt
```

---

## Étape 3 — Configuration

```bash
# Copiez le fichier exemple
cp .env.example .env
```

Ouvrez `.env` et remplissez :

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API Claude ([console.anthropic.com](https://console.anthropic.com/settings/keys)) |
| `CLAUDE_MODEL` | Modèle Claude (défaut : `claude-sonnet-4-6`) |
| `GMAIL_CREDENTIALS_PATH` | Chemin vers `credentials.json` (défaut : `credentials.json`) |
| `EXPERT_COMPTABLE_EMAIL` | Email de votre expert-comptable |
| `GMAIL_SEARCH_QUERY` | Filtre Gmail (défaut : mails non lus avec PJ, 7 derniers jours) |
| `GMAIL_MAX_ATTACHMENT_MB` | Taille max des PJ en Mo (défaut : `10`) |
| `GMAIL_LABEL_TRAITE` | Nom du label Gmail (défaut : `precompta-traite`) |

---

## Étape 4 — Première connexion OAuth

Au premier lancement, l'agent ouvre votre navigateur pour l'autorisation OAuth :

```bash
python main.py --dry-run --limit 1
```

1. Le navigateur s'ouvre → connectez-vous avec votre compte Gmail
2. Accordez les permissions demandées (lecture + labels + brouillons)
3. Le fichier `token.json` est créé automatiquement (gardez-le secret)

> Les prochains lancements n'ouvriront plus le navigateur (le token est réutilisé).

---

## Étape 5 — Tester sur un seul mail

### Option A — Tester avec un ID Gmail spécifique

1. Ouvrez Gmail dans le navigateur
2. Ouvrez le mail souhaité → l'URL contient l'ID : `.../#inbox/`**`18f2a3b4c5d6e7f8`**
3. Lancez :

```bash
python main.py --single-id 18f2a3b4c5d6e7f8 --dry-run
```

Le `--dry-run` simule tout sans créer de brouillon ni appliquer de label.

### Option B — Tester sans dry-run (crée un vrai brouillon)

```bash
python main.py --single-id 18f2a3b4c5d6e7f8
```

Vérifiez dans Gmail → **Brouillons** que le mail est bien là, avec la pièce jointe.

---

## Étape 6 — Lancement normal

```bash
# Traite tous les mails correspondant au filtre par défaut
python main.py

# Limite à 10 mails
python main.py --limit 10

# Requête personnalisée
python main.py --query "from:amazon.fr has:attachment"

# Conserve les fichiers temporaires pour inspection
python main.py --keep-temp
```

---

## Options CLI complètes

| Option | Description |
|---|---|
| `--dry-run` | Simule sans créer de brouillon ni appliquer de label |
| `--single-id ID` | Traite uniquement ce message Gmail |
| `--limit N` | Limite à N messages (défaut : 50) |
| `--query "..."` | Remplace la requête Gmail du `.env` |
| `--keep-temp` | Conserve les fichiers dans `pieces_temp/` |

---

## Sécurité

- `credentials.json` et `token.json` sont dans `.gitignore` — ne les commitez jamais
- L'agent utilise uniquement le scope `gmail.modify` (pas `gmail.send`)
- Aucun email n'est envoyé automatiquement — uniquement des brouillons
- Les pièces jointes temporaires sont supprimées après chaque exécution

---

## Logs

Chaque exécution écrit dans `precompta.log` (en plus de la console).

---

## Dépannage

| Problème | Solution |
|---|---|
| `Configuration incomplète` | Vérifiez votre fichier `.env` |
| `credentials.json introuvable` | Placez le fichier dans le bon dossier |
| `access_denied` lors de l'OAuth | Ajoutez votre email dans "Utilisateurs test" sur Google Cloud Console |
| `Token invalide` | Supprimez `token.json` et relancez |
| `Réponse Claude non parsable` | Vérifiez votre `ANTHROPIC_API_KEY` et consultez `precompta.log` |

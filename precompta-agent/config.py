"""
config.py — Chargement et validation de la configuration depuis .env
Toutes les valeurs sensibles passent par les variables d'environnement.
"""

import os
from dotenv import load_dotenv

# Charge le fichier .env situé dans le même répertoire que ce script
load_dotenv()


# ── API Anthropic (Claude) ────────────────────────────────────────────────────
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

# ── Gmail ─────────────────────────────────────────────────────────────────────
GMAIL_CREDENTIALS_PATH: str = os.getenv("GMAIL_CREDENTIALS_PATH", "credentials.json")
GMAIL_TOKEN_PATH: str = os.getenv("GMAIL_TOKEN_PATH", "token.json")

# Requête Gmail par défaut : non lus, 7 derniers jours, avec pièce jointe
GMAIL_SEARCH_QUERY: str = os.getenv(
    "GMAIL_SEARCH_QUERY",
    "has:attachment is:unread newer_than:7d"
)

# Nom du label appliqué aux mails traités (sans accent pour la robustesse)
GMAIL_LABEL_TRAITE: str = os.getenv("GMAIL_LABEL_TRAITE", "precompta-traite")

# Taille max d'une pièce jointe à traiter (en mégaoctets)
GMAIL_MAX_ATTACHMENT_MB: float = float(os.getenv("GMAIL_MAX_ATTACHMENT_MB", "10"))

# ── Expert-comptable ──────────────────────────────────────────────────────────
EXPERT_COMPTABLE_EMAIL: str = os.getenv("EXPERT_COMPTABLE_EMAIL", "")

# ── Stockage local ────────────────────────────────────────────────────────────
# Dossier temporaire pour les pièces jointes téléchargées
PIECES_TEMP_DIR: str = os.getenv("PIECES_TEMP_DIR", "pieces_temp")

# Types MIME acceptés comme pièces comptables
TYPES_MIME_ACCEPTES: tuple = (
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
)


def valider_config() -> None:
    """
    Vérifie que les variables obligatoires sont présentes.
    Lève ValueError avec la liste des champs manquants.
    """
    erreurs = []

    if not ANTHROPIC_API_KEY:
        erreurs.append("ANTHROPIC_API_KEY")
    if not EXPERT_COMPTABLE_EMAIL:
        erreurs.append("EXPERT_COMPTABLE_EMAIL")
    if not os.path.exists(GMAIL_CREDENTIALS_PATH):
        erreurs.append(
            f"GMAIL_CREDENTIALS_PATH → fichier introuvable : {GMAIL_CREDENTIALS_PATH}"
        )

    if erreurs:
        raise ValueError(
            "Configuration incomplète. Variables/fichiers manquants :\n  - "
            + "\n  - ".join(erreurs)
        )

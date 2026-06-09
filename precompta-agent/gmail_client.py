"""
gmail_client.py — Toutes les interactions avec l'API Gmail.

Opérations couvertes :
  - Authentification OAuth 2.0 (flux desktop, token mis en cache)
  - Recherche de messages selon une requête configurable
  - Téléchargement des pièces jointes
  - Création de labels
  - Application d'un label à un message
  - Création de brouillons avec pièce jointe
"""

import base64
import email
import os
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Generator

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import config
from utils import (
    chemin_piece_temp,
    hash_contenu,
    logger,
)

# Scopes OAuth demandés :
#   gmail.modify = lecture + étiquetage + création de brouillons (SANS envoi)
SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]


# ── Authentification ──────────────────────────────────────────────────────────

def obtenir_service_gmail():
    """
    Authentifie l'utilisateur via OAuth 2.0 et retourne le service Gmail.
    - Charge le token mis en cache (token.json) s'il existe et est valide.
    - Lance le flux OAuth dans le navigateur si nécessaire.
    - Sauvegarde le token pour les prochaines exécutions.
    """
    creds = None

    # Réutilise le token existant si possible
    if os.path.exists(config.GMAIL_TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(config.GMAIL_TOKEN_PATH, SCOPES)

    # Rafraîchit ou renouvelle le token si expiré/absent
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Token Gmail expiré — rafraîchissement en cours…")
            creds.refresh(Request())
        else:
            logger.info("Première connexion — ouverture du navigateur pour OAuth…")
            flow = InstalledAppFlow.from_client_secrets_file(
                config.GMAIL_CREDENTIALS_PATH, SCOPES
            )
            creds = flow.run_local_server(port=0)

        # Sauvegarde le token pour la prochaine fois
        with open(config.GMAIL_TOKEN_PATH, "w") as token_file:
            token_file.write(creds.to_json())
        logger.info(f"Token sauvegardé dans {config.GMAIL_TOKEN_PATH}")

    return build("gmail", "v1", credentials=creds)


# ── Recherche de messages ──────────────────────────────────────────────────────

def chercher_messages(service, requete: str, limite: int = 100) -> list[dict]:
    """
    Retourne la liste des messages correspondant à la requête Gmail.
    Chaque élément contient au minimum {'id': ..., 'threadId': ...}.
    """
    logger.info(f"Recherche Gmail → requête : «{requete}»")
    resultats = []
    page_token = None

    while True:
        reponse = (
            service.users()
            .messages()
            .list(
                userId="me",
                q=requete,
                maxResults=min(limite - len(resultats), 500),
                pageToken=page_token,
            )
            .execute()
        )

        messages = reponse.get("messages", [])
        resultats.extend(messages)

        page_token = reponse.get("nextPageToken")
        if not page_token or len(resultats) >= limite:
            break

    logger.info(f"{len(resultats)} message(s) trouvé(s)")
    return resultats[:limite]


def obtenir_message_complet(service, message_id: str) -> dict:
    """Récupère les métadonnées et le payload complet d'un message."""
    return (
        service.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )


# ── Extraction des pièces jointes ─────────────────────────────────────────────

def _parcourir_parties(parties: list) -> Generator[dict, None, None]:
    """Générateur récursif qui parcourt les parties MIME d'un message."""
    for partie in parties:
        if partie.get("parts"):
            yield from _parcourir_parties(partie["parts"])
        else:
            yield partie


def telecharger_pieces_jointes(
    service,
    message: dict,
    dossier_dest: str,
    hashes_deja_traites: set[str],
) -> list[dict]:
    """
    Télécharge les pièces jointes PDF/images d'un message.
    Ignore les fichiers trop lourds ou déjà traités (dédupliqués par hash SHA-256).

    Retourne une liste de dicts :
      {
        "chemin": Path,
        "nom_original": str,
        "mime_type": str,
        "taille_octets": int,
        "hash": str,
      }
    """
    pieces = []
    taille_max_octets = config.GMAIL_MAX_ATTACHMENT_MB * 1024 * 1024
    payload = message.get("payload", {})
    parties = payload.get("parts", [payload])

    for partie in _parcourir_parties(parties):
        mime_type = partie.get("mimeType", "")
        if mime_type not in config.TYPES_MIME_ACCEPTES:
            continue

        body = partie.get("body", {})
        attachment_id = body.get("attachmentId")
        taille = body.get("size", 0)
        nom_original = partie.get("filename", "sans_nom")

        # Vérifie la taille avant téléchargement
        if taille > taille_max_octets:
            logger.warning(
                f"Pièce ignorée (trop lourde : {taille / 1024 / 1024:.1f} Mo) : {nom_original}"
            )
            continue

        if not attachment_id:
            logger.warning(f"Pièce sans attachmentId ignorée : {nom_original}")
            continue

        # Télécharge le contenu
        try:
            attachment = (
                service.users()
                .messages()
                .attachments()
                .get(userId="me", messageId=message["id"], id=attachment_id)
                .execute()
            )
        except HttpError as e:
            logger.error(f"Erreur téléchargement pièce {nom_original} : {e}")
            continue

        data_b64 = attachment.get("data", "")
        # L'API Gmail utilise du base64 URL-safe
        contenu = base64.urlsafe_b64decode(data_b64 + "==")

        # Déduplique sur le contenu (pas le nom de fichier)
        h = hash_contenu(contenu)
        if h in hashes_deja_traites:
            logger.info(f"Doublon détecté, ignoré : {nom_original} (hash {h[:8]}…)")
            continue
        hashes_deja_traites.add(h)

        # Sauvegarde en local
        chemin = chemin_piece_temp(dossier_dest, nom_original, h)
        chemin.write_bytes(contenu)
        logger.info(f"Pièce téléchargée : {chemin.name} ({taille / 1024:.1f} Ko)")

        pieces.append(
            {
                "chemin": chemin,
                "nom_original": nom_original,
                "mime_type": mime_type,
                "taille_octets": len(contenu),
                "hash": h,
            }
        )

    return pieces


# ── Gestion des labels ────────────────────────────────────────────────────────

def obtenir_ou_creer_label(service, nom_label: str) -> str:
    """
    Retourne l'ID du label Gmail portant ce nom.
    Le crée s'il n'existe pas encore.
    """
    # Liste tous les labels existants
    reponse = service.users().labels().list(userId="me").execute()
    for label in reponse.get("labels", []):
        if label["name"] == nom_label:
            return label["id"]

    # Crée le label s'il est absent
    logger.info(f"Création du label Gmail : «{nom_label}»")
    nouveau = (
        service.users()
        .labels()
        .create(
            userId="me",
            body={
                "name": nom_label,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show",
            },
        )
        .execute()
    )
    return nouveau["id"]


def appliquer_label(service, message_id: str, label_id: str) -> None:
    """Applique un label à un message. Opération non destructive et réversible."""
    service.users().messages().modify(
        userId="me",
        id=message_id,
        body={"addLabelIds": [label_id]},
    ).execute()
    logger.info(f"Label appliqué au message {message_id}")


def a_deja_label(message: dict, label_id: str) -> bool:
    """Vérifie si un message possède déjà le label (évite le double traitement)."""
    return label_id in message.get("labelIds", [])


# ── Création de brouillons ────────────────────────────────────────────────────

def creer_brouillon(
    service,
    destinataire: str,
    objet: str,
    corps_html: str,
    piece_jointe_chemin: Path,
    piece_jointe_mime: str,
) -> dict:
    """
    Crée un brouillon Gmail avec une pièce jointe.
    NE JAMAIS appeler send() sur ce brouillon depuis le code — c'est intentionnel.

    Retourne le brouillon créé (dict avec 'id' et 'message').
    """
    message = MIMEMultipart("mixed")
    message["To"] = destinataire
    message["Subject"] = objet

    # Corps du mail en HTML
    corps_part = MIMEText(corps_html, "html", "utf-8")
    message.attach(corps_part)

    # Pièce jointe
    with open(piece_jointe_chemin, "rb") as f:
        contenu_pj = f.read()

    pj = MIMEApplication(contenu_pj, _subtype=piece_jointe_mime.split("/")[-1])
    pj.add_header(
        "Content-Disposition",
        "attachment",
        filename=piece_jointe_chemin.name,
    )
    message.attach(pj)

    # Encodage base64 URL-safe requis par l'API Gmail
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

    brouillon = (
        service.users()
        .drafts()
        .create(userId="me", body={"message": {"raw": raw}})
        .execute()
    )
    logger.info(f"Brouillon créé (id={brouillon['id']}) → {destinataire}")
    return brouillon

"""
claude_client.py — Analyse des pièces comptables via l'API Claude (Anthropic).

Envoie chaque document (PDF ou image) à Claude avec un prompt demandant
une extraction JSON stricte des informations comptables.
"""

import base64
import json
import re
from pathlib import Path

import anthropic

import config
from utils import logger

# Prompt système : instruit Claude à ne retourner que du JSON pur
PROMPT_SYSTEME = """Tu es un assistant spécialisé en comptabilité française.
Tu analyses des documents (factures, reçus, notes de frais) et tu extrais les informations comptables.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ni après.
Pas de markdown, pas de backticks, pas d'explication. Uniquement le JSON brut."""

# Prompt utilisateur : définit le schéma JSON attendu
PROMPT_ANALYSE = """Analyse ce document et retourne UNIQUEMENT ce JSON (sans rien d'autre) :

{
  "est_piece_comptable": true,
  "type": "facture | note_de_frais | reçu | autre",
  "fournisseur": "Nom exact du fournisseur ou émetteur",
  "date": "AAAA-MM-JJ",
  "numero_facture": "Numéro de facture ou référence, ou null si absent",
  "montant_ht": 0.00,
  "tva": 0.00,
  "montant_ttc": 0.00,
  "devise": "EUR",
  "anomalies": ["liste des points à vérifier, vide si aucun"]
}

Règles strictes :
- Si le document n'est pas une pièce comptable, mets "est_piece_comptable": false et des valeurs nulles/vides.
- Les montants sont des nombres décimaux (point comme séparateur), jamais des chaînes.
- La date doit être au format AAAA-MM-JJ. Si tu ne peux pas la lire clairement, mets null.
- Dans "anomalies", signale : montants illisibles, date absente, TVA incohérente, document tronqué, etc.
- La devise doit être le code ISO 4217 (EUR, USD, GBP…).
"""


def _lire_fichier_en_base64(chemin: Path) -> str:
    """Lit un fichier binaire et retourne son contenu encodé en base64."""
    return base64.standard_b64encode(chemin.read_bytes()).decode("utf-8")


def _construire_bloc_contenu(chemin: Path, mime_type: str) -> list[dict]:
    """
    Construit la liste de blocs 'content' pour l'API Claude selon le type MIME.
    - PDF → bloc 'document'
    - Image → bloc 'image'
    Les deux formats sont supportés nativement par Claude.
    """
    data_b64 = _lire_fichier_en_base64(chemin)

    if mime_type == "application/pdf":
        bloc_document = {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": data_b64,
            },
        }
    elif mime_type in ("image/jpeg", "image/jpg", "image/png"):
        # Normalise image/jpg → image/jpeg (requis par l'API)
        media_type_normalise = "image/jpeg" if mime_type == "image/jpg" else mime_type
        bloc_document = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type_normalise,
                "data": data_b64,
            },
        }
    else:
        raise ValueError(f"Type MIME non supporté : {mime_type}")

    return [
        bloc_document,
        {"type": "text", "text": PROMPT_ANALYSE},
    ]


def _extraire_json_depuis_texte(texte: str) -> dict:
    """
    Parse de façon défensive la réponse de Claude.
    - Cas normal : Claude retourne du JSON pur.
    - Cas dégradé : Claude encapsule dans des backticks ou ajoute du texte.
    Lève json.JSONDecodeError si aucun JSON valide n'est trouvé.
    """
    texte = texte.strip()

    # Tentative directe (cas nominal)
    try:
        return json.loads(texte)
    except json.JSONDecodeError:
        pass

    # Cherche un bloc JSON entre accolades (cas dégradé)
    correspondance = re.search(r"\{.*\}", texte, re.DOTALL)
    if correspondance:
        try:
            return json.loads(correspondance.group())
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError(
        "Aucun JSON valide trouvé dans la réponse Claude", texte, 0
    )


def _valider_champs_json(donnees: dict) -> dict:
    """
    Normalise et sécurise les champs extraits par Claude.
    Remplace les valeurs manquantes ou invalides par des valeurs neutres.
    """
    champs_float = ["montant_ht", "tva", "montant_ttc"]
    for champ in champs_float:
        valeur = donnees.get(champ)
        try:
            donnees[champ] = float(valeur) if valeur is not None else 0.0
        except (TypeError, ValueError):
            donnees[champ] = 0.0
            donnees.setdefault("anomalies", []).append(
                f"Montant '{champ}' illisible ou invalide"
            )

    # S'assure que les champs texte sont des chaînes
    for champ in ["type", "fournisseur", "numero_facture", "devise", "date"]:
        valeur = donnees.get(champ)
        donnees[champ] = str(valeur).strip() if valeur is not None else None

    # S'assure que anomalies est une liste
    if not isinstance(donnees.get("anomalies"), list):
        donnees["anomalies"] = []

    # Valeur par défaut pour devise
    if not donnees.get("devise"):
        donnees["devise"] = "EUR"

    return donnees


def analyser_piece(chemin: Path, mime_type: str) -> dict | None:
    """
    Envoie une pièce jointe à Claude et retourne le JSON d'analyse.

    Retourne :
      - dict avec les champs comptables si l'analyse réussit
      - None si une erreur non récupérable survient (loguée)

    NE LÈVE PAS d'exception vers l'appelant — les erreurs sont absorbées
    pour que le traitement continue sur les pièces suivantes.
    """
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

    logger.info(f"Analyse Claude de : {chemin.name} (modèle={config.CLAUDE_MODEL})")

    try:
        blocs_contenu = _construire_bloc_contenu(chemin, mime_type)
    except ValueError as e:
        logger.error(f"Impossible de préparer la pièce pour Claude : {e}")
        return None

    try:
        reponse = client.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=1024,
            system=PROMPT_SYSTEME,
            messages=[{"role": "user", "content": blocs_contenu}],
        )
    except anthropic.APIError as e:
        logger.error(f"Erreur API Claude pour {chemin.name} : {e}")
        return None

    texte_reponse = reponse.content[0].text if reponse.content else ""

    try:
        donnees = _extraire_json_depuis_texte(texte_reponse)
    except json.JSONDecodeError:
        logger.error(
            f"Réponse Claude non parsable pour {chemin.name}. "
            f"Réponse brute (200 premiers chars) : {texte_reponse[:200]}"
        )
        return None

    donnees = _valider_champs_json(donnees)
    logger.info(
        f"Analyse réussie : {donnees.get('type')} — {donnees.get('fournisseur')} "
        f"— {donnees.get('montant_ttc')} {donnees.get('devise')}"
    )
    return donnees

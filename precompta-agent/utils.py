"""
utils.py — Fonctions utilitaires partagées : logging, hash, nettoyage fichiers.
"""

import hashlib
import logging
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path


# ── Configuration du logger ───────────────────────────────────────────────────
def configurer_logger(niveau: int = logging.INFO) -> logging.Logger:
    """
    Crée et configure le logger principal de l'application.
    Écrit à la fois dans la console et dans un fichier precompta.log.
    """
    logger = logging.getLogger("precompta")
    logger.setLevel(niveau)

    if logger.handlers:
        return logger  # Évite les doublons si appelé plusieurs fois

    formateur = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Handler console
    handler_console = logging.StreamHandler()
    handler_console.setFormatter(formateur)
    logger.addHandler(handler_console)

    # Handler fichier
    handler_fichier = logging.FileHandler("precompta.log", encoding="utf-8")
    handler_fichier.setFormatter(formateur)
    logger.addHandler(handler_fichier)

    return logger


logger = configurer_logger()


# ── Utilitaires fichiers ──────────────────────────────────────────────────────
def assurer_dossier(chemin: str) -> Path:
    """Crée le dossier s'il n'existe pas et retourne son Path."""
    p = Path(chemin)
    p.mkdir(parents=True, exist_ok=True)
    return p


def hash_contenu(data: bytes) -> str:
    """Retourne le SHA-256 (hex) d'un contenu binaire — sert à dédupliquer."""
    return hashlib.sha256(data).hexdigest()


def nettoyer_nom_fichier(nom: str) -> str:
    """
    Supprime les caractères interdits dans un nom de fichier Windows/Linux.
    Remplace les espaces par des underscores.
    """
    # Normalise les accents (é → e)
    nom = unicodedata.normalize("NFKD", nom)
    nom = nom.encode("ascii", "ignore").decode("ascii")
    # Supprime les caractères non alphanumériques sauf . _ -
    nom = re.sub(r"[^\w.\-]", "_", nom)
    return nom[:200]  # Limite la longueur


def chemin_piece_temp(dossier: str, nom_original: str, hash_sha256: str) -> Path:
    """
    Construit un chemin unique pour une pièce jointe temporaire.
    Format : {dossier}/{YYYYMMDD_HHMMSS}_{8premiers_chars_hash}_{nom_propre}
    """
    horodatage = datetime.now().strftime("%Y%m%d_%H%M%S")
    nom_propre = nettoyer_nom_fichier(nom_original)
    nom_unique = f"{horodatage}_{hash_sha256[:8]}_{nom_propre}"
    return Path(dossier) / nom_unique


# ── Formatage pour les brouillons ─────────────────────────────────────────────
def formater_montant(valeur: float | None, devise: str = "EUR") -> str:
    """Formate un montant en style français : 1 234,56 €"""
    if valeur is None or valeur == 0:
        return "—"
    symboles = {"EUR": "€", "USD": "$", "GBP": "£"}
    symbole = symboles.get(devise, devise)
    # Format français : séparateur de milliers = espace, décimal = virgule
    return f"{valeur:,.2f}".replace(",", " ").replace(".", ",") + f" {symbole}"


def formater_date_fr(date_iso: str | None) -> str:
    """Convertit 'AAAA-MM-JJ' en 'JJ/MM/AAAA'. Retourne '—' si invalide."""
    if not date_iso:
        return "—"
    try:
        d = datetime.strptime(date_iso.strip(), "%Y-%m-%d")
        return d.strftime("%d/%m/%Y")
    except ValueError:
        return date_iso  # Retourne tel quel si le format est inattendu

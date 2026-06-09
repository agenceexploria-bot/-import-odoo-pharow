"""
main.py — Point d'entrée de l'agent pré-comptable.

Usage :
  python main.py                          # Mode normal (7 derniers jours, non lus)
  python main.py --dry-run                # Simule sans créer de brouillon
  python main.py --single-id <ID_GMAIL>  # Teste sur un seul mail
  python main.py --limit 5               # Limite à 5 mails
  python main.py --query "from:amazon"   # Requête Gmail personnalisée
"""

import argparse
import shutil
import sys
from pathlib import Path

import config
import draft_builder
import gmail_client
from claude_client import analyser_piece
from utils import assurer_dossier, logger


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Agent pré-comptable : analyse les pièces jointes Gmail via Claude."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simule le traitement sans créer de brouillon ni appliquer de label.",
    )
    parser.add_argument(
        "--single-id",
        metavar="MESSAGE_ID",
        help="Traite uniquement le mail Gmail portant cet ID (utile pour les tests).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        metavar="N",
        help="Nombre maximum de mails à traiter (défaut : 50).",
    )
    parser.add_argument(
        "--query",
        type=str,
        default=None,
        help=(
            "Requête Gmail personnalisée. "
            f"Défaut : «{config.GMAIL_SEARCH_QUERY}»"
        ),
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Conserve les fichiers temporaires dans pieces_temp/ après traitement.",
    )
    return parser.parse_args()


def traiter_message(
    service,
    message_id: str,
    label_id: str,
    hashes_traites: set,
    dry_run: bool,
) -> dict:
    """
    Traite un message Gmail :
      1. Récupère le message complet.
      2. Vérifie qu'il n'a pas déjà été traité.
      3. Télécharge les pièces jointes.
      4. Pour chaque pièce, demande l'analyse à Claude.
      5. Crée un brouillon si la pièce est comptable.
      6. Applique le label "traité" sur le mail source.

    Retourne un dict de statistiques pour ce message.
    """
    stats = {
        "id": message_id,
        "pieces_trouvees": 0,
        "pieces_analysees": 0,
        "brouillons_crees": 0,
        "erreurs": 0,
    }

    # Récupère le message complet
    try:
        message = gmail_client.obtenir_message_complet(service, message_id)
    except Exception as e:
        logger.error(f"Impossible de récupérer le message {message_id} : {e}")
        stats["erreurs"] += 1
        return stats

    # Vérifie si déjà traité (label présent)
    if gmail_client.a_deja_label(message, label_id):
        logger.info(f"Message {message_id} déjà traité — ignoré.")
        return stats

    # Télécharge les pièces jointes
    dossier_temp = assurer_dossier(config.PIECES_TEMP_DIR)
    pieces = gmail_client.telecharger_pieces_jointes(
        service, message, str(dossier_temp), hashes_traites
    )
    stats["pieces_trouvees"] = len(pieces)

    if not pieces:
        logger.info(f"Message {message_id} : aucune pièce jointe exploitable.")
        return stats

    piece_traitee = False

    for piece in pieces:
        chemin: Path = piece["chemin"]
        mime_type: str = piece["mime_type"]

        # ── Analyse Claude ────────────────────────────────────────────────────
        donnees = analyser_piece(chemin, mime_type)

        if donnees is None:
            logger.warning(
                f"Analyse impossible pour {chemin.name} — aucun brouillon créé."
            )
            stats["erreurs"] += 1
            continue

        stats["pieces_analysees"] += 1

        # Si Claude indique que ce n'est pas une pièce comptable, on passe
        if not donnees.get("est_piece_comptable"):
            logger.info(
                f"{chemin.name} → non comptable (type={donnees.get('type')}) — ignoré."
            )
            continue

        # ── Construction et création du brouillon ─────────────────────────────
        objet = draft_builder.construire_objet(donnees)
        corps_html = draft_builder.construire_corps_html(donnees, piece["nom_original"])

        if dry_run:
            logger.info(f"[DRY-RUN] Brouillon simulé : «{objet}» → {config.EXPERT_COMPTABLE_EMAIL}")
        else:
            try:
                gmail_client.creer_brouillon(
                    service=service,
                    destinataire=config.EXPERT_COMPTABLE_EMAIL,
                    objet=objet,
                    corps_html=corps_html,
                    piece_jointe_chemin=chemin,
                    piece_jointe_mime=mime_type,
                )
                stats["brouillons_crees"] += 1
                piece_traitee = True
            except Exception as e:
                logger.error(f"Erreur création brouillon pour {chemin.name} : {e}")
                stats["erreurs"] += 1

    # ── Label sur le mail source ───────────────────────────────────────────────
    # Appliqué même si certaines pièces ont échoué, dès qu'une pièce a été traitée.
    # En dry-run, on simule sans modifier le mail.
    if piece_traitee and not dry_run:
        try:
            gmail_client.appliquer_label(service, message_id, label_id)
        except Exception as e:
            logger.error(f"Impossible d'appliquer le label au message {message_id} : {e}")
    elif dry_run and stats["pieces_analysees"] > 0:
        logger.info(f"[DRY-RUN] Label «{config.GMAIL_LABEL_TRAITE}» simulé sur {message_id}")

    return stats


def main() -> None:
    args = parse_arguments()

    # ── Validation de la configuration ────────────────────────────────────────
    try:
        config.valider_config()
    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Agent pré-comptable démarré")
    if args.dry_run:
        logger.info("⚠ MODE DRY-RUN : aucun brouillon ne sera créé, aucun label appliqué.")
    logger.info("=" * 60)

    # ── Connexion Gmail ───────────────────────────────────────────────────────
    try:
        service = gmail_client.obtenir_service_gmail()
    except Exception as e:
        logger.error(f"Échec de la connexion Gmail : {e}")
        sys.exit(1)

    # ── Préparation du label ──────────────────────────────────────────────────
    try:
        label_id = gmail_client.obtenir_ou_creer_label(service, config.GMAIL_LABEL_TRAITE)
    except Exception as e:
        logger.error(f"Impossible de créer/trouver le label Gmail : {e}")
        sys.exit(1)

    # ── Récupération des messages ─────────────────────────────────────────────
    if args.single_id:
        # Mode test : un seul mail
        messages = [{"id": args.single_id}]
        logger.info(f"Mode --single-id : traitement du message {args.single_id} uniquement.")
    else:
        requete = args.query or config.GMAIL_SEARCH_QUERY
        try:
            messages = gmail_client.chercher_messages(service, requete, limite=args.limit)
        except Exception as e:
            logger.error(f"Échec de la recherche Gmail : {e}")
            sys.exit(1)

    if not messages:
        logger.info("Aucun message à traiter. Fin de l'agent.")
        return

    # ── Traitement de chaque message ──────────────────────────────────────────
    hashes_traites: set = set()  # Déduplique les pièces jointes identiques
    totaux = {
        "messages": len(messages),
        "pieces_trouvees": 0,
        "pieces_analysees": 0,
        "brouillons_crees": 0,
        "erreurs": 0,
    }

    for i, msg in enumerate(messages, 1):
        logger.info(f"── Message {i}/{len(messages)} (id={msg['id']}) ──")
        stats = traiter_message(
            service=service,
            message_id=msg["id"],
            label_id=label_id,
            hashes_traites=hashes_traites,
            dry_run=args.dry_run,
        )
        for cle in ["pieces_trouvees", "pieces_analysees", "brouillons_crees", "erreurs"]:
            totaux[cle] += stats[cle]

    # ── Nettoyage des fichiers temporaires ────────────────────────────────────
    if not args.keep_temp:
        dossier_temp = Path(config.PIECES_TEMP_DIR)
        if dossier_temp.exists():
            shutil.rmtree(dossier_temp)
            logger.info(f"Dossier temporaire supprimé : {dossier_temp}")
    else:
        logger.info(f"Fichiers temporaires conservés dans : {config.PIECES_TEMP_DIR}/")

    # ── Résumé final ──────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("RÉSUMÉ")
    logger.info(f"  Messages traités    : {totaux['messages']}")
    logger.info(f"  Pièces trouvées     : {totaux['pieces_trouvees']}")
    logger.info(f"  Pièces analysées    : {totaux['pieces_analysees']}")
    logger.info(f"  Brouillons créés    : {totaux['brouillons_crees']}")
    logger.info(f"  Erreurs             : {totaux['erreurs']}")
    if args.dry_run:
        logger.info("  (Dry-run : aucune modification réelle effectuée)")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

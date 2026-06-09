"""
draft_builder.py — Génère le corps HTML du brouillon pour l'expert-comptable
et construit l'objet (subject) du mail à partir des données extraites par Claude.
"""

from utils import formater_date_fr, formater_montant


def construire_objet(donnees: dict) -> str:
    """
    Construit l'objet du mail selon le format convenu :
    [Pré-compta] {type} {fournisseur} — {montant_ttc} {devise}
    """
    type_piece = (donnees.get("type") or "document").capitalize()
    fournisseur = donnees.get("fournisseur") or "Fournisseur inconnu"
    montant = formater_montant(donnees.get("montant_ttc"), donnees.get("devise", "EUR"))

    return f"[Pré-compta] {type_piece} {fournisseur} — {montant}"


def construire_corps_html(donnees: dict, nom_fichier_original: str) -> str:
    """
    Génère le corps HTML du brouillon à destination de l'expert-comptable.
    Ton sobre et professionnel. Met en évidence les anomalies s'il y en a.
    """
    type_piece = (donnees.get("type") or "—").capitalize()
    fournisseur = donnees.get("fournisseur") or "—"
    date_fr = formater_date_fr(donnees.get("date"))
    numero = donnees.get("numero_facture") or "—"
    devise = donnees.get("devise", "EUR")
    ht = formater_montant(donnees.get("montant_ht"), devise)
    tva = formater_montant(donnees.get("tva"), devise)
    ttc = formater_montant(donnees.get("montant_ttc"), devise)
    anomalies: list = donnees.get("anomalies") or []

    # Bloc anomalies (affiché uniquement s'il y en a)
    if anomalies:
        items_anomalies = "".join(f"<li>{a}</li>" for a in anomalies)
        bloc_anomalies = f"""
        <tr>
          <td colspan="2" style="padding: 12px 0 4px 0;">
            <p style="margin:0; color:#b45309; font-weight:600;">
              ⚠ Points à vérifier
            </p>
            <ul style="margin:4px 0 0 16px; color:#92400e;">
              {items_anomalies}
            </ul>
          </td>
        </tr>"""
    else:
        bloc_anomalies = ""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; max-width: 600px;">

  <p>Bonjour,</p>

  <p>
    Veuillez trouver ci-joint une pièce comptable détectée et analysée automatiquement.
    Merci de vérifier les informations ci-dessous avant intégration.
  </p>

  <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="text-align:left; padding:8px 12px; border:1px solid #e5e7eb; width:40%;">Champ</th>
        <th style="text-align:left; padding:8px 12px; border:1px solid #e5e7eb;">Valeur</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">Type de pièce</td>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;"><strong>{type_piece}</strong></td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">Fournisseur</td>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">{fournisseur}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">Date</td>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">{date_fr}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">N° de facture / Réf.</td>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">{numero}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">Montant HT</td>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">{ht}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">TVA</td>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;">{tva}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;"><strong>Montant TTC</strong></td>
        <td style="padding:8px 12px; border:1px solid #e5e7eb;"><strong>{ttc}</strong></td>
      </tr>
      {bloc_anomalies}
    </tbody>
  </table>

  <p style="color:#6b7280; font-size:12px; margin-top:24px; border-top:1px solid #e5e7eb; padding-top:12px;">
    Fichier d'origine : <em>{nom_fichier_original}</em><br>
    Ce message a été généré automatiquement par l'agent pré-comptable.
    Les informations doivent être vérifiées avant toute saisie comptable.
  </p>

</body>
</html>"""

    return html

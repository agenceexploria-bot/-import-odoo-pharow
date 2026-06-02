export const POSTES_ODOO = [
  "Achats", "QHSE", "Bureau d'étude", "Ingénieur travaux", "Infirmier / Médical",
  "CHSCT", "Commercial", "Comptable", "Consultant",
  "Directeur / Responsable administratif", "Directeur / Responsable commercial",
  "Production", "Directeur / Responsable de site", "Président / Directeur général",
  "Directeur / Responsable technique", "Ergonome", "Formateur", "Ingénieur",
  "Industrialisation / Amélioration continue", "Laboratoire", "Logistique",
  "Directeur / Responsable magasin", "Maintenance / Entretien", "Médecin du travail",
  "Méthodes", "Sécurité", "Qualité", "Responsable de parc", "Ressources humaines",
  "Santé au travail", "Services généraux", "Stagiaire", "Chef produits matériaux",
  "Directeur / Responsable d'exploitation", "Responsable production",
  "Responsable sécurité", "Directeur / Responsable achats", "Responsable atelier",
  "Assistant(e) de direction", "Chef de chantier / Conducteur de travaux",
  "Directeur / Chef de projet", "Technicien", "Directeur / Responsable financier",
  "Comptable fournisseur", "SAV", "Commandes et suivis", "Responsable maintenance",
  "Réception", "Chargé de projets techniques", "Responsable QHSE", "Directeur d'usine",
  "Administratif", "Projeteur / Métreur", "Directeur industriel", "Service client",
  "Responsable SAV", "Responsable Méthodes", "Responsable Logistique", "Marketing",
  "Maitre d'oeuvre", "Magasinier", "Maire", "Chargé d'affaires", "Architecte",
  "Responsable travaux", "Gestionnaire de stock", "Directeur / Responsable opérations",
  "Gestionnaire de Marchés Publics", "Economiste", "Directeur / Responsable d'agence",
  "Ingénieur étude de prix", "Responsable des études de prix",
  "Business Development Manager", "Recherche & Développement",
  "Responsable travaux neufs", "Responsable secteur", "Chef d'équipe",
  "Chef de projet immobilier / Développement immobilier",
  "Responsable projet industriel", "Industrie 4.0", "Responsable Process",
  "Supply chain manager", "Lean", "Infrastructure / Bâtiment",
  "Commercial itinérant", "Animateur terrain / réseau",
] as const;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KEYWORD_RULES: Array<{ keywords: string[]; poste: string }> = [
  { keywords: ["amelioration continue", "industrialisation"], poste: "Industrialisation / Amélioration continue" },
  { keywords: ["supply chain"], poste: "Supply chain manager" },
  { keywords: ["responsable travaux neufs", "travaux neufs"], poste: "Responsable travaux neufs" },
  { keywords: ["responsable travaux"], poste: "Responsable travaux" },
  { keywords: ["chef chantier", "conducteur travaux", "chef de chantier"], poste: "Chef de chantier / Conducteur de travaux" },
  { keywords: ["chef de projet immobilier", "developpement immobilier"], poste: "Chef de projet immobilier / Développement immobilier" },
  { keywords: ["chef de projet", "project manager", "chef projet"], poste: "Directeur / Chef de projet" },
  { keywords: ["responsable methodes", "responsable methode"], poste: "Responsable Méthodes" },
  { keywords: ["methodes", "method"], poste: "Méthodes" },
  { keywords: ["responsable maintenance"], poste: "Responsable maintenance" },
  { keywords: ["maintenance entretien", "maintenance"], poste: "Maintenance / Entretien" },
  { keywords: ["responsable qhse"], poste: "Responsable QHSE" },
  { keywords: ["qhse"], poste: "QHSE" },
  { keywords: ["responsable securite"], poste: "Responsable sécurité" },
  { keywords: ["securite", "hse", "ehs"], poste: "Sécurité" },
  { keywords: ["ergonome"], poste: "Ergonome" },
  { keywords: ["pdg", "president directeur general", "directeur general", "president"], poste: "Président / Directeur général" },
  { keywords: ["ressources humaines", "rh", "human resources", "drh"], poste: "Ressources humaines" },
  { keywords: ["responsable logistique", "logistique", "logistic"], poste: "Responsable Logistique" },
  { keywords: ["lean"], poste: "Lean" },
  { keywords: ["bureau d etude", "be ", "engineering"], poste: "Bureau d'étude" },
  { keywords: ["qualite", "quality"], poste: "Qualité" },
  { keywords: ["comptable fournisseur"], poste: "Comptable fournisseur" },
  { keywords: ["comptable", "accounting"], poste: "Comptable" },
  { keywords: ["commercial itinerant"], poste: "Commercial itinérant" },
  { keywords: ["directeur responsable commercial", "directeur commercial"], poste: "Directeur / Responsable commercial" },
  { keywords: ["commercial", "sales"], poste: "Commercial" },
  { keywords: ["technicien", "technician"], poste: "Technicien" },
  { keywords: ["formateur", "formation"], poste: "Formateur" },
  { keywords: ["directeur usine", "plant manager", "directeur d usine"], poste: "Directeur d'usine" },
  { keywords: ["directeur industriel"], poste: "Directeur industriel" },
  { keywords: ["directeur site", "site manager", "directeur responsable de site"], poste: "Directeur / Responsable de site" },
  { keywords: ["directeur technique", "cto", "directeur responsable technique"], poste: "Directeur / Responsable technique" },
  { keywords: ["directeur financier", "cfo", "daf", "directeur responsable financier"], poste: "Directeur / Responsable financier" },
  { keywords: ["directeur administratif", "directeur responsable administratif"], poste: "Directeur / Responsable administratif" },
  { keywords: ["directeur exploitation", "directeur responsable exploitation"], poste: "Directeur / Responsable d'exploitation" },
  { keywords: ["directeur operations", "coo", "directeur responsable operations"], poste: "Directeur / Responsable opérations" },
  { keywords: ["directeur achats", "responsable achats"], poste: "Directeur / Responsable achats" },
  { keywords: ["directeur agence", "directeur responsable agence"], poste: "Directeur / Responsable d'agence" },
  { keywords: ["directeur responsable magasin"], poste: "Directeur / Responsable magasin" },
  { keywords: ["service client", "customer service"], poste: "Service client" },
  { keywords: ["responsable sav"], poste: "Responsable SAV" },
  { keywords: ["sav"], poste: "SAV" },
  { keywords: ["responsable production"], poste: "Responsable production" },
  { keywords: ["production"], poste: "Production" },
  { keywords: ["r&d", "recherche developpement", "recherche et developpement"], poste: "Recherche & Développement" },
  { keywords: ["industrie 4.0", "digital", "transformation digitale"], poste: "Industrie 4.0" },
  { keywords: ["medecin travail", "sante travail"], poste: "Médecin du travail" },
  { keywords: ["infirmier", "medical"], poste: "Infirmier / Médical" },
  { keywords: ["architecte"], poste: "Architecte" },
  { keywords: ["charge affaires", "chargé d affaires"], poste: "Chargé d'affaires" },
  { keywords: ["assistant direction", "assistante direction"], poste: "Assistant(e) de direction" },
  { keywords: ["business development", "bdm"], poste: "Business Development Manager" },
  { keywords: ["responsable process", "process"], poste: "Responsable Process" },
  { keywords: ["ingenieur travaux"], poste: "Ingénieur travaux" },
  { keywords: ["ingenieur etude de prix"], poste: "Ingénieur étude de prix" },
  { keywords: ["responsable etudes de prix"], poste: "Responsable des études de prix" },
  { keywords: ["ingenieur"], poste: "Ingénieur" },
  { keywords: ["responsable secteur"], poste: "Responsable secteur" },
  { keywords: ["responsable projet industriel"], poste: "Responsable projet industriel" },
  { keywords: ["responsable atelier"], poste: "Responsable atelier" },
  { keywords: ["responsable parc"], poste: "Responsable de parc" },
  { keywords: ["maitre oeuvre", "maitrise oeuvre"], poste: "Maitre d'oeuvre" },
  { keywords: ["charge projets techniques", "charge de projets"], poste: "Chargé de projets techniques" },
  { keywords: ["gestionnaire stock"], poste: "Gestionnaire de stock" },
  { keywords: ["gestionnaire marches"], poste: "Gestionnaire de Marchés Publics" },
  { keywords: ["economiste"], poste: "Economiste" },
  { keywords: ["projeteur", "metreur"], poste: "Projeteur / Métreur" },
  { keywords: ["infrastructure", "batiment"], poste: "Infrastructure / Bâtiment" },
  { keywords: ["animateur terrain", "animateur reseau"], poste: "Animateur terrain / réseau" },
  { keywords: ["chef equipe", "chef d equipe"], poste: "Chef d'équipe" },
  { keywords: ["magasinier"], poste: "Magasinier" },
  { keywords: ["maire"], poste: "Maire" },
  { keywords: ["marketing"], poste: "Marketing" },
  { keywords: ["laboratoire", "labo"], poste: "Laboratoire" },
  { keywords: ["administratif", "administration"], poste: "Administratif" },
  { keywords: ["services generaux"], poste: "Services généraux" },
  { keywords: ["sante travail"], poste: "Santé au travail" },
  { keywords: ["stagiaire"], poste: "Stagiaire" },
  { keywords: ["commandes", "suivi commandes"], poste: "Commandes et suivis" },
  { keywords: ["reception"], poste: "Réception" },
  { keywords: ["consultant"], poste: "Consultant" },
  { keywords: ["chsct"], poste: "CHSCT" },
  { keywords: ["chef produits", "chef de produits"], poste: "Chef produits matériaux" },
];

function fuzzyScore(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" "));
  const wordsB = new Set(normalize(b).split(" "));
  let matches = 0;
  for (const w of wordsA) {
    if (w.length > 2 && wordsB.has(w)) matches++;
  }
  return matches / Math.max(wordsA.size, wordsB.size, 1);
}

export function matchPoste(posteOccupe: string): string {
  if (!posteOccupe) return "Directeur / Chef de projet";
  const n = normalize(posteOccupe);

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (n.includes(kw)) return rule.poste;
    }
  }

  // fuzzy fallback
  let bestScore = 0;
  let bestPoste = "Directeur / Chef de projet";
  for (const poste of POSTES_ODOO) {
    const score = fuzzyScore(posteOccupe, poste);
    if (score > bestScore) {
      bestScore = score;
      bestPoste = poste;
    }
  }
  if (bestScore > 0.3) return bestPoste;

  // TODO: branchement IA optionnel — appel Claude pour matching plus précis
  return "Directeur / Chef de projet";
}

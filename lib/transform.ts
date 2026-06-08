import { PharowRow } from "./csvParser";
import { matchPoste } from "./posteMatcher";
import { parseVille } from "./villeParser";

export interface OdooRow {
  email: string;
  website: string;
  comment: string;
  name: string;
  job_position_id: string;
  function: string;
  phone: string;
  mobile: string;
  SIRET: string;
  Company: string;
  category_id: string;
  source_contact: string;
  _ville: string; // colonne interne — exclue du CSV final
  _adresse: string; // adresse de l'établissement — aperçu uniquement, exclue du CSV
}

function formatName(nom: string, prenom: string): string {
  const parts = prenom.split(/[-\s]/).map((p) =>
    p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  );
  const formattedPrenom = prenom.includes("-")
    ? parts.join("-")
    : parts.join(" ");
  return `${nom.toUpperCase()} ${formattedPrenom}`;
}

function formatMobile(tel1: string, tel2: string, tel3: string): string {
  const raw = tel1 || tel2 || tel3;
  if (!raw) return "";
  const digits = raw.replace(/\s/g, "");
  // format 33XXXXXXXXX → +33 X XX XX XX XX
  if (/^33\d{9}$/.test(digits)) {
    const local = digits.slice(2); // 9 chiffres
    return `+33 ${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }
  return raw;
}

export function transformRow(
  row: PharowRow,
  categoryId: string,
  siretResult: { siret: string; confirmer: boolean; adresse?: string }
): OdooRow {
  const villeInfo = parseVille(row["Ville de résidence"] ?? "");
  // adresse de l'établissement trouvé ; à défaut, adresse du siège du fichier
  const adresseEtab = siretResult.adresse || (row["Adresse du siège complète"] ?? "");

  return {
    email: row["Email"] ?? "",
    website: row["URL LinkedIn du prospect"] ?? "",
    comment: siretResult.confirmer ? "SIRET A CONFIRMER" : "",
    name: formatName(row["Nom"] ?? "", row["Prénom"] ?? ""),
    job_position_id: matchPoste(row["Poste occupé"] ?? ""),
    function: row["Poste occupé"] ?? "",
    phone: row["Tél portable"] ?? "",
    mobile: formatMobile(
      row["Tél Kaspr (1)"] ?? "",
      row["Tél Kaspr (2)"] ?? "",
      row["Tél Kaspr (3)"] ?? ""
    ),
    SIRET: siretResult.siret,
    Company: "Actiwork",
    category_id: categoryId,
    source_contact: "Marketing",
    _ville: villeInfo.ville,
    _adresse: adresseEtab,
  };
}

export function toCsvString(rows: OdooRow[]): string {
  const COLS: (keyof OdooRow)[] = [
    "email", "website", "comment", "name", "job_position_id",
    "function", "phone", "mobile", "SIRET", "Company",
    "category_id", "source_contact",
  ];

  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const header = COLS.join(",");
  const dataLines = rows.map((r) =>
    COLS.map((c) => escape(r[c] ?? "")).join(",")
  );
  return [header, ...dataLines].join("\n");
}

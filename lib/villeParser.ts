export interface VilleInfo {
  ville: string;
  codePostal?: string;
  departement?: string;
}

export function parseVille(raw: string): VilleInfo {
  if (!raw) return { ville: "" };
  const trimmed = raw.trim();

  // "Caen (14000)" — code postal 5 chiffres
  const matchCP = trimmed.match(/^(.+?)\s*\((\d{5})\)\s*$/);
  if (matchCP) {
    return {
      ville: matchCP[1].trim(),
      codePostal: matchCP[2],
      departement: matchCP[2].substring(0, 2),
    };
  }

  // "Lyon (69)" — département 2 chiffres
  const matchDept = trimmed.match(/^(.+?)\s*\((\d{2,3})\)\s*$/);
  if (matchDept) {
    return {
      ville: matchDept[1].trim(),
      departement: matchDept[2],
    };
  }

  return { ville: trimmed };
}

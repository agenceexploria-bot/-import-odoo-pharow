import Papa from "papaparse";

export interface PharowRow {
  Nom: string;
  Prénom: string;
  Email: string;
  "URL LinkedIn du prospect": string;
  "Ville de résidence": string;
  "Poste occupé": string;
  "Tél portable": string;
  "Tél Kaspr (1)": string;
  "Tél Kaspr (2)": string;
  "Tél Kaspr (3)": string;
  SIREN: string;
  "SIRET du siège": string;
  "Nom commercial": string;
  [key: string]: string;
}

function unwrapExcelLine(line: string): string {
  // retire le " initial et final, remplace "" par "
  let s = line;
  if (s.startsWith('"')) s = s.slice(1);
  if (s.endsWith('"')) s = s.slice(0, -1);
  s = s.replace(/""/g, '"');
  return s;
}

export function parsePharowCSV(text: string): PharowRow[] {
  // supprimer BOM éventuel
  const clean = text.startsWith("﻿") ? text.slice(1) : text;

  const lines = clean.split(/\r?\n/);
  const firstLine = lines[0] ?? "";

  let csvText: string;
  if (firstLine.startsWith('"') && firstLine.includes('"","')) {
    // format Excel wrapped
    csvText = lines
      .filter((l) => l.trim() !== "")
      .map(unwrapExcelLine)
      .join("\n");
  } else {
    csvText = clean;
  }

  const result = Papa.parse<PharowRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
  });

  return result.data;
}

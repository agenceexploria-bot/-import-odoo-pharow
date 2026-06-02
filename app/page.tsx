"use client";

import { useRef, useState, useCallback } from "react";
import { parsePharowCSV, PharowRow } from "@/lib/csvParser";
import { resolveSiret, clearSiretCache } from "@/lib/siretClient";
import { transformRow, toCsvString, OdooRow } from "@/lib/transform";
import { matchPoste } from "@/lib/posteMatcher";

const LABELS: { value: string; label: string; hint?: string }[] = [
  { value: "AW - A prospecter par BD (Audrey)", label: "AW - A prospecter par BD (Audrey)" },
  { value: "AW - A prospecter par Guillaume", label: "AW - A prospecter par Guillaume" },
  { value: "", label: "Aucune étiquette", hint: "import sans assigner de prospecteur" },
];

type Phase = "upload" | "processing" | "results";

interface Stats {
  total: number;
  siretConfirmed: number;
  siretToConfirm: number;
  noEmail: number;
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PharowRow[]>([]);
  const [label, setLabel] = useState(LABELS[0].value);
  const [phase, setPhase] = useState<Phase>("upload");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [outputRows, setOutputRows] = useState<OdooRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, siretConfirmed: 0, siretToConfirm: 0, noEmail: 0 });

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parsePharowCSV(text);
      setRows(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const runProcessing = async () => {
    if (!rows.length) return;
    setPhase("processing");
    setProgress(0);
    clearSiretCache();

    const result: OdooRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nom = row["Nom"] ?? "";
      const prenom = row["Prénom"] ?? "";
      setProgressLabel(`Traitement de ${nom} ${prenom} (${i + 1}/${rows.length})`);

      const siretResult = await resolveSiret(row, (msg) => {
        setProgressLabel(`${nom} ${prenom} — ${msg}`);
      });

      result.push(transformRow(row, label, siretResult));
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    const statsData: Stats = {
      total: result.length,
      siretConfirmed: result.filter((r) => !r.comment.includes("CONFIRMER")).length,
      siretToConfirm: result.filter((r) => r.comment.includes("CONFIRMER")).length,
      noEmail: result.filter((r) => !r.email).length,
    };

    setOutputRows(result);
    setStats(statsData);
    setPhase("results");
  };

  const downloadCsv = () => {
    const csv = toCsvString(outputRows);
    const base64 = btoa(unescape(encodeURIComponent(csv)));
    const a = document.createElement("a");
    a.href = `data:text/csv;base64,${base64}`;
    a.download = "import_odoo.csv";
    a.click();
  };

  const reset = () => {
    setPhase("upload");
    setRows([]);
    setFileName("");
    setOutputRows([]);
    setProgress(0);
    setProgressLabel("");
    setLabel(LABELS[0].value);
    clearSiretCache();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // stats postes
  const posteCount: Record<string, number> = {};
  for (const r of outputRows) {
    posteCount[r.job_position_id] = (posteCount[r.job_position_id] ?? 0) + 1;
  }
  const sortedPostes = Object.entries(posteCount).sort((a, b) => b[1] - a[1]);

  // stats entreprises
  const companyCount: Record<string, number> = {};
  for (const r of rows) {
    const c = r["Nom commercial"] ?? "—";
    companyCount[c] = (companyCount[c] ?? 0) + 1;
  }
  const sortedCompanies = Object.entries(companyCount).sort((a, b) => b[1] - a[1]);

  return (
    <div className="container">
      <div className="logo">
        <div>
          <div className="logo-text">Import Odoo</div>
          <div className="logo-sub">Pharow / Kaspr → Contacts Odoo · Actiwork</div>
        </div>
      </div>

      {phase === "upload" && (
        <>
          <div className="card">
            <div className="step-title">Étape 1 — Charger le fichier CSV</div>
            <div
              className={`dropzone${dragOver ? " drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon">📂</div>
              <div className="dropzone-label">Glissez votre fichier CSV ici</div>
              <div className="dropzone-hint">ou cliquez pour sélectionner</div>
              <button className="dropzone-btn" type="button">Choisir un fichier</button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={onFileChange}
            />
            {fileName && (
              <div className="file-selected">
                ✅ <strong>{fileName}</strong> — {rows.length} contacts détectés
              </div>
            )}
          </div>

          <div className="card">
            <div className="step-title">Étape 2 — Choisir l&apos;étiquette</div>
            <div className="radio-group">
              {LABELS.map((l) => (
                <label
                  key={l.value}
                  className={`radio-label${label === l.value ? " checked" : ""}`}
                >
                  <input
                    type="radio"
                    name="label"
                    value={l.value}
                    checked={label === l.value}
                    onChange={() => setLabel(l.value)}
                  />
                  {l.label}
                  {l.hint && <span style={{ fontSize: 12, marginLeft: 8, color: "#94a3b8" }}>({l.hint})</span>}
                </label>
              ))}
            </div>
          </div>

          <button
            className="btn-primary"
            disabled={!rows.length}
            onClick={runProcessing}
          >
            Lancer le traitement →
          </button>
        </>
      )}

      {phase === "processing" && (
        <div className="card">
          <div className="step-title">Traitement en cours…</div>
          <div className="progress-wrap">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-label">{progressLabel}</div>
          </div>
        </div>
      )}

      {phase === "results" && (
        <>
          <div className="card">
            <div className="step-title">Résultats</div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Contacts traités</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.siretConfirmed}</div>
                <div className="stat-label">SIRET confirmés</div>
              </div>
              <div className={`stat-card${stats.siretToConfirm > 0 ? " warning" : ""}`}>
                <div className="stat-value">{stats.siretToConfirm}</div>
                <div className="stat-label">SIRET à confirmer</div>
              </div>
              <div className={`stat-card${stats.noEmail > 0 ? " danger" : ""}`}>
                <div className="stat-value">{stats.noEmail}</div>
                <div className="stat-label">Sans email</div>
              </div>
            </div>

            <div className="section-title">Postes Odoo attribués</div>
            <div className="tag-list">
              {sortedPostes.map(([poste, count]) => (
                <span key={poste} className="tag">
                  {poste} <span className="count">{count}</span>
                </span>
              ))}
            </div>

            <div className="section-title">Entreprises ({sortedCompanies.length})</div>
            <div className="company-list">
              {sortedCompanies.map(([company, count]) => (
                <div key={company} className="company-row">
                  <span>{company}</span>
                  <span className="company-count">{count} contact{count > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>

            <div className="section-title">Aperçu (10 premières lignes)</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Poste Odoo</th>
                    <th>Ville</th>
                    <th>SIRET</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {outputRows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.job_position_id}</td>
                      <td>{r._ville}</td>
                      <td>
                        {r.SIRET}
                        {r.comment && <div className="confirmer">⚠ {r.comment}</div>}
                      </td>
                      <td>{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions">
              <button className="btn-primary" style={{ flex: 2 }} onClick={downloadCsv}>
                ⬇ Télécharger le CSV Odoo
              </button>
              <button className="btn-secondary" onClick={reset}>
                Nouveau fichier
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

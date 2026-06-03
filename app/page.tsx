"use client";

import { Fragment, useRef, useState, useCallback, useEffect } from "react";
import { parsePharowCSV, PharowRow } from "@/lib/csvParser";
import { resolveSiret, clearSiretCache } from "@/lib/siretClient";
import { transformRow, toCsvString, OdooRow } from "@/lib/transform";

// ── Types ──────────────────────────────────────────────────────────────────

type View = "home" | "convert" | "mapping" | "history" | "settings";

interface ConversionRecord {
  id: string;
  file: string;
  date: string;
  rows: number;
  contacts: number;
  siretToConfirm: number;
  noEmail: number;
  status: "success" | "partial" | "error";
  csvData: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const LABELS = [
  { value: "AW - A prospecter par BD (Audrey)", label: "AW - A prospecter par BD (Audrey)" },
  { value: "AW - A prospecter par Guillaume", label: "AW - A prospecter par Guillaume" },
  { value: "", label: "Aucune étiquette" },
];

const PHAROW_MAPPING = [
  { col: "Prénom + Nom",      odoo: "name",                type: "Texte",     note: "Formaté NOM Prénom",        status: "ok"      },
  { col: "Email",             odoo: "email",               type: "E-mail",    note: "Requis pour Odoo",           status: "ok"      },
  { col: "Poste occupé",      odoo: "function / job_position_id", type: "Texte / Liste", note: "Catégorisé auto", status: "ok"  },
  { col: "URL LinkedIn",      odoo: "website",             type: "URL",       note: "",                           status: "ok"      },
  { col: "Tél portable",      odoo: "phone",               type: "Téléphone", note: "",                           status: "ok"      },
  { col: "Tél Kaspr (1/2/3)", odoo: "mobile",              type: "Téléphone", note: "Meilleur des 3, formaté",   status: "ok"      },
  { col: "SIRET du siège",    odoo: "SIRET",               type: "Texte",     note: "Vérifié via API INSEE",      status: "ok"      },
  { col: "Nom commercial",    odoo: "Company",             type: "Texte",     note: "Fixé à Actiwork",            status: "ok"      },
  { col: "Ville de résidence",odoo: "— (usage interne)",   type: "Texte",     note: "Non exporté dans le CSV",   status: "warn"    },
  { col: "SIREN",             odoo: "— (ignoré)",          type: "—",         note: "",                           status: "ignored" },
];

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "home",     label: "Accueil",            icon: "grid"    },
  { id: "convert",  label: "Nouvelle conversion", icon: "convert" },
  { id: "mapping",  label: "Modèle de mapping",   icon: "map"     },
  { id: "history",  label: "Historique",           icon: "clock"   },
  { id: "settings", label: "Paramètres",           icon: "gear"    },
];

const CV_STEPS = ["Importer", "Vérifier le mapping", "Convertir", "Télécharger"];

// ── Icon ───────────────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  grid:        '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  convert:     '<path d="M4 7h11"/><path d="m11 3 4 4-4 4"/><path d="M20 17H9"/><path d="m13 21-4-4 4-4"/>',
  map:         '<path d="M3 7v13l6-3 6 3 6-3V4l-6 3-6-3-6 3Z"/><path d="M9 4v13"/><path d="M15 7v13"/>',
  clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear:        '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  upload:      '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  uploadCloud: '<path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0 0 17 8.5h-1.3A7 7 0 1 0 4 15"/>',
  download:    '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
  check:       '<path d="M20 6 9 17l-5-5"/>',
  x:           '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert:       '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/>',
  arrowRight:  '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  bell:        '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  search:      '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  fileCheck:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
  sheet:       '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  info:        '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  userCheck:   '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
};

function Icon({ name, size = 20, stroke = 2, style }: {
  name: string; size?: number; stroke?: number; style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }} />
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    success: { cls: "st-success", icon: "check", label: "Succès"  },
    partial: { cls: "st-partial", icon: "alert", label: "Partiel" },
    error:   { cls: "st-error",   icon: "x",     label: "Échec"   },
  };
  const m = map[status] ?? map.error;
  return (
    <span className={`badge ${m.cls}`}>
      <Icon name={m.icon} size={12} stroke={2.6} />{m.label}
    </span>
  );
}

function MappingBadge({ status }: { status: string }) {
  if (status === "ok")      return <span className="badge st-ok"><Icon name="check" size={12} stroke={2.6} />Mappé</span>;
  if (status === "warn")    return <span className="badge st-warn"><Icon name="alert" size={12} />Interne</span>;
  if (status === "ignored") return <span className="badge st-ignored"><Icon name="x" size={12} />Ignoré</span>;
  return null;
}

// ── Btn ────────────────────────────────────────────────────────────────────

function Btn({ children, variant = "primary", icon, size = "md", onClick, disabled, style }: {
  children: React.ReactNode; variant?: string; icon?: string; size?: string;
  onClick?: () => void; disabled?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={style}
      className={`btn btn-${variant} btn-${size}`}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} stroke={2.4} />}
      {children}
    </button>
  );
}

// ── Stepper ────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper">
      {CV_STEPS.map((s, i) => (
        <Fragment key={s}>
          <div className={`step${i < step ? " done" : i === step ? " active" : ""}`}>
            <span className="step-dot">
              {i < step ? <Icon name="check" size={15} stroke={3} /> : i + 1}
            </span>
            <span className="step-label">{s}</span>
          </div>
          {i < CV_STEPS.length - 1 && <div className={`step-bar${i < step ? " done" : ""}`} />}
        </Fragment>
      ))}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

function Dashboard({ history, onNew }: { history: ConversionRecord[]; onNew: () => void }) {
  const totalContacts = history.reduce((s, r) => s + r.contacts, 0);
  const totalSiret = history.reduce((s, r) => s + r.siretToConfirm, 0);
  const totalNoEmail = history.reduce((s, r) => s + r.noEmail, 0);

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Accueil</div>
          <div className="page-sub">Conversions Pharow / Kaspr → Contacts Odoo · Actiwork</div>
        </div>
      </div>

      <div className="cta-card">
        <div className="cta-ico"><Icon name="convert" size={26} /></div>
        <div style={{ flex: 1 }}>
          <div className="cta-title">Convertir un export Pharow</div>
          <div className="cta-sub">Importez votre fichier CSV, vérifiez le mapping, et téléchargez le fichier prêt pour Odoo.</div>
        </div>
        <Btn icon="upload" onClick={onNew}>Nouvelle conversion</Btn>
      </div>

      <div className="kpi-grid">
        <div className="card card-pad kpi">
          <div className="kpi-top">
            <div className="kpi-ico"><Icon name="sheet" size={20} /></div>
          </div>
          <div className="kpi-val">{history.length}</div>
          <div className="kpi-label">Fichiers convertis</div>
          <div className="kpi-sub">depuis le début</div>
        </div>
        <div className="card card-pad kpi">
          <div className="kpi-top">
            <div className="kpi-ico"><Icon name="userCheck" size={20} /></div>
          </div>
          <div className="kpi-val">{totalContacts.toLocaleString("fr-FR")}</div>
          <div className="kpi-label">Contacts générés</div>
          <div className="kpi-sub">lignes exportées</div>
        </div>
        <div className="card card-pad kpi">
          <div className="kpi-top">
            <div className="kpi-ico amber"><Icon name="alert" size={20} /></div>
          </div>
          <div className="kpi-val">{totalSiret}</div>
          <div className="kpi-label">SIRET à confirmer</div>
          <div className="kpi-sub">vérification manuelle</div>
        </div>
        <div className="card card-pad kpi">
          <div className="kpi-top">
            <div className="kpi-ico red"><Icon name="x" size={20} /></div>
          </div>
          <div className="kpi-val">{totalNoEmail}</div>
          <div className="kpi-label">Sans email</div>
          <div className="kpi-sub">contacts incomplets</div>
        </div>
      </div>

    </div>
  );
}

// ── Convert wizard ─────────────────────────────────────────────────────────

function ConvertWizard({ defaultLabel, onComplete }: {
  defaultLabel: string;
  onComplete: (record: ConversionRecord) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  const [step, setStep] = useState(0);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PharowRow[]>([]);
  const [detectedCols, setDetectedCols] = useState<string[]>([]);
  const [localLabel, setLocalLabel] = useState(defaultLabel);
  const [localSiret, setLocalSiret] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [outputRows, setOutputRows] = useState<OdooRow[]>([]);
  const [stats, setStats] = useState({ total: 0, siretConfirmed: 0, siretToConfirm: 0, noEmail: 0 });
  const [csvData, setCsvData] = useState("");

  // Fire onComplete AFTER step 3 is painted — no setTimeout needed
  useEffect(() => {
    if (step !== 3 || completedRef.current || !csvData) return;
    completedRef.current = true;
    const s = stats;
    const status = s.noEmail === s.total && s.total > 0 ? "error" : s.siretToConfirm > 0 || s.noEmail > 0 ? "partial" : "success";
    onCompleteRef.current({
      id: `CV-${Date.now().toString().slice(-4)}`,
      file: fileName,
      date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      rows: rows.length,
      contacts: s.total,
      siretToConfirm: s.siretToConfirm,
      noEmail: s.noEmail,
      status,
      csvData,
    });
  }, [step, csvData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parsePharowCSV(text);
      setRows(parsed);
      setFileName(file.name);
      setDetectedCols(parsed.length > 0 ? Object.keys(parsed[0]) : []);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const runConvert = async () => {
    setStep(2); setProgress(0); setProgressLabel("");
    clearSiretCache();
    const result: OdooRow[] = [];
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nom = row["Nom"] ?? "";
        const prenom = row["Prénom"] ?? "";
        setProgressLabel(`${nom} ${prenom} (${i + 1}/${rows.length})`);
        const siretResult = localSiret
          ? await resolveSiret(row, (msg) => setProgressLabel(`${nom} ${prenom} — ${msg}`))
          : { siret: (row["SIRET du siège"] ?? "").trim(), confirmer: true, source: "fallback" as const };
        result.push(transformRow(row, localLabel, siretResult));
        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }
    } catch (err) {
      console.error("Conversion error:", err);
    }
    const csv = toCsvString(result);
    const s = {
      total: result.length,
      siretConfirmed: result.filter(r => !r.comment.includes("CONFIRMER")).length,
      siretToConfirm: result.filter(r => r.comment.includes("CONFIRMER")).length,
      noEmail: result.filter(r => !r.email).length,
    };
    setOutputRows(result);
    setStats(s);
    setCsvData(csv);
    setStep(3);
  };

  const downloadCsv = () => {
    const base64 = btoa(unescape(encodeURIComponent(csvData)));
    const a = document.createElement("a");
    a.href = `data:text/csv;base64,${base64}`;
    a.download = "import_odoo.csv";
    a.click();
  };

  const reset = () => {
    completedRef.current = false;
    setStep(0); setFileName(""); setRows([]); setDetectedCols([]);
    setProgress(0); setProgressLabel(""); setOutputRows([]); setCsvData("");
    setStats({ total: 0, siretConfirmed: 0, siretToConfirm: 0, noEmail: 0 });
    clearSiretCache();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Nouvelle conversion</div>
          <div className="page-sub">Transformez un export Pharow / Kaspr en fichier prêt pour Odoo</div>
        </div>
        {step > 0 && step < 2 && <Btn variant="ghost" icon="x" onClick={reset}>Recommencer</Btn>}
      </div>

      <Stepper step={step} />

      {/* Step 0 — Import */}
      {step === 0 && (
        <div>
          <div className="card card-pad">
            {!fileName ? (
              <div
                className={`dropzone${drag ? " drag" : ""}`}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dz-ico"><Icon name="uploadCloud" size={28} /></div>
                <div className="dz-title">Déposez votre export Pharow / Kaspr ici</div>
                <div className="dz-sub">ou cliquez pour parcourir · format CSV uniquement</div>
                <div className="dz-formats">
                  <span className="fmt-tag">.csv</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="file-card">
                  <div className="file-ico"><Icon name="sheet" size={22} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="file-name">{fileName}</div>
                    <div className="file-meta">{rows.length} contacts détectés · {detectedCols.length} colonnes</div>
                  </div>
                  <span className="badge st-success"><Icon name="check" size={12} stroke={2.6} />Lu avec succès</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--ink-3)", margin: "18px 0 10px" }}>
                  Colonnes détectées
                </div>
                <div className="col-chips">
                  {detectedCols.map(c => <span className="col-chip" key={c}>{c}</span>)}
                </div>
                <div className="row" style={{ marginTop: 22, justifyContent: "flex-end", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => { setFileName(""); setRows([]); setDetectedCols([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    Changer de fichier
                  </Btn>
                  <Btn icon="arrowRight" onClick={() => setStep(1)}>Continuer vers le mapping</Btn>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {/* Options de conversion */}
          <div className="card" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div className="card-pad" style={{ borderRight: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12 }}>
                Prospecteur
              </div>
              <div className="radio-group-v">
                {LABELS.map(l => (
                  <label key={l.value} className={`radio-label-v${localLabel === l.value ? " checked" : ""}`}>
                    <input type="radio" name="wiz-label-0" value={l.value} checked={localLabel === l.value} onChange={() => setLocalLabel(l.value)} />
                    {l.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="card-pad">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12 }}>
                Règles de conversion
              </div>
              <div className="set-row">
                <div>
                  <div className="set-label">Résolution SIRET (API INSEE)</div>
                  <div className="set-desc">Vérifie et complète le SIRET pour chaque entreprise</div>
                </div>
                <button className={`toggle${localSiret ? " on" : ""}`} onClick={() => setLocalSiret(v => !v)}>
                  <span className="knob"></span>
                </button>
              </div>
              <div className="set-row">
                <div>
                  <div className="set-label">Format sortie</div>
                  <div className="set-desc">CSV · virgule · UTF-8 · compatible Odoo</div>
                </div>
                <span className="badge st-ok" style={{ flexShrink: 0 }}><Icon name="check" size={12} stroke={2.6} />CSV</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1 — Mapping */}
      {step === 1 && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ borderBottom: "1px solid var(--line)", padding: "0 0 10px", marginBottom: 0 }}>
              <div className="cmap-row" style={{ padding: "10px 16px", fontWeight: 700, fontSize: 11, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--ink-3)" }}>
                <div>Colonne Pharow</div><div></div><div>Champ Odoo</div><div style={{ textAlign: "right" }}>Statut</div>
              </div>
            </div>
            {PHAROW_MAPPING.map(r => (
              <div className="cmap-row" key={r.col}>
                <div className="cmap-col">{r.col}<div className="t">{r.type}</div></div>
                <div className="map-arrow"><Icon name="arrowRight" size={15} /></div>
                <div>
                  <div className="cmap-odoo">{r.odoo}</div>
                  {r.note && <div className="cmap-note">{r.note}</div>}
                </div>
                <div style={{ textAlign: "right" }}><MappingBadge status={r.status} /></div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="info" size={14} style={{ flexShrink: 0 }} />
            Le mapping est fixe pour les exports Pharow/Kaspr. La résolution SIRET se fait via l&apos;API INSEE.
          </div>

          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setStep(0)}>Retour</Btn>
            <div className="spacer" />
            <Btn icon="convert" onClick={runConvert}>
              Convertir {rows.length.toLocaleString("fr-FR")} contacts
            </Btn>
          </div>
        </div>
      )}

      {/* Step 2 — Processing */}
      {step === 2 && (
        <div className="card card-pad">
          <div className="convert-stage">
            <div className="cv-spin" />
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>Conversion en cours…</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 5 }}>
              Résolution des SIRET via INSEE + mise au format Odoo
            </div>
          </div>
          <div className="prog-bar-bg"><div className="prog-bar-fill" style={{ width: `${progress}%` }} /></div>
          <div className="prog-pct">{progress}%</div>
          <div className="prog-label">{progressLabel}</div>
        </div>
      )}

      {/* Step 3 — Download */}
      {step === 3 && (
        <div className="card card-pad">
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div className="cv-ring"><Icon name="check" size={32} stroke={3} /></div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.4px" }}>Conversion terminée</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 5 }}>
              Votre fichier est prêt à importer dans Odoo
            </div>
          </div>

          <div className="result-grid">
            <div className="result-stat">
              <div className="n">{stats.total.toLocaleString("fr-FR")}</div>
              <div className="l">Contacts traités</div>
            </div>
            <div className="result-stat">
              <div className="n green">{stats.siretConfirmed.toLocaleString("fr-FR")}</div>
              <div className="l">SIRET confirmés</div>
            </div>
            <div className="result-stat">
              <div className={`n${stats.siretToConfirm > 0 ? " amber" : ""}`}>{stats.siretToConfirm}</div>
              <div className="l">SIRET à confirmer</div>
            </div>
            <div className="result-stat">
              <div className={`n${stats.noEmail > 0 ? " red" : ""}`}>{stats.noEmail}</div>
              <div className="l">Sans email</div>
            </div>
          </div>

          <div className="dl-banner" style={{ marginBottom: 20 }}>
            <div className="fi"><Icon name="fileCheck" size={20} /></div>
            <div style={{ flex: 1 }}>
              <div className="dl-name">import_odoo.csv</div>
              <div className="dl-sub">CSV · virgule · UTF-8 · compatible import Odoo</div>
            </div>
            <Btn icon="download" onClick={downloadCsv}>Télécharger le CSV</Btn>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>
            Aperçu (10 premières lignes)
          </div>
          <div className="card tbl-wrap" style={{ boxShadow: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>Nom</th>
                  <th>Poste Odoo</th>
                  <th>Email</th>
                  <th>SIRET</th>
                </tr>
              </thead>
              <tbody>
                {outputRows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="strong" style={{ paddingLeft: 16 }}>{r.name}</td>
                    <td>{r.job_position_id}</td>
                    <td className={r.email ? "mono" : ""} style={!r.email ? { color: "var(--red)" } : {}}>
                      {r.email || "—"}
                    </td>
                    <td>
                      <span className="mono">{r.SIRET || "—"}</span>
                      {r.comment && <div className="confirmer">⚠ {r.comment}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ marginTop: 20, justifyContent: "center" }}>
            <Btn variant="ghost" icon="convert" onClick={reset}>Convertir un autre fichier</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mapping view ───────────────────────────────────────────────────────────

function MappingView() {
  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Modèle de mapping</div>
          <div className="page-sub">Correspondances entre les colonnes Pharow / Kaspr et les champs Odoo</div>
        </div>
      </div>
      <div className="card">
        <div style={{ borderBottom: "1px solid var(--line)", padding: "0 0 0", marginBottom: 0 }}>
          <div className="cmap-row" style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--ink-3)" }}>
            <div>Colonne Pharow / Kaspr</div><div></div><div>Champ Odoo</div><div style={{ textAlign: "right" }}>Statut</div>
          </div>
        </div>
        {PHAROW_MAPPING.map(r => (
          <div className="cmap-row" key={r.col}>
            <div className="cmap-col">{r.col}<div className="t">{r.type}</div></div>
            <div className="map-arrow"><Icon name="arrowRight" size={15} /></div>
            <div>
              <div className="cmap-odoo">{r.odoo}</div>
              {r.note && <div className="cmap-note">{r.note}</div>}
            </div>
            <div style={{ textAlign: "right" }}><MappingBadge status={r.status} /></div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon name="info" size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        Le mapping est fixe pour les exports Pharow et Kaspr. La résolution SIRET se fait automatiquement via l&apos;API INSEE.
      </div>
    </div>
  );
}

// ── History view ───────────────────────────────────────────────────────────

function HistoryView({ history }: { history: ConversionRecord[] }) {
  const [filter, setFilter] = useState("all");
  const filters = [{ id: "all", l: "Tout" }, { id: "success", l: "Succès" }, { id: "partial", l: "Partiel" }, { id: "error", l: "Échec" }];
  const shown = filter === "all" ? history : history.filter(r => r.status === filter);
  const ordered = [...shown].reverse();

  const download = (r: ConversionRecord) => {
    const base64 = btoa(unescape(encodeURIComponent(r.csvData)));
    const a = document.createElement("a");
    a.href = `data:text/csv;base64,${base64}`;
    a.download = `import_odoo_${r.id}.csv`;
    a.click();
  };

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Historique des conversions</div>
          <div className="page-sub">Re-téléchargez un fichier généré à tout moment</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid var(--line)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)", background: filter === f.id ? "var(--ink)" : "#fff", color: filter === f.id ? "#fff" : "var(--ink-2)" }}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="card tbl-wrap">
        {ordered.length === 0 ? (
          <div className="empty-state">
            <Icon name="clock" size={32} />
            <p>Aucune conversion dans cet historique.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Réf.</th>
                <th>Fichier source</th>
                <th>Date</th>
                <th>Contacts</th>
                <th>SIRET ⚠</th>
                <th>Sans email</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordered.map(r => (
                <tr key={r.id}>
                  <td className="mono strong" style={{ paddingLeft: 20 }}>{r.id}</td>
                  <td className="strong">{r.file}</td>
                  <td style={{ fontSize: 12 }}>{r.date}</td>
                  <td>{r.contacts.toLocaleString("fr-FR")}</td>
                  <td style={r.siretToConfirm > 0 ? { color: "var(--amber)", fontWeight: 600 } : {}}>{r.siretToConfirm || "—"}</td>
                  <td style={r.noEmail > 0 ? { color: "var(--red)", fontWeight: 600 } : {}}>{r.noEmail || "—"}</td>
                  <td><Badge status={r.status} /></td>
                  <td style={{ textAlign: "right", paddingRight: 20 }}>
                    <span className="cell-link" onClick={() => download(r)}>
                      <Icon name="download" size={14} />Télécharger
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Settings view ──────────────────────────────────────────────────────────

function SettingsView({ label, setLabel }: { label: string; setLabel: (v: string) => void }) {
  const [tog, setTog] = useState({ siret: true, utf8: true });
  const flip = (k: keyof typeof tog) => setTog(s => ({ ...s, [k]: !s[k] }));

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Paramètres</div>
          <div className="page-sub">Prospecteur par défaut et règles de conversion</div>
        </div>
      </div>

      <div className="set-grid">
        <div className="card card-pad">
          <div className="sec-title" style={{ marginBottom: 14 }}>Prospecteur par défaut</div>
          <div className="radio-group-v">
            {LABELS.map(l => (
              <label key={l.value} className={`radio-label-v${label === l.value ? " checked" : ""}`}>
                <input type="radio" name="label" value={l.value} checked={label === l.value} onChange={() => setLabel(l.value)} />
                {l.label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12, display: "flex", gap: 6 }}>
            <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            L&apos;étiquette choisie ici est appliquée à toutes les nouvelles conversions.
          </div>
        </div>

        <div className="card card-pad">
          <div className="sec-title" style={{ marginBottom: 6 }}>Règles de conversion</div>
          <div className="set-row">
            <div>
              <div className="set-label">Résolution SIRET (API INSEE)</div>
              <div className="set-desc">Vérifie et complète le SIRET pour chaque entreprise</div>
            </div>
            <button className={`toggle${tog.siret ? " on" : ""}`} onClick={() => flip("siret")}>
              <span className="knob"></span>
            </button>
          </div>
          <div className="set-row">
            <div>
              <div className="set-label">Format sortie</div>
              <div className="set-desc">CSV · séparateur virgule · UTF-8 · compatible Odoo</div>
            </div>
            <span className="badge st-ok" style={{ flexShrink: 0 }}><Icon name="check" size={12} stroke={2.6} />CSV</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────

export default function Home() {
  const [active, setActive] = useState<View>("home");
  const [label, setLabel] = useState(LABELS[0].value);
  const [history, setHistory] = useState<ConversionRecord[]>([]);
  const [convertKey, setConvertKey] = useState(0);

  const goNew = () => { setConvertKey(k => k + 1); setActive("convert"); };
  const navigate = (v: View) => { if (v === "convert") setConvertKey(k => k + 1); setActive(v); };
  const addRecord = useCallback((r: ConversionRecord) => setHistory(h => [...h, r]), []);

  const views: Record<View, React.ReactNode> = {
    home:     <Dashboard history={history} onNew={goNew} />,
    convert:  <ConvertWizard defaultLabel={label} onComplete={addRecord} key={convertKey} />,
    mapping:  <MappingView />,
    history:  <HistoryView history={history} />,
    settings: <SettingsView label={label} setLabel={setLabel} />,
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-mark">A<span className="w">W</span></div>
          <div className="logo-word"><span className="acti">Acti</span><span className="conv">convert</span></div>
        </div>
        <div className="search">
          <span className="search-ico"><Icon name="search" size={16} /></span>
          <input placeholder="Rechercher une conversion, un fichier…" readOnly />
        </div>
        <div className="header-right">
          <div className="header-divider" />
          <button className="icon-btn"><Icon name="bell" size={18} /></button>
          <Btn icon="upload" onClick={goNew}>Nouvelle conversion</Btn>
          <div className="avatar">AW</div>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="sidebar">
        <div className="nav-section">Navigation</div>
        {NAV.map(n => (
          <button key={n.id} className={`nav-item${active === n.id ? " active" : ""}`} onClick={() => navigate(n.id)}>
            <span className="nav-ico"><Icon name={n.icon} size={18} /></span>
            {n.label}
          </button>
        ))}
        <div className="sidebar-foot">
          <Icon name="info" size={14} style={{ color: "var(--ink-3)", marginBottom: 4 }} />
          <strong>Format accepté</strong>
          CSV · Pharow / Kaspr
        </div>
      </nav>

      {/* Main */}
      <main className="main">
        <div className="main-inner">
          {views[active]}
        </div>
      </main>
    </div>
  );
}

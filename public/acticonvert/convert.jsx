// Nouvelle conversion — assistant Importer → Mapping → Convertir → Télécharger
const { useState: useCv, useEffect: useCvEffect, useRef: useCvRef } = React;

const CV_STEPS = ['Importer', 'Vérifier le mapping', 'Convertir', 'Télécharger'];

function Stepper({ step }) {
  return (
    <div className="stepper">
      {CV_STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className={'step' + (i < step ? ' done' : i === step ? ' active' : '')}>
            <span className="step-dot">{i < step ? <Icon name="check" size={16} stroke={3} /> : i + 1}</span>
            <span className="step-label">{s}</span>
          </div>
          {i < CV_STEPS.length - 1 && <div className={'step-bar' + (i < step ? ' done' : '')}></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

function Convert({ data }) {
  const [step, setStep] = useCv(0);
  const [file, setFile] = useCv(null);
  const [drag, setDrag] = useCv(false);
  const [rows, setRows] = useCv(data.MAPPING);
  const [pct, setPct] = useCv(0);
  const [phase, setPhase] = useCv('idle'); // idle | running | done
  const timer = useCvRef(null);

  const pick = () => setFile(data.SAMPLE_FILE);
  const change = (i, val) => setRows(rows.map((r, idx) => idx === i ? { ...r, odoo: val, status: val.startsWith('—') ? 'error' : 'ok' } : r));

  const runConvert = () => {
    setStep(2); setPhase('running'); setPct(0);
    let p = 0;
    timer.current = setInterval(() => {
      p += Math.round(7 + Math.random() * 12);
      if (p >= 100) { p = 100; clearInterval(timer.current); setTimeout(() => { setPhase('done'); setStep(3); }, 600); }
      setPct(p);
    }, 220);
  };
  useCvEffect(() => () => clearInterval(timer.current), []);

  const reset = () => { setStep(0); setFile(null); setPhase('idle'); setPct(0); setRows(data.MAPPING); };

  // Génère un vrai fichier CSV téléchargeable (séparateur point-virgule, UTF-8 avec BOM)
  const downloadCsv = () => {
    const headers = ['name', 'child_ids/name', 'function', 'email', 'city'];
    const esc = (v) => {
      const s = (v == null || v === '—') ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.join(';')];
    data.PREVIEW.forEach(p => lines.push([p.name, p.contact, p.function, p.email, p.city].map(esc).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contacts_odoo_2042.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const okCount = rows.filter(r => r.status === 'ok').length;
  const mappedRequired = rows.filter(r => r.required).every(r => r.status === 'ok');

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Nouvelle conversion</div>
          <div className="page-sub">Transformez un export Pharow en fichier prêt à importer dans Odoo</div>
        </div>
        {step > 0 && phase !== 'running' && <Btn variant="ghost" icon="x" onClick={reset}>Recommencer</Btn>}
      </div>

      <Stepper step={step} />

      {/* STEP 0 — Import */}
      {step === 0 && (
        <Card>
          {!file ? (
            <div className={'dropzone' + (drag ? ' drag' : '')}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); pick(); }}
              onClick={pick}>
              <div className="dz-ico"><Icon name="uploadCloud" size={30} /></div>
              <div className="dz-title">Déposez votre export Pharow ici</div>
              <div className="dz-sub">ou cliquez pour parcourir vos fichiers · 5 000 lignes max par fichier</div>
              <div className="dz-formats">
                <span className="fmt-tag">.xlsx</span><span className="fmt-tag">.xls</span><span className="fmt-tag">.csv</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="file-card">
                <div className="file-ico"><Icon name="sheet" size={24} /></div>
                <div style={{ flex: 1 }}>
                  <div className="file-name">{file.name}</div>
                  <div className="file-meta">{file.size} · {file.rows.toLocaleString('fr-FR')} lignes · {file.columns.length} colonnes détectées</div>
                </div>
                <Badge status="success" label="Lu avec succès" />
              </div>
              <div className="nav-section" style={{ padding: '20px 0 0' }}>Colonnes détectées dans le fichier</div>
              <div className="col-chips">
                {file.columns.map((c, i) => <span className="col-chip" key={c}><span className="i">{String.fromCharCode(65 + i)}</span>{c}</span>)}
              </div>
              <div className="row" style={{ marginTop: 24, justifyContent: 'flex-end', gap: 10 }}>
                <Btn variant="ghost" onClick={() => setFile(null)}>Choisir un autre fichier</Btn>
                <Btn icon="arrowRight" onClick={() => setStep(1)}>Continuer vers le mapping</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* STEP 1 — Mapping */}
      {step === 1 && (
        <div>
          <Card pad={false}>
            <div className="cmap-row" style={{ borderBottom: '1px solid var(--line)', padding: '12px 16px' }}>
              <div className="nav-section" style={{ padding: 0 }}>Colonne Pharow</div>
              <div></div>
              <div className="nav-section" style={{ padding: 0 }}>Champ Odoo</div>
              <div className="nav-section" style={{ padding: 0 }}>Exemple</div>
              <div className="nav-section" style={{ padding: 0, textAlign: 'right' }}>Statut</div>
            </div>
            {rows.map((r, i) => (
              <div className="cmap-row" key={r.col}>
                <div className="cmap-col">{r.col}{r.required && <span className="req-star">*</span>}<div className="t">{r.type}</div></div>
                <div className="map-arrow"><Icon name="arrowRight" size={16} /></div>
                <div className="select">
                  <select value={r.odoo} className={r.status === 'error' ? 'err' : ''} onChange={e => change(i, e.target.value)}>
                    {data.ODOO_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <span className="chev"><Icon name="chevronDown" size={15} /></span>
                </div>
                <div className="cmap-sample">{r.sample}</div>
                <div style={{ textAlign: 'right' }}>
                  <Badge status={r.status} label={r.status === 'ok' ? 'Mappé' : r.status === 'warn' ? 'À vérifier' : 'Ignoré'} />
                </div>
              </div>
            ))}
          </Card>
          <div className="row" style={{ marginTop: 18, gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              <b style={{ color: 'var(--ink-2)' }}>{okCount}/{rows.length}</b> colonnes mappées · les champs <span className="req-star">*</span> sont requis pour Odoo
            </div>
            <div className="spacer"></div>
            <Btn variant="ghost" onClick={() => setStep(0)}>Retour</Btn>
            <Btn icon="convert" onClick={runConvert} style={mappedRequired ? {} : { opacity: .5, pointerEvents: 'none' }}>Convertir {data.SAMPLE_FILE.rows.toLocaleString('fr-FR')} lignes</Btn>
          </div>
        </div>
      )}

      {/* STEP 2 — Converting */}
      {step === 2 && (
        <Card>
          <div className="convert-stage">
            <div className="cv-spin"></div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.3px' }}>Conversion en cours…</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6 }}>Nettoyage, dédoublonnage et mise au format Odoo</div>
            <div className="sync-prog" style={{ maxWidth: 360, margin: '24px auto 0', background: 'var(--line)' }}>
              <div className="fill" style={{ width: pct + '%' }}></div>
            </div>
            <div style={{ marginTop: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
          </div>
        </Card>
      )}

      {/* STEP 3 — Download */}
      {step === 3 && (
        <Card>
          <div style={{ textAlign: 'center' }}>
            <div className="cv-ring"><Icon name="check" size={36} stroke={3} /></div>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.4px' }}>Conversion terminée</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6 }}>Votre fichier est prêt à être importé dans Odoo (modèle res.partner)</div>
          </div>

          <div className="result-grid">
            <div className="result-stat"><div className="n">{data.SAMPLE_FILE.rows.toLocaleString('fr-FR')}</div><div className="l">Lignes lues</div></div>
            <div className="result-stat"><div className="n green">1 187</div><div className="l">Contacts générés</div></div>
            <div className="result-stat"><div className="n">41</div><div className="l">Doublons fusionnés</div></div>
            <div className="result-stat"><div className="n amber">12</div><div className="l">Lignes ignorées</div></div>
          </div>

          <div className="dl-banner">
            <div className="fi"><Icon name="fileCheck" size={22} /></div>
            <div style={{ flex: 1 }}>
              <div className="dl-name">contacts_odoo_2042.csv</div>
              <div className="dl-sub">CSV · séparateur point-virgule · UTF-8 · compatible import Odoo</div>
            </div>
            <Btn icon="download" onClick={downloadCsv}>Télécharger le CSV</Btn>
          </div>

          <div className="nav-section" style={{ padding: '24px 0 10px' }}>Aperçu du fichier généré</div>
          <Card pad={false} className="tbl-wrap" style={{ boxShadow: 'none' }}>
            <table className="tbl">
              <thead><tr><th style={{ paddingLeft: 16 }}>Société</th><th>Contact</th><th>Fonction</th><th>E-mail</th><th>Ville</th><th></th></tr></thead>
              <tbody>
                {data.PREVIEW.map((p, i) => (
                  <tr key={i}>
                    <td className="strong" style={{ paddingLeft: 16 }}>{p.name}</td>
                    <td>{p.contact}</td>
                    <td>{p.function}</td>
                    <td className={p.email === '—' ? '' : 'mono'} style={p.email === '—' ? { color: 'var(--amber)' } : {}}>{p.email}</td>
                    <td>{p.city}</td>
                    <td style={{ textAlign: 'right', paddingRight: 16 }}>
                      {p.flag === 'ok' && <span className="flag-pill ok"><Icon name="check" size={11} stroke={3} />OK</span>}
                      {p.flag === 'dedup' && <span className="flag-pill dedup"><Icon name="merge" size={11} />Fusionné</span>}
                      {p.flag === 'warn' && <span className="flag-pill warn"><Icon name="alert" size={11} />E-mail manquant</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="row" style={{ marginTop: 20, justifyContent: 'center' }}>
            <Btn variant="ghost" icon="convert" onClick={reset}>Convertir un autre fichier</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { Convert });

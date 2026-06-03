// Modèles de mapping, Historique, Paramètres
const { useState: useV2 } = React;

function Mapping({ data }) {
  const [rows, setRows] = useV2(data.MAPPING);
  const [dirty, setDirty] = useV2(false);
  const [saved, setSaved] = useV2(false);
  const [tpl, setTpl] = useV2('tpl-contacts');

  const change = (i, val) => {
    setRows(rows.map((r, idx) => idx === i ? { ...r, odoo: val, status: val.startsWith('—') ? 'error' : 'ok' } : r));
    setDirty(true); setSaved(false);
  };
  const okCount = rows.filter(r => r.status === 'ok').length;

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Modèles de mapping</div>
          <div className="page-sub">Définissez comment les colonnes Pharow se transforment en champs Odoo · réutilisé à chaque conversion</div>
        </div>
        <div className="row">
          <Btn variant="ghost" onClick={() => { setRows(data.MAPPING); setDirty(false); setSaved(false); }}>Réinitialiser</Btn>
          <Btn icon="save" onClick={() => { setDirty(false); setSaved(true); }} style={dirty ? {} : { opacity: .55 }}>
            {saved ? 'Modèle enregistré' : 'Enregistrer le modèle'}
          </Btn>
        </div>
      </div>

      <div className="toolbar">
        {data.TEMPLATES.map(t => (
          <button key={t.id} className={'chip' + (tpl === t.id ? ' active' : '')} onClick={() => setTpl(t.id)}>
            <Icon name="map" size={14} />{t.name}
          </button>
        ))}
      </div>

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
      <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-3)' }}>
        <b style={{ color: 'var(--ink-2)' }}>{okCount}/{rows.length}</b> colonnes mappées · <span className="req-star">*</span> champ obligatoire pour la création d'un contact Odoo.
      </div>
    </div>
  );
}

function History({ data }) {
  const [filter, setFilter] = useV2('all');
  const filters = [{ id: 'all', l: 'Tout' }, { id: 'success', l: 'Réussi' }, { id: 'partial', l: 'Partiel' }, { id: 'error', l: 'Échec' }];
  const rows = filter === 'all' ? data.HISTORY : data.HISTORY.filter(r => r.status === filter);

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Historique des conversions</div>
          <div className="page-sub">Toutes vos conversions · re-téléchargez un fichier généré à tout moment</div>
        </div>
      </div>

      <div className="toolbar">
        {filters.map(f => <button key={f.id} className={'chip' + (filter === f.id ? ' active' : '')} onClick={() => setFilter(f.id)}>{f.l}</button>)}
      </div>

      <Card pad={false} className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ paddingLeft: 22 }}>Réf.</th>
              <th>Fichier source</th>
              <th>Date</th>
              <th>Lignes</th>
              <th>Contacts</th>
              <th>Erreurs</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="mono strong" style={{ paddingLeft: 22 }}>{r.id}</td>
                <td className="strong">{r.file}</td>
                <td>{r.date}</td>
                <td>{r.rows.toLocaleString('fr-FR')}</td>
                <td className="strong">{r.contacts ? r.contacts.toLocaleString('fr-FR') : '—'}</td>
                <td style={r.err ? { color: 'var(--red)', fontWeight: 600 } : {}}>{r.err || '—'}</td>
                <td><Badge status={r.status} /></td>
                <td style={{ textAlign: 'right', paddingRight: 22 }}>
                  {r.output
                    ? <span className="cell-link"><Icon name="download" size={14} />Télécharger</span>
                    : <span className="cell-link" style={{ color: 'var(--ink-3)' }}><Icon name="convert" size={14} />Relancer</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Settings({ data }) {
  const [tog, setTog] = useV2({ dedup: true, utf8: true, header: true, split: false });
  const flip = k => setTog(s => ({ ...s, [k]: !s[k] }));
  const Toggle = ({ k }) => <button className={'toggle' + (tog[k] ? ' on' : '')} onClick={() => flip(k)}><span className="knob"></span></button>;

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Paramètres</div>
          <div className="page-sub">Règles de conversion et format du fichier de sortie</div>
        </div>
      </div>

      <div className="set-grid">
        <Card>
          <div className="sec-title" style={{ marginBottom: 6 }}>Règles de conversion</div>
          <div className="set-row">
            <div><div className="set-label">Dédoublonnage par e-mail</div><div className="set-desc">Fusionner les lignes ayant le même e-mail professionnel</div></div>
            <Toggle k="dedup" />
          </div>
          <div className="set-row">
            <div><div className="set-label">Encodage UTF-8</div><div className="set-desc">Recommandé pour les accents et caractères spéciaux dans Odoo</div></div>
            <Toggle k="utf8" />
          </div>
          <div className="set-row">
            <div><div className="set-label">Ligne d'en-tête</div><div className="set-desc">Inclure les noms de champs Odoo en première ligne</div></div>
            <Toggle k="header" />
          </div>
          <div className="set-row">
            <div><div className="set-label">Découper les gros fichiers</div><div className="set-desc">Générer un fichier par tranche de 2 000 contacts</div></div>
            <Toggle k="split" />
          </div>
        </Card>

        <Card>
          <div className="sec-title" style={{ marginBottom: 8 }}>Format de sortie</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--red)', background: 'var(--red-soft)' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--red)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)' }}></span>
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>CSV (.csv)</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Séparateur point-virgule · UTF-8 · compatible import Odoo</span>
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="info" size={15} style={{ color: 'var(--ink-3)', flexShrink: 0, marginTop: 1 }} />
            Toutes les conversions sont générées au format CSV. C'est le format attendu par l'import standard d'Odoo.
          </div>
          <div className="sec-title" style={{ margin: '22px 0 10px' }}>Modèle Odoo cible</div>
          <div className="select" style={{ maxWidth: '100%' }}>
            <select defaultValue="tpl-contacts" style={{ fontFamily: 'var(--font)' }}>
              {data.TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <span className="chev"><Icon name="chevronDown" size={15} /></span>
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { Mapping, History, Settings });

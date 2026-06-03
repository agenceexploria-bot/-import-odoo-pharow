// Accueil — vue d'ensemble des conversions
function Dashboard({ data, onNew }) {
  const max = Math.max(...data.ACTIVITY.map(d => d.records));
  const total = data.ACTIVITY.reduce((s, d) => s + d.records, 0);
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const recent = data.HISTORY.slice(0, 4);

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="page-title">Accueil</div>
          <div className="page-sub">Conversions Pharow → Odoo · activité des 30 derniers jours</div>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-card" style={{ marginBottom: 22 }}>
        <div className="cta-ico"><Icon name="convert" size={28} /></div>
        <div style={{ flex: 1 }}>
          <div className="cta-title">Convertir un export Pharow</div>
          <div className="cta-sub">Importez votre fichier Excel ou CSV, vérifiez le mapping des colonnes, et récupérez un fichier prêt à importer dans Odoo.</div>
        </div>
        <Btn icon="upload" onClick={onNew}>Nouvelle conversion</Btn>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {data.KPIS.map(k => (
          <Card key={k.id} className="kpi">
            <div className="kpi-top">
              <div className={'kpi-ico' + (k.id === 'errors' ? ' danger' : '')}><Icon name={k.icon} size={20} /></div>
              <span className={'delta ' + (k.deltaDir === 'up' ? 'up' : 'down')}>
                <Icon name="arrowRight" size={11} style={{ transform: 'rotate(-45deg)' }} />{k.delta}
              </span>
            </div>
            <div>
              <div className="kpi-val">{k.value.toLocaleString('fr-FR')}</div>
              <div className="kpi-label" style={{ marginTop: 8 }}>{k.label}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid-2-1">
        <Card>
          <div className="sec-head">
            <div className="sec-title">Contacts générés<span className="muted">{total.toLocaleString('fr-FR')} sur 30 jours</span></div>
            <div className="chart-legend">
              <span><span className="legend-dot" style={{ background: '#1A1A1A' }}></span>Sans erreur</span>
              <span><span className="legend-dot" style={{ background: '#E2001A' }}></span>Avec lignes ignorées</span>
            </div>
          </div>
          <div className="chart">
            {data.ACTIVITY.map((d, i) => {
              const h = Math.max(4, (d.records / max) * 100);
              const dd = d.date.getDate();
              return (
                <div className="bar-col" key={i}>
                  <div className="bar-tip"><b>{dd} {months[d.date.getMonth()]}</b> · {d.records} contacts{d.errors ? ` · ${d.errors} ignorés` : ''}</div>
                  <div className={'bar' + (d.errors > 0 ? ' has-err' : '')} style={{ height: h + '%' }}></div>
                  {i % 3 === 0 && <div className="bar-x">{dd}</div>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="sec-head"><div className="sec-title">Conversions récentes</div></div>
          <div className="feed">
            {recent.map(c => {
              const t = c.status === 'success' ? 'success' : c.status === 'partial' ? 'partial' : 'error';
              return (
                <div className="feed-item" key={c.id}>
                  <div className={'feed-ico ' + t}>
                    <Icon name={t === 'success' ? 'fileCheck' : t === 'partial' ? 'alert' : 'x'} size={16} stroke={2.2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="feed-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.file}</div>
                    <div className="feed-detail">{c.status === 'error' ? `${c.err} lignes en erreur` : `${c.contacts.toLocaleString('fr-FR')} contacts · ${c.dup} fusionnés`}</div>
                    <div className="feed-meta"><b>{c.id}</b> · {c.date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });

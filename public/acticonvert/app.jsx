// Acticonvert — main app shell
const { useState: useAppState, useEffect: useAppEffect, useRef } = React;

function Header({ onNew }) {
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-mark"><span className="a">A</span><span className="w">W</span></div>
        <div className="logo-word"><span className="acti">Acti</span><span className="conv">convert</span></div>
      </div>
      <div className="search">
        <span className="search-ico"><Icon name="search" size={18} stroke={2.4} /></span>
        <input placeholder="Rechercher une conversion, un fichier…" />
      </div>
      <div className="conn-group">
        <div className="conn"><Icon name="map" size={15} style={{ color: 'var(--red)' }} /><b>Modèle : Contacts Odoo</b></div>
        <div className="header-divider"></div>
        <button className="icon-btn"><Icon name="bell" size={18} /><span className="ping"></span></button>
        <Btn icon="upload" onClick={onNew}>Nouvelle conversion</Btn>
        <div className="avatar">CN</div>
      </div>
    </header>
  );
}

function Sidebar({ data, active, setActive }) {
  return (
    <nav className="sidebar">
      <div className="nav-section">Navigation</div>
      {data.NAV.map(n => (
        <button key={n.id} className={'nav-item' + (active === n.id ? ' active' : '')} onClick={() => setActive(n.id)}>
          <span className="nav-ico"><Icon name={n.icon} size={19} /></span>
          {n.label}
          {n.badge && <span className="nav-badge">{n.badge}</span>}
        </button>
      ))}
      <div className="sidebar-foot">
        <div className="sched">
          <span className="clock"><Icon name="info" size={16} /></span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Limite par fichier</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>5 000 lignes · .xlsx .csv</div>
          </div>
        </div>
      </div>
    </nav>
  );
}

const TWEAK_DEFAULTS = {
  "accent": "#E2001A",
  "font": "Poppins",
  "radius": 14,
  "density": "regular"
};

function darken(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.round(r * (1 - amt))); g = Math.max(0, Math.round(g * (1 - amt))); b = Math.max(0, Math.round(b * (1 - amt)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function softTint(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * 0.9);
  return '#' + ((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1);
}

function App() {
  const data = window.AC_DATA;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [active, setActive] = useAppState('home');

  useAppEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--red', t.accent);
    r.setProperty('--red-dark', darken(t.accent, 0.18));
    r.setProperty('--red-soft', softTint(t.accent));
    r.setProperty('--radius', t.radius + 'px');
    r.setProperty('--font', `'${t.font}', system-ui, sans-serif`);
    const dens = t.density === 'compact' ? '56px' : t.density === 'comfy' ? '76px' : '64px';
    r.setProperty('--header-h', dens);
  }, [t]);

  const goNew = () => setActive('convert');

  const Views = { home: Dashboard, convert: Convert, mapping: Mapping, history: History, settings: Settings };
  const Current = Views[active];

  return (
    <div className="app">
      <Header onNew={goNew} />
      <Sidebar data={data} active={active} setActive={setActive} />
      <main className="main">
        <div className="main-inner">
          <Current data={data} onNew={goNew} />
        </div>
      </main>

      <TweaksPanel>
        <TweakSection label="Identité" />
        <TweakColor label="Couleur d'accent" value={t.accent}
          options={['#E2001A', '#C8102E', '#D62027', '#1A1A1A', '#714B67']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSelect label="Typographie" value={t.font}
          options={['Poppins', 'Montserrat', 'Manrope', 'Outfit']}
          onChange={(v) => setTweak('font', v)} />
        <TweakSection label="Mise en page" />
        <TweakSlider label="Arrondi des cartes" value={t.radius} min={4} max={22} unit="px"
          onChange={(v) => setTweak('radius', v)} />
        <TweakRadio label="Densité" value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

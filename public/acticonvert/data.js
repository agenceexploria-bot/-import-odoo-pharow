// Mock data for Acti Convert — Pharow Excel → Odoo import file
(function () {
  // KPIs reframed around file conversion
  const KPIS = [
    { id: 'files', label: 'Fichiers convertis', value: 38, delta: '+6', deltaDir: 'up', sub: 'ce mois-ci', icon: 'file' },
    { id: 'contacts', label: 'Contacts générés', value: 6240, delta: '+842', deltaDir: 'up', sub: 'lignes exportées', icon: 'userCheck' },
    { id: 'dedup', label: 'Doublons fusionnés', value: 412, delta: '+57', deltaDir: 'up', sub: 'nettoyage auto', icon: 'merge' },
    { id: 'errors', label: 'Lignes en erreur', value: 23, delta: '-4', deltaDir: 'up', sub: 'à corriger', icon: 'alert' },
  ];

  // Contacts produced per day, 30 days
  const ACTIVITY = (function () {
    const out = [];
    const base = new Date(2026, 4, 4);
    let seed = 71;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      const recs = weekend ? Math.round(rand() * 40) : Math.round(80 + rand() * 280);
      const errs = rand() > 0.82 ? Math.round(rand() * 7) : 0;
      out.push({ date: d, records: recs, errors: errs });
    }
    return out;
  })();

  // Pharow Excel column headers (what you actually find in the export)
  const SAMPLE_FILE = {
    name: 'pharow_export_decideurs_saas_fr.xlsx',
    size: '486 Ko',
    rows: 1240,
    columns: ['Société', 'Prénom', 'Nom', 'Intitulé de poste', 'Email pro', 'Téléphone', 'Profil LinkedIn', 'Effectif', 'Secteur', 'Ville', 'Pays', 'SIRET', 'Source'],
  };

  // Mapping = Excel column (Pharow) -> Odoo import field (res.partner)
  const MAPPING = [
    { col: 'Société', odoo: 'name (société)', type: 'Texte', status: 'ok', required: true, sample: 'Nexora SAS' },
    { col: 'Prénom + Nom', odoo: 'child_ids/name', type: 'Texte', status: 'ok', required: true, sample: 'Julie Martin' },
    { col: 'Intitulé de poste', odoo: 'function', type: 'Texte', status: 'ok', required: false, sample: 'Directrice SI' },
    { col: 'Email pro', odoo: 'email', type: 'E-mail', status: 'ok', required: true, sample: 'j.martin@nexora.fr' },
    { col: 'Téléphone', odoo: 'phone', type: 'Téléphone', status: 'ok', required: false, sample: '+33 1 84 80 …' },
    { col: 'Profil LinkedIn', odoo: 'x_linkedin', type: 'URL', status: 'warn', required: false, sample: 'linkedin.com/in/…' },
    { col: 'Effectif', odoo: 'x_headcount', type: 'Nombre', status: 'ok', required: false, sample: '250' },
    { col: 'Secteur', odoo: 'industry_id', type: 'Liste', status: 'ok', required: false, sample: 'Logiciels' },
    { col: 'Ville', odoo: 'city', type: 'Texte', status: 'ok', required: false, sample: 'Lyon' },
    { col: 'Pays', odoo: 'country_id', type: 'Liste', status: 'ok', required: false, sample: 'France' },
    { col: 'SIRET', odoo: '— (ignoré)', type: 'Texte', status: 'error', required: false, sample: '844 217 002 00018' },
    { col: 'Source', odoo: 'source_id', type: 'Liste', status: 'ok', required: false, sample: 'Pharow' },
  ];

  const ODOO_FIELDS = ['name (société)', 'child_ids/name', 'function', 'email', 'phone', 'mobile', 'x_linkedin', 'x_headcount', 'industry_id', 'city', 'country_id', 'zip', 'street', 'website', 'source_id', 'category_id', 'comment', '— (ignoré)'];

  // Preview rows after conversion (Odoo-ready)
  const PREVIEW = [
    { name: 'Nexora SAS', contact: 'Julie Martin', function: 'Directrice SI', email: 'j.martin@nexora.fr', city: 'Lyon', flag: 'ok' },
    { name: 'Voltige Industries', contact: 'Karim Benali', function: 'Resp. Achats', email: 'k.benali@voltige.com', city: 'Lille', flag: 'ok' },
    { name: 'Brioche & Co', contact: 'Émilie Roux', function: 'DG', email: 'e.roux@brioche.fr', city: 'Nantes', flag: 'dedup' },
    { name: 'Atlas Logistics', contact: 'Thomas Petit', function: 'DSI', email: '—', city: 'Le Havre', flag: 'warn' },
    { name: 'Pixel Forge', contact: 'Sarah Lambert', function: 'CTO', email: 's.lambert@pixelforge.io', city: 'Toulouse', flag: 'ok' },
  ];

  // Past conversion jobs
  const HISTORY = [
    { id: 'CV-2041', file: 'decideurs_saas_fr.xlsx', date: '03/06/2026 09:14', rows: 1240, contacts: 1187, dup: 41, err: 12, status: 'success', output: 'contacts_odoo_2041.csv' },
    { id: 'CV-2038', file: 'tech_fr_serie_b.xlsx', date: '02/06/2026 16:42', rows: 318, contacts: 311, dup: 3, err: 4, status: 'partial', output: 'contacts_odoo_2038.csv' },
    { id: 'CV-2035', file: 'retail_ecommerce_eu.csv', date: '30/05/2026 11:20', rows: 905, contacts: 878, dup: 27, err: 0, status: 'success', output: 'contacts_odoo_2035.csv' },
    { id: 'CV-2031', file: 'dsi_industrie_grand_est.xlsx', date: '29/05/2026 14:05', rows: 642, contacts: 0, dup: 0, err: 642, status: 'error', output: null },
    { id: 'CV-2028', file: 'logistique_benelux.xlsx', date: '28/05/2026 10:31', rows: 421, contacts: 409, dup: 12, err: 0, status: 'success', output: 'contacts_odoo_2028.csv' },
    { id: 'CV-2024', file: 'fintech_dach.csv', date: '26/05/2026 17:48', rows: 530, contacts: 502, dup: 19, err: 9, status: 'partial', output: 'contacts_odoo_2024.csv' },
  ];

  const TEMPLATES = [
    { id: 'tpl-contacts', name: 'Contacts Odoo (res.partner)', desc: 'Société + contact, e-mail, téléphone, secteur', fields: 12, active: true },
    { id: 'tpl-leads', name: 'Pistes CRM (crm.lead)', desc: 'Opportunités avec source et équipe commerciale', fields: 9, active: false },
    { id: 'tpl-companies', name: 'Sociétés seules (res.partner is_company)', desc: 'Comptes sans contact nominatif', fields: 7, active: false },
  ];

  const NAV = [
    { id: 'home', label: 'Accueil', icon: 'grid' },
    { id: 'convert', label: 'Nouvelle conversion', icon: 'convert' },
    { id: 'mapping', label: 'Modèles de mapping', icon: 'map' },
    { id: 'history', label: 'Historique', icon: 'clock' },
    { id: 'settings', label: 'Paramètres', icon: 'gear' },
  ];

  window.AC_DATA = { KPIS, ACTIVITY, SAMPLE_FILE, MAPPING, ODOO_FIELDS, PREVIEW, HISTORY, TEMPLATES, NAV };
})();

const fs = require('fs');
const dir = 'data/';
const load = f => JSON.parse(fs.readFileSync(dir + f, 'utf8'));

const invoices = load('_invoices_full.json');             // toutes les factures (émises + prévues)
const allProp = load('_live_proposals.json').data;        // all proposals
const projects = load('_live_projects.json').data;        // projects
const am = load('_am_map.json');                          // project_id -> Achats Médias €
const propMargin = load('_prop_margin_map.json');         // proposal_id -> { sell, cost, media }

// --- FY 2025/2026 : 01/07/2026 -> 30/06/2027
const FY_START = new Date('2025-07-01');
const FY_END = new Date('2026-06-30');
const MONTHS = [];
for (let i = 0; i < 12; i++) {
  const d = new Date(2025, 6 + i, 1); // juillet 2026 = mois index 6
  MONTHS.push({ y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }) });
}
function monthIndex(date) {
  if (!date || isNaN(date)) return -1;
  if (date < FY_START || date > FY_END) return -1;
  return (date.getFullYear() - 2025) * 12 + date.getMonth() - 6;
}
function parseDMY(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
function parseYMD(s) {
  if (!s || s === '0000-00-00' || typeof s !== 'string') return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// --- Référentiels
const projById = {};
projects.forEach(p => { projById[String(p.id)] = p; });

const RECIP = ['SPORTPACK', 'SPK MEDIAS', 'SPK ACTIVATE', 'SPK STUDIO', 'SPK GROUP'];
function isRecip(name) {
  const n = (name || '').toUpperCase().trim();
  return RECIP.some(r => n === r || n.startsWith(r));
}
function isInternal(proj) {
  if (!proj) return false;
  const t = (proj.title || '').toUpperCase();
  const tl = (proj.type_label || '').toLowerCase();
  return t.startsWith('INTERNE') || tl.includes('interne') || proj.is_internal == 1;
}
// facteur retraitement Achats Médias : caNet / caBrut par projet
function amFactor(projectId) {
  const proj = projById[String(projectId)];
  if (!proj) return 1;
  const brut = Number(proj.total_amount) || 0;
  const amEur = Number(am[String(projectId)]) || 0;
  if (brut <= 0) return 1;
  return Math.max(0, (brut - amEur)) / brut;
}

// --- Marge brute : MB% par client (historique projets, méthode v4) + global en repli
function projCaNet(p) {
  const brut = Number(p.total_amount) || 0;
  const amEur = Number(am[String(p.id)]) || 0;
  return Math.max(0, brut - amEur);
}
const mbByClient = {};                 // companyKey -> { margin, caNet }
const mbGlobal = { margin: 0, caNet: 0 };
projects.forEach(p => {
  const t = (p.title || '').toUpperCase();
  if (t.startsWith('SPK0101')) return;
  if (isInternal(p) || t.startsWith('INTERNE')) return;
  if (isRecip(p.company_name)) return;
  const caNet = projCaNet(p);
  if (caNet <= 0) return;
  const margin = Number(p.margin) || 0;
  const key = (p.company_name || '—').toUpperCase().trim();
  if (!mbByClient[key]) mbByClient[key] = { margin: 0, caNet: 0 };
  mbByClient[key].margin += margin; mbByClient[key].caNet += caNet;
  mbGlobal.margin += margin; mbGlobal.caNet += caNet;
});
const GLOBAL_MB = mbGlobal.caNet > 0 ? mbGlobal.margin / mbGlobal.caNet : 0.54;
function clientMB(company) {
  const e = mbByClient[(company || '—').toUpperCase().trim()];
  if (e && e.caNet > 0) return { pct: e.margin / e.caNet, src: 'client' };
  return { pct: GLOBAL_MB, src: 'global' };
}
// MB% RÉELLE d'un devis : (vente - achat) / vente sur ses lignes de chiffrage Furious.
// Repli sur le MB% historique client si le devis n'a pas de lignes chiffrées.
function devisMB(proposalId, company) {
  const e = propMargin[String(proposalId)];
  if (e && e.sell > 0) return { pct: (e.sell - e.cost) / e.sell, src: 'devis' };
  return clientMB(company);
}

const perim = { recip: 0, spk0101: 0, internal: 0, nbFactures: 0, amRetr: 0 };

// date effective d'une facture : invoice_date si saisie, sinon issue_date (factures prévues statut 0)
function effDate(inv) {
  const d1 = parseYMD(inv.invoice_date);
  if (d1) return d1;
  return parseYMD(inv.issue_date);
}

// =================== ONGLET 1 — PROJETS SIGNÉS ===================
// Source : factures Furious (émises + prévues statut 0), placées au mois de leur date prévue.
const o1 = new Map(); // key -> {company, project, months[12], total}
const amApplied = new Set();
invoices.forEach(inv => {
  if (inv.is_cancelled == 1) return;
  const idx = monthIndex(effDate(inv));
  if (idx < 0) return; // hors exo 26/27
  const company = inv.company_name || '—';
  const title = inv.project_name || inv.project_id || '—';
  if (isRecip(company)) { perim.recip++; return; }
  if ((title || '').toUpperCase().startsWith('SPK0101')) { perim.spk0101++; return; }
  const proj = projById[String(inv.project_id)];
  if (isInternal(proj) || (title || '').toUpperCase().startsWith('INTERNE')) { perim.internal++; return; }
  const factor = amFactor(inv.project_id);
  const amt = (Number(inv.amount_ht) || 0) * factor;
  // marge brute facture = montant facturé × (margin projet / CA brut projet) — l'Achats Médias s'annule
  const brutP = Number(proj?.total_amount) || 0;
  const mbRate = brutP > 0 ? (Number(proj?.margin) || 0) / brutP : 0;
  const amtMB = (Number(inv.amount_ht) || 0) * mbRate;
  if (amt === 0 && amtMB === 0) return;
  const key = title + '||' + company;
  if (!o1.has(key)) o1.set(key, { company, project: title, nbInv: 0, months: Array(12).fill(0), total: 0, monthsMB: Array(12).fill(0), totalMB: 0 });
  const row = o1.get(key);
  row.months[idx] += amt; row.total += amt;
  row.monthsMB[idx] += amtMB; row.totalMB += amtMB;
  row.nbInv++;
  perim.nbFactures++;
  if (factor < 1) amApplied.add(String(inv.project_id));
});
perim.amRetr = amApplied.size;

// =================== ONGLET 2 — DEVIS EN COURS ===================
const EN_COURS = ['En attente Réponse client', 'Brief en attente', 'Reco En cours', 'Proactif'];
const fmtDate = d => d ? ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() : '';
const o2 = new Map();
allProp.filter(p => EN_COURS.includes(p.pipe_name)).forEach(p => {
  const company = p.company_name || '—';
  if (isRecip(company)) { perim.recip++; return; }
  const probaPct = Number(p.probability) || 0;
  if (probaPct <= 0) return;
  const factor = p.project_id ? amFactor(p.project_id) : 1;
  const ca = (Number(p.discounted_amount) || Number(p.amount) || 0) * factor;
  const caPond = ca * probaPct / 100;
  if (caPond <= 0) return;
  const start = parseYMD(p.projet_start);
  const stop = parseYMD(p.projet_stop);
  if (!start || !stop) return;                         // pas de dates -> non répartissable
  if (stop < FY_START || start > FY_END) return;       // ne touche pas l'exo 26/27
  // règle : début de projet antérieur au 30/06/2026 ramené au 01/07/2026
  const effStart = start < FY_START ? FY_START : start;
  const iStart = monthIndex(effStart);
  const iStop = monthIndex(stop);
  const months = Array(12).fill(0);
  let total = 0;
  if (iStart >= 0) { months[iStart] += caPond * 0.5; total += caPond * 0.5; }
  if (iStop >= 0) { months[iStop] += caPond * 0.5; total += caPond * 0.5; }
  if (total <= 0) return;
  // marge brute pondérée : MB% RÉELLE du devis (lignes Furious vente-achat), repli client/global
  const mb = devisMB(p.id, company);
  const monthsMB = months.map(v => v * mb.pct);
  const caPondMB = caPond * mb.pct;
  const key = (p.title || p.id) + '||' + company + '||' + p.id;
  o2.set(key, {
    company, project: p.title || String(p.id),
    statut: p.pipe_name, ca, proba: probaPct, caPond,
    start: fmtDate(start), stop: fmtDate(stop),
    months, total,
    mbPct: mb.pct * 100, mbSource: mb.src, caPondMB,
    monthsMB, totalMB: total * mb.pct,
  });
});

const out = {
  fy: '2025-2026',
  months: MONTHS.map(m => m.label),
  generatedAt: new Date().toISOString(),
  mbGlobalPct: GLOBAL_MB * 100,
  onglet1: [...o1.values()].sort((a, b) => b.total - a.total),
  onglet2: [...o2.values()].sort((a, b) => b.total - a.total),
  perimetre: perim,
};
fs.writeFileSync(dir + '_previ_data_2526.json', JSON.stringify(out, null, 1));

// --- Diagnostic
const sum = arr => arr.reduce((s, r) => s + r.total, 0);
const sumMB = arr => arr.reduce((s, r) => s + (r.totalMB || 0), 0);
console.log('=== DIAGNOSTIC PRÉVI FY 2025/2026 ===');
console.log('Onglet 1 (signés)      : ' + out.onglet1.length + ' projets, CA ' + Math.round(sum(out.onglet1)).toLocaleString('fr-FR') + ' € | MB ' + Math.round(sumMB(out.onglet1)).toLocaleString('fr-FR') + ' €');
console.log('Onglet 2 (devis pond.) : ' + out.onglet2.length + ' devis, CA ' + Math.round(sum(out.onglet2)).toLocaleString('fr-FR') + ' € | MB ' + Math.round(sumMB(out.onglet2)).toLocaleString('fr-FR') + ' €');
console.log('MB% global (repli devis): ' + (GLOBAL_MB * 100).toFixed(1) + ' %');
console.log('Périmètre exclu/retraité:', JSON.stringify(perim));
console.log('\nMois     | Signés CA    | Signés MB    | Devis CA     | Devis MB');
MONTHS.forEach((m, i) => {
  const s1 = out.onglet1.reduce((s, r) => s + r.months[i], 0);
  const s1mb = out.onglet1.reduce((s, r) => s + (r.monthsMB ? r.monthsMB[i] : 0), 0);
  const s2 = out.onglet2.reduce((s, r) => s + r.months[i], 0);
  const s2mb = out.onglet2.reduce((s, r) => s + (r.monthsMB ? r.monthsMB[i] : 0), 0);
  console.log(m.label.padEnd(8) + ' | ' + Math.round(s1).toLocaleString('fr-FR').padStart(11) + ' | ' + Math.round(s1mb).toLocaleString('fr-FR').padStart(11) + ' | ' + Math.round(s2).toLocaleString('fr-FR').padStart(11) + ' | ' + Math.round(s2mb).toLocaleString('fr-FR').padStart(11));
});

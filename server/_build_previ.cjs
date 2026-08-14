const fs = require('fs');
const dir = 'data/';
const load = f => JSON.parse(fs.readFileSync(dir + f, 'utf8'));

const invoices = load('_invoices_full.json');             // toutes les factures (émises + prévues)
const allProp = load('_live_proposals.json').data;        // all proposals
const projects = load('_live_projects.json').data;        // projects
const am = load('_am_map.json');                          // project_id -> Achats Médias €
const propMargin = load('_prop_margin_map.json');         // proposal_id -> { sell, cost, media }

// --- FY 2026/2027 : 01/07/2026 -> 30/06/2027
const FY_START = new Date('2026-07-01');
const FY_END = new Date('2027-06-30');
const MONTHS = [];
for (let i = 0; i < 12; i++) {
  const d = new Date(2026, 6 + i, 1); // juillet 2026 = mois index 6
  MONTHS.push({ y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }) });
}
function monthIndex(date) {
  if (!date || isNaN(date)) return -1;
  if (date < FY_START || date > FY_END) return -1;
  return (date.getFullYear() - 2026) * 12 + date.getMonth() - 6;
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
// projets/devis exclus manuellement du reporting
const EXCLUDE_PROJECTS = [
  'SPK0388',
  'SPK0425', // PUMA Hyrox WC 26 - Creators : saisie Furious incohérente (CA 1 € / MB -76 k€)
];
// Paid media pass-through : CA net retraité = marge brute (achats médias = pass-through).
// S'applique aux SIGNÉS (onglet1), DEVIS (onglet2) et à la section semaine.
const PAID_MEDIA_CA_EQ_MB = [
  'SPK0321', // LE MANS / Amplification instagram @fiawec
  'SPK0101', // LE MANS / Paid Media - Ticketing (toutes variantes)
  'SPK0372', // CNOSF / Accompagnement OP France Olympique (paid)
];
const isPaidMedia = title => PAID_MEDIA_CA_EQ_MB.some(c => (title || '').toUpperCase().includes(c));
const isExcl = t => EXCLUDE_PROJECTS.some(c => (t || '').toUpperCase().includes(c));
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
// Marge brute d'un devis = ventes − achats externes, SANS coût humain (décision Romain).
// = (CA devis − Σ achats rate-card) / CA. Repli sur le MB% historique client si pas de lignes chiffrées.
function devisMB(proposalId, company, ca) {
  const e = propMargin[String(proposalId)];
  if (e && e.sell > 0 && ca > 0) return { pct: Math.max(0, (ca - e.cost) / ca), src: 'devis' };
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
  if (isExcl(title)) return;
  const proj = projById[String(inv.project_id)];
  if (isInternal(proj) || (title || '').toUpperCase().startsWith('INTERNE')) { perim.internal++; return; }
  const factor = amFactor(inv.project_id);
  const amt = (Number(inv.amount_ht) || 0) * factor;
  // marge brute facture = montant facturé × (margin projet / CA brut projet) — l'Achats Médias s'annule
  const brutP = Number(proj?.total_amount) || 0;
  const mbRate = brutP > 0 ? (Number(proj?.margin) || 0) / brutP : 0;
  // paid media : CA net = MB (le CA reconnu par SPK = sa marge, hors achats médias pass-through)
  const amtMB = isPaidMedia(title) ? amt : (Number(inv.amount_ht) || 0) * mbRate;
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
  if (isExcl(p.title)) return;
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
  // règle : devis comptabilisé sur le MOIS DE LA DATE DE FIN du projet (plus proche de la réalité)
  const iStop = monthIndex(stop);
  const months = Array(12).fill(0);
  let total = 0;
  if (iStop >= 0) { months[iStop] += caPond; total += caPond; }
  if (total <= 0) return;
  // marge brute pondérée : MB% RÉELLE du devis (lignes Furious vente-achat), repli client/global
  const mb = devisMB(p.id, company, ca);
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

// Retraitement paid media pass-through (devis) : CA net retraité = marge brute.
[...o2.values()].forEach(r => {
  if (!isPaidMedia(r.project)) return;
  r.months = r.monthsMB.slice();
  r.total = r.totalMB;
  r.caPond = r.caPondMB;
  r.ca = r.proba > 0 ? r.caPondMB / (r.proba / 100) : r.caPondMB;
  r.mbPct = 100;
  r.mbSource = 'paid-media (CA=MB)';
});

// Dédoublonnage automatique : quand un même code projet a plusieurs devis en cours,
// on ne garde que le devis à PLUS FAIBLE PROBA (choix prudent ; variantes obsolètes écartées).
// Départage à proba égale : on garde le plus faible CA pondéré.
const codeOf = p => { const m = (p || '').match(/((?:SPK|MED|DC)\d{3,4})/i); return m ? m[1].toUpperCase() : null; };
const dupByCode = new Map();
[...o2.entries()].forEach(([key, r]) => {
  const c = codeOf(r.project); if (!c) return;
  if (!dupByCode.has(c)) dupByCode.set(c, []);
  dupByCode.get(c).push([key, r]);
});
dupByCode.forEach(grp => {
  if (grp.length < 2) return;
  grp.sort((a, b) => (a[1].proba - b[1].proba) || (a[1].caPond - b[1].caPond));
  grp.slice(1).forEach(([key]) => o2.delete(key)); // garde le 1er = plus faible proba
});

// Décodage des entités HTML (Furious renvoie &#039; &amp; &eacute; etc. dans les libellés)
const decodeHtml = s => typeof s !== 'string' ? s : s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&'); // &amp; en dernier
// Regroupement de clients (variantes d'un même nom)
const COMPANY_ALIAS = { 'INTERSPORT': 'INTERSPORT FRANCE' };
const aliasCompany = c => COMPANY_ALIAS[(c || '').trim()] || c;
const clean = r => ({ ...r, company: aliasCompany(decodeHtml(r.company)), project: decodeHtml(r.project), statut: decodeHtml(r.statut) });

// ===== Données hebdo (pour intégration au weekly reporting) =====
const pad = n => String(n).padStart(2, '0');
const ymd = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const now = new Date();
const dow = now.getDay() || 7;                       // lundi=1 … dimanche=7
// Fenêtre "semaine". Deux overrides possibles pour rattraper un weekly sauté :
//   PREVI_WEEK_START / PREVI_WEEK_END = 'AAAA-MM-JJ' -> fenêtre explicite (prioritaire)
//   PREVI_WEEKS_BACK = N             -> N semaines en arrière depuis la semaine en cours
// Sans override : semaine en cours (lundi → dimanche), comportement historique.
const WEEKS_BACK = Math.max(1, Number(process.env.PREVI_WEEKS_BACK) || 1);
const backDays = 7 * (WEEKS_BACK - 1);
const envStart = (process.env.PREVI_WEEK_START || '').trim();
const envEnd = (process.env.PREVI_WEEK_END || '').trim();
let weekStart, weekEnd;
if (envStart && envEnd) {
  weekStart = parseYMD(envStart);
  weekEnd = parseYMD(envEnd);
} else {
  weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dow - 1) - backDays);
  weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6 + backDays);
}
const wkStart = ymd(weekStart), wkEnd = ymd(weekEnd), todayYMD = ymd(now);
// nb de semaines couvertes (sert à mettre les cibles hebdo à l'échelle de la fenêtre)
const WEEK_SPAN = Math.max(1, Math.round(((weekEnd - weekStart) / 86400000 + 1) / 7));
const createdThisWeek = s => { const dd = (s || '').slice(0, 10); return dd >= wkStart && dd <= wkEnd; };

// Média vs Agence : champ Furious "Média" (cf_mdia projets / cf_mdias devis) ou code MED/M0
const MED_PACKS = new Set(['footpack', 'runpack', 'velopack', 'basketpack', 'padelpack']);
const packOfCf = cf => { const v = (cf || '').toLowerCase().trim(); return MED_PACKS.has(v) ? v : null; };
const isMediaItem = (cf, title) => MED_PACKS.has((cf || '').toLowerCase().trim()) || /\bMED\d/i.test(title || '') || /\bM\d{3,4}_/i.test(title || '');

// Projets créés cette semaine
const projectsThisWeek = projects
  .filter(p => createdThisWeek(p.created_at) && !isRecip(p.company_name) && !isInternal(p) && !isExcl(p.title))
  .map(p => {
    let ca = Number(p.total_amount) || 0;
    const cost = Number(p.total_cost) || 0;
    let mb = p.margin != null && p.margin !== '' ? Number(p.margin) : ca - cost;
    // paid media pass-through (SPK0101/SPK0321…) : CA net = CA − achats médias, et CA = MB
    if (PAID_MEDIA_CA_EQ_MB.some(c => (p.title || '').toUpperCase().includes(c))) {
      ca = ca * amFactor(p.id);
      mb = ca;
    }
    return {
      company: aliasCompany(decodeHtml(p.company_name || '—')),
      referent: decodeHtml(p.business_account || p.project_manager || '—'),
      project: decodeHtml(p.title || String(p.id)),
      ca, mb, mbPct: ca > 0 ? mb / ca * 100 : 0,
      media: isMediaItem(p.cf_mdia, p.title), pack: packOfCf(p.cf_mdia),
    };
  })
  .sort((a, b) => b.ca - a.ca);

// Devis créés cette semaine (avec MB% réelle pour CA/MB probable)
const proposalsThisWeek = allProp
  .filter(q => createdThisWeek(q.created_at) && !isRecip(q.company_name) && !isExcl(q.title))
  .map(q => {
    const ca = Number(q.discounted_amount) || Number(q.amount) || 0;
    const proba = Number(q.probability) || 0;
    const mb = devisMB(q.id, q.company_name || '', ca);
    return {
      company: aliasCompany(decodeHtml(q.company_name || '—')),
      referent: decodeHtml((q.assigned_to || '—').trim().split(/\s+/)[0] || '—'), // premier référent seulement
      project: decodeHtml(q.title || String(q.id)),
      statut: decodeHtml(q.pipe_name || ''),
      ca, proba, mbPct: mb.pct * 100,
      caProb: ca * proba / 100,
      mbProb: ca * proba / 100 * mb.pct,
      media: isMediaItem(q.cf_mdias, q.title), pack: packOfCf(q.cf_mdias),
    };
  })
  .sort((a, b) => b.caProb - a.caProb);

// Pipe courant par statut (EN_COURS, tous horizons) — avec split Média / Agence
const pipeMap = {};
allProp.filter(p => EN_COURS.includes(p.pipe_name) && !isRecip(p.company_name) && !isExcl(p.title)).forEach(p => {
  const ca = Number(p.discounted_amount) || Number(p.amount) || 0;
  const proba = Number(p.probability) || 0;
  const caPond = ca * proba / 100;
  const media = isMediaItem(p.cf_mdias, p.title);
  const o = pipeMap[p.pipe_name] = pipeMap[p.pipe_name] || { statut: p.pipe_name, n: 0, ca: 0, caPond: 0, med: { n: 0, caPond: 0 }, ag: { n: 0, caPond: 0 } };
  o.n++; o.ca += ca; o.caPond += caPond;
  const seg = media ? o.med : o.ag; seg.n++; seg.caPond += caPond;
});
const pipeArr = Object.values(pipeMap).sort((a, b) => b.ca - a.ca);
const sumSeg = key => pipeArr.reduce((t, s) => ({ n: t.n + s[key].n, caPond: t.caPond + s[key].caPond }), { n: 0, caPond: 0 });
const pipeTotal = { n: pipeArr.reduce((a, s) => a + s.n, 0), ca: pipeArr.reduce((a, s) => a + s.ca, 0), caPond: pipeArr.reduce((a, s) => a + s.caPond, 0), med: sumSeg('med'), ag: sumSeg('ag') };

// Snapshot pipe : un fichier par jour (conservé). Comparaison ciblée "semaine dernière" (J-7) :
// on prend le snapshot le plus récent qui a au moins 6 jours ; sinon le plus ancien disponible.
const snapDir = dir + '_pipe_snapshots/';
if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
const snaps = fs.readdirSync(snapDir).filter(f => /^pipe_\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(5, 15)).sort();
const target = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); // J-6
const allPrior = snaps.filter(dt => dt < todayYMD);
// préférer les snapshots portant le découpage média/agence (pour comparer S-1 aussi par filtre)
const hasSplit = dt => { try { const j = JSON.parse(fs.readFileSync(snapDir + 'pipe_' + dt + '.json', 'utf8')); return !!(j.total && j.total.med); } catch (e) { return false; } };
const prior = allPrior.filter(hasSplit).length ? allPrior.filter(hasSplit) : allPrior;
const weekOld = prior.filter(dt => dt <= target);
const prevDate = weekOld.length ? weekOld[weekOld.length - 1] : (prior.length ? prior[0] : null);
let pipePrev = null;
if (prevDate) {
  pipePrev = JSON.parse(fs.readFileSync(snapDir + 'pipe_' + prevDate + '.json', 'utf8'));
  const ageDays = Math.round((new Date(todayYMD) - new Date(prevDate)) / 86400000);
  pipePrev.ageDays = ageDays;
  pipePrev.weekly = ageDays >= 6;
}
fs.writeFileSync(snapDir + 'pipe_' + todayYMD + '.json', JSON.stringify({ date: todayYMD, byStatus: pipeArr, total: pipeTotal }, null, 1));

const weekly = {
  weekStart: wkStart, weekEnd: wkEnd,
  projectsThisWeek, proposalsThisWeek,
  pipe: { byStatus: pipeArr, total: pipeTotal },
  pipePrev,
};

// ===== Focus Médias : CA PRÉVI 26/27 par pack vs objectifs (cohérent avec le reste du rapport) =====
const MEDIA_OBJ = { footpack: 400000, runpack: 500000, basketpack: 40000, velopack: 110000, padelpack: 50000 };
const PACKS = Object.keys(MEDIA_OBJ);
const packOf = t => { const s = (t || '').toLowerCase(); return PACKS.find(p => s.includes(p)) || null; };
// Lignes média ajoutées à la main (exercice 26/27) — signées, MB = CA (accompagnement service, à ajuster)
const MEDIA_MANUAL = [
  { project: 'SPK0172_Accompagnement contrat Intersport 2026_Accompagnement Media_footpack (2/4)', company: 'INTERSPORT FRANCE', pack: 'footpack', ca: 31500 },
  { project: 'SPK0172_Accompagnement contrat Intersport 2026_Accompagnement Media_runpack (2/4)', company: 'INTERSPORT FRANCE', pack: 'runpack', ca: 12000 },
  { project: 'SPK0172_Accompagnement contrat Intersport 2026_Accompagnement footlab_runpack (2/4)', company: 'INTERSPORT FRANCE', pack: 'runpack', ca: 4200 },
  { project: 'SPK0172_Accompagnement contrat Intersport 2026_Accompagnement runlab_runpack (2/4)', company: 'INTERSPORT FRANCE', pack: 'runpack', ca: 4200 },
];
// Répartition manuelle d'un projet média sur plusieurs packs (quote-part CA & MB).
// clé = code projet (MED0206…), valeur = { pack: part } ; la somme des parts doit faire 1.
const MEDIA_SPLIT = {
  MED0206: { runpack: 0.5, velopack: 0.5 }, // JULBO VISION LAB — 50/50 run & vélo
};
// Reclassement manuel d'un projet média vers un pack (code projet -> pack).
const MEDIA_RECLASS = {
  MED0232: 'runpack', // Pack UTMB 2026 x MERRELL -> runpack (trail/running)
};
// Affiliation : revenus (Awin, Kwanko, Effinity, Adsense, Partenize…) — ce ne sont PAS des packs.
// Retirés du Focus Médias / du "à classer" (restent comptés dans le CA global comme agence).
const isAffiliation = t => /affiliation/i.test(t || '');
let mediaRows = [...o1.values()].map(r => ({ company: aliasCompany(decodeHtml(r.company)), project: decodeHtml(r.project), ca: r.total, mb: r.totalMB, type: 'Signé' }))
  .concat([...o2.values()].map(r => ({ company: aliasCompany(decodeHtml(r.company)), project: decodeHtml(r.project), ca: r.total, mb: r.totalMB, type: 'Devis' })));
MEDIA_MANUAL.forEach(m => mediaRows.push({ company: m.company, project: m.project, ca: m.ca, mb: m.ca, type: 'Signé (manuel)', manual: true, pack: m.pack }));
// éclatement des projets à cheval sur plusieurs packs
mediaRows = mediaRows.flatMap(r => {
  const code = (r.project || '').match(/\b((?:SPK|MED|DC|M)\d{3,4})/i);
  const split = code ? MEDIA_SPLIT[code[1].toUpperCase()] : null;
  if (!split) return [r];
  return Object.entries(split).map(([pack, share]) => ({
    ...r, pack, ca: r.ca * share, mb: r.mb * share,
    project: `${r.project} (${Math.round(share * 100)}% ${pack})`, split: true,
  }));
});
// Pack média = champ Furious "Média" : cf_mdia (projets) / cf_mdias (devis), via le code projet.
const PACK_SET = new Set(PACKS);
const normPack = v => { const s = (v || '').toLowerCase().trim(); return PACK_SET.has(s) ? s : null; };
const codeKey = t => { const m = (t || '').match(/\b((?:SPK|MED|DC|M)\d{3,4})/i); return m ? m[1].toUpperCase() : null; };
const cfByCode = {};
projects.forEach(p => { const c = codeKey(p.title), pk = normPack(p.cf_mdia); if (c && pk && !cfByCode[c]) cfByCode[c] = pk; });
allProp.forEach(p => { const c = codeKey(p.title), pk = normPack(p.cf_mdias); if (c && pk && !cfByCode[c]) cfByCode[c] = pk; });
const medCode = p => { const m = (p || '').match(/MED\d{3,4}/i); return m ? m[0].toUpperCase() : null; };
const packKey = r => r.pack || MEDIA_RECLASS[codeKey(r.project)] || cfByCode[codeKey(r.project)] || packOf(r.project);
const isMedRow = r => (!!packKey(r) || !!medCode(r.project)) && !isAffiliation(r.project);
const lineOf = r => ({ project: r.project, company: r.company, type: r.type, ca: r.ca, mb: r.mb });
const media = {
  fyLabel: '2026/2027', objectifTotal: Object.values(MEDIA_OBJ).reduce((a, b) => a + b, 0),
  packs: PACKS.map(p => {
    const g = mediaRows.filter(r => packKey(r) === p).sort((a, b) => b.ca - a.ca);
    const sig = g.filter(r => r.type !== 'Devis'), dev = g.filter(r => r.type === 'Devis');
    const caSig = sig.reduce((s, r) => s + r.ca, 0), caDev = dev.reduce((s, r) => s + r.ca, 0);
    const mbSig = sig.reduce((s, r) => s + r.mb, 0), mbDev = dev.reduce((s, r) => s + r.mb, 0);
    return {
      pack: p, objectif: MEDIA_OBJ[p],
      caSig, caDev, mbSig, mbDev,
      clients: new Set(g.map(r => r.company)).size, nSig: sig.length, nDev: dev.length,
      lines: g.map(lineOf),
    };
  }),
  // Lignes média (code MED) sans pack identifié — à classer manuellement
  unclassified: mediaRows.filter(r => isMedRow(r) && !packKey(r)).sort((a, b) => b.ca - a.ca).map(lineOf),
};

// Snapshot média par pack (variation hebdo) — même logique que le pipe (préférer J-6, sinon plus ancien)
const medSnapDir = dir + '_media_snapshots/';
if (!fs.existsSync(medSnapDir)) fs.mkdirSync(medSnapDir, { recursive: true });
const medCur = {};
media.packs.forEach(p => { medCur[p.pack] = { ca: p.caSig + p.caDev, caSig: p.caSig }; });
const medSnaps = fs.readdirSync(medSnapDir).filter(f => /^media_\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(6, 16)).sort();
const medPrior = medSnaps.filter(dt => dt < todayYMD);
const medWeekOld = medPrior.filter(dt => dt <= target);
const medPrevDate = medWeekOld.length ? medWeekOld[medWeekOld.length - 1] : (medPrior.length ? medPrior[0] : null);
let medPrev = null;
if (medPrevDate) { const j = JSON.parse(fs.readFileSync(medSnapDir + 'media_' + medPrevDate + '.json', 'utf8')); medPrev = { date: medPrevDate, ageDays: Math.round((new Date(todayYMD) - new Date(medPrevDate)) / 86400000), packs: j.packs }; }
fs.writeFileSync(medSnapDir + 'media_' + todayYMD + '.json', JSON.stringify({ date: todayYMD, packs: medCur }, null, 1));
media.prev = medPrev;

// Cibles hebdo mises à l'échelle de la fenêtre (WEEKS_BACK=1 par défaut -> valeurs nominales inchangées)
const config = { fixedMonthly: 320000, weeklyMbTarget: 85000 * WEEK_SPAN, weeklyMbTargetAg: 70000 * WEEK_SPAN, weeklyMbTargetMed: 15000 * WEEK_SPAN, objCA: 9800000, objMB: 4900000 };

// pack média (cf_mdia/cf_mdias via code projet) attaché à chaque ligne du prévi
const cleanPack = r => { const c = clean(r); c.pack = cfByCode[codeKey(c.project)] || packOf(c.project) || null; return c; };

const out = {
  fy: '2026-2027',
  months: MONTHS.map(m => m.label),
  generatedAt: new Date().toISOString(),
  mbGlobalPct: GLOBAL_MB * 100,
  onglet1: [...o1.values()].sort((a, b) => b.total - a.total).map(cleanPack),
  onglet2: [...o2.values()].sort((a, b) => b.total - a.total).map(cleanPack),
  perimetre: perim,
  weekly,
  media,
  config,
};
fs.writeFileSync(dir + '_previ_data.json', JSON.stringify(out, null, 1));

// --- Diagnostic
const sum = arr => arr.reduce((s, r) => s + r.total, 0);
const sumMB = arr => arr.reduce((s, r) => s + (r.totalMB || 0), 0);
console.log('=== DIAGNOSTIC PRÉVI FY 2026/2027 ===');
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

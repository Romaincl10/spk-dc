/**
 * SPK DC — Backend Express
 * API pour le portail Directeurs de Clientele
 * Logique : assignation manuelle client→DC et projet→DC (pas de rate_card_label)
 * Filtre : projets agence uniquement (exclut M0* et MED0*)
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const multer = require('multer');
require('dotenv').config();

const furious = require('./furious.cjs');
const lucca = require('./lucca.cjs');
const auth = require('./auth.cjs');
const objectives = require('./objectives.cjs');
const assign = require('./assignments.cjs');
const activity = require('./activity.cjs');
const farming = require('./farming.cjs');
const { getCanonicalClientName, getCanonicalClientNameForProject } = require('./clientGroups.cjs');

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3002;

// ── Répertoire de données persistant ─────────────────────
// Si DATA_DIR est défini (ex: Railway Volume monté sur /mnt/data),
// on l'utilise ; sinon on utilise server/data/ (défaut local).
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : DEFAULT_DATA_DIR;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialisation : si DATA_DIR ≠ default (= volume persistant monté), on copie les
// fichiers de config (users, assignments, objectifs, activité) depuis les defaults
// commités UNIQUEMENT s'ils sont absents. Ensuite, toute modif (assignation, objectif)
// écrit sur le volume et persiste → les redéploiements et syncs ne l'écrasent plus.
if (DATA_DIR !== DEFAULT_DATA_DIR) {
  const CONFIG_FILES = ['users.json', 'client_assignments.json', 'project_assignments.json', 'proposal_assignments.json', 'objectives.json', 'weekly_activity.json'];
  CONFIG_FILES.forEach(file => {
    const dest = path.join(DATA_DIR, file);
    const src = path.join(DEFAULT_DATA_DIR, file);
    if (!fs.existsSync(dest) && fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`[Init] Seeded ${file} from defaults to ${DATA_DIR}`);
    }
  });
}
// Diagnostic de persistance — visible dans les logs Railway au démarrage.
console.log(DATA_DIR !== DEFAULT_DATA_DIR
  ? `[Init] Persistance ACTIVE — DATA_DIR=${DATA_DIR} (volume). Les assignations survivent aux redéploiements et aux syncs.`
  : `[Init] ⚠ Stockage ÉPHÉMÈRE (server/data). Monte un volume Railway et définis DATA_DIR pour stocker les assignations en dur.`);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));

// ── Helpers ──────────────────────────────────────────────

function saveData(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`),
    JSON.stringify({ data, syncDate: new Date().toISOString() }, null, 2));
}

function loadData(name) {
  const fp = path.join(DATA_DIR, `${name}.json`);
  try { if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) {}
  return null;
}

function normalize(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Date de valeur ('YYYY-MM-DD') si renseign\u00e9e et != 0000-00-00, sinon null */
function realDate(d) {
  return d && d !== '0000-00-00' ? d : null;
}

/**
 * Date effective d'une facture pour la reconnaissance du CA :
 * date d'\u00e9mission r\u00e9elle (invoice_date) si saisie, sinon date de facture PR\u00c9VUE
 * (issue_date, port\u00e9e par les factures planifi\u00e9es statut 0). null si aucune.
 */
function invoiceEffectiveDate(inv) {
  return realDate(inv.invoice_date) || realDate(inv.issue_date);
}

/** True si la facture est r\u00e9ellement \u00e9mise (par opposition \u00e0 planifi\u00e9e statut 0) */
function isInvoiceIssued(inv) {
  return !!realDate(inv.invoice_date) && String(inv.statut) !== '0';
}

/** Clients internes / reciprocites a exclure */
const EXCLUDED_CLIENTS = ['sportpack', 'spk medias', 'spk activate', 'spk studio', 'spk group'];

/** Returns true if project should be EXCLUDED */
function shouldExcludeProject(project) {
  const title = (project.title || '').trim();
  const typeLabel = (project.type_label || '').trim();
  const companyName = normalize(project.company_name || '');
  const legalEntity = (project.legal_entity || '').trim();

  // Exclure projets medias (M0*, MED0*) — Achats Médias BU
  if (/^M0/i.test(title) || /^MED0/i.test(title)) return true;
  // Exclure projets commencant par S0
  if (/^S0/i.test(title)) return true;
  // Exclure projets internes
  if (/interne/i.test(typeLabel) || /interne/i.test(title) || /^INTERNE/i.test(title)) return true;
  // Exclure reciprocites (clients internes)
  if (EXCLUDED_CLIENTS.some(ec => companyName === ec || companyName.includes(ec))) return true;
  // Exclure Business Unit Achats Médias (entité spk_medias)
  if (legalEntity === 'spk_medias') return true;

  return false;
}

/** Compat wrapper for routes that still call isMediaProject */
function isMediaProject(title) {
  return /^M0/i.test((title || '').trim()) || /^MED0/i.test((title || '').trim());
}

// ── Sync ─────────────────────────────────────────────────

let syncState = { furious: { status: 'idle', lastSync: null }, lucca: { status: 'idle', lastSync: null } };

async function syncFurious() {
  if (syncState.furious.status === 'syncing') return;
  syncState.furious.status = 'syncing';
  try {
    console.log('[Sync] Starting Furious sync...');
    const result = await furious.fullSync();
    saveData('furious_projects', result.projects);
    saveData('furious_project_kpis', result.projectKPIs);
    saveData('furious_proposals', result.proposals);
    saveData('furious_crm', result.crm);
    saveData('furious_invoices', result.invoices);
    saveData('furious_sprints', result.sprints);
    saveData('furious_purchases', result.purchases);
    saveData('furious_achats_medias', result.achatsMediasByProject);
    syncState.furious = { status: 'done', lastSync: new Date().toISOString(), counts: result.counts };
    console.log('[Sync] Furious sync done:', result.counts);
  } catch (e) {
    syncState.furious = { status: 'error', error: e.message, lastSync: syncState.furious.lastSync };
    console.error('[Sync] Furious error:', e.message);
  }
}

async function syncLucca() {
  if (syncState.lucca.status === 'syncing') return;
  syncState.lucca.status = 'syncing';
  try {
    console.log('[Sync] Starting Lucca sync...');
    const result = await lucca.fullSync();
    saveData('lucca', result.users);
    syncState.lucca = { status: 'done', lastSync: new Date().toISOString(), counts: result.counts };
  } catch (e) {
    syncState.lucca = { status: 'error', error: e.message, lastSync: syncState.lucca.lastSync };
    console.error('[Sync] Lucca error:', e.message);
  }
}

// ── Objectives loader ────────────────────────────────────

// Objectif Biz Dev par défaut (nouveaux clients) garanti pour chaque DC : 400 k€.
const DEFAULT_BIZDEV_TARGET = 400000;
function withBizDev(list) {
  const arr = Array.isArray(list) ? [...list] : [];
  if (!arr.some(o => o.client === '_BIZ_DEV')) {
    arr.push({ client: '_BIZ_DEV', label: 'Business Development (Nouveaux clients)', target: DEFAULT_BIZDEV_TARGET, type: 'biz_dev' });
  }
  return arr;
}

function loadObjectivesForDC(dcName, fyStartYear) {
  try {
    const fp = path.join(DATA_DIR, 'objectives.json');
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const root = data.objectives || {};
      // Structure scindée par exercice : { "2025": {dc:[]}, "2026": {dc:[]} }
      const scoped = Object.keys(root).some(k => /^\d{4}$/.test(k));
      const byDc = scoped ? (root[String(fyStartYear)] || {}) : root;
      return withBizDev(byDc?.[dcName] || []);
    }
  } catch (e) {}
  return withBizDev([]);
}

// ── Portfolio builder (assignment-based) ─────────────────

function buildDCPortfolios(fyStartYearParam) {
  const projectsData = loadData('furious_projects');
  const kpisData = loadData('furious_project_kpis');
  const proposalsData = loadData('furious_proposals');
  const invoicesData = loadData('furious_invoices');
  const purchasesData = loadData('furious_purchases');
  const achatsMediasData = loadData('furious_achats_medias');
  const sprintsData = loadData('furious_sprints');

  const allProjects = projectsData?.data || [];
  const kpis = kpisData?.data || [];
  const proposals = proposalsData?.data || [];
  const invoices = invoicesData?.data || [];
  const purchases = purchasesData?.data || [];
  const allSprints = sprintsData?.data || [];
  // Retraitement Achats Médias : { project_id → montant à déduire du CA }
  // On utilise uniquement le BU31 (ligne facturée au client = montant contractuel médias).
  // Le spend réel (achats Google/Meta) est un COÛT, pas une déduction de CA.
  // Le CA NET est cappé à ≥ 0 pour éviter les valeurs négatives.
  const achatsMediasByProject = achatsMediasData?.data || {};

  const clientAssignments = assign.getAllClientAssignments(Number.isInteger(fyStartYearParam) ? fyStartYearParam : currentFyStartYear);
  const projectAssignments = assign.getAllProjectAssignments();
  const proposalAssignments = assign.getAllProposalAssignments();

  // Fiscal year — exercice courant par défaut, ou exercice demandé (fyStartYear = année de début, ex: 2025 → 01/07/2025 au 30/06/2026)
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentFyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStartYear = Number.isInteger(fyStartYearParam) ? fyStartYearParam : currentFyStartYear;
  const fyStart = new Date(fyStartYear, 6, 1);
  const fyEnd = new Date(fyStartYear + 1, 5, 30);

  // KPI map
  const kpiMap = {};
  kpis.forEach(k => { kpiMap[k.project_id] = k; });

  // Sprint map : { project_id → { fait, planifie } }
  // fait = sprints with start_date < today, planifie = sprints with start_date >= today
  const sprintMap = {};
  const sprintMonthMap = {}; // { project_id → { 'YYYY-MM' → { fait, planifie } } }
  const sprintCollabMap = {}; // { project_id → { person → { month → { fait, planifie } } } }
  allSprints.forEach(s => {
    const pid = String(s.project_id);
    if (!sprintMap[pid]) sprintMap[pid] = { fait: 0, planifie: 0 };
    const t = Number(s.time) || 0;
    const isFait = s.start_date && s.start_date < todayStr;
    if (s.start_date && isFait) sprintMap[pid].fait += t;
    else if (s.start_date) sprintMap[pid].planifie += t;
    // Per-month breakdown
    if (s.start_date && t > 0) {
      const month = s.start_date.substring(0, 7);
      if (!sprintMonthMap[pid]) sprintMonthMap[pid] = {};
      if (!sprintMonthMap[pid][month]) sprintMonthMap[pid][month] = { fait: 0, planifie: 0 };
      if (isFait) sprintMonthMap[pid][month].fait += t;
      else sprintMonthMap[pid][month].planifie += t;
      // Per-collaborator breakdown
      const person = (s.assigned_people || 'Inconnu').trim();
      if (!sprintCollabMap[pid]) sprintCollabMap[pid] = {};
      if (!sprintCollabMap[pid][person]) sprintCollabMap[pid][person] = {};
      if (!sprintCollabMap[pid][person][month]) sprintCollabMap[pid][person][month] = { fait: 0, planifie: 0 };
      if (isFait) sprintCollabMap[pid][person][month].fait += t;
      else sprintCollabMap[pid][person][month].planifie += t;
    }
  });

  // Filter: agency only (exclude M0*, MED0*)
  const agencyProjects = allProjects.filter(p => !shouldExcludeProject(p));

  // Rattachement à l'exercice basé sur les FACTURES : le cut 25/26 ↔ 26/27 suit la
  // date de facture EFFECTIVE (émise si émise, sinon prévue via issue_date), pas les
  // dates de projet. Un projet appartient à l'exercice s'il a ≥1 facture datée dedans.
  // Fallback sur les dates de projet uniquement pour les projets sans aucune facture.
  const fyEndInclusive = new Date(fyStartYear + 1, 5, 30, 23, 59, 59);
  const projectsWithAnyInvoice = new Set();
  const projectsWithFYInvoice = new Set();
  invoices.forEach(inv => {
    if (inv.is_cancelled == 1) return;
    const pid = String(inv.project_id);
    projectsWithAnyInvoice.add(pid);
    const ed = invoiceEffectiveDate(inv);
    if (!ed) return;
    const d = new Date(ed);
    if (d >= fyStart && d <= fyEndInclusive) projectsWithFYInvoice.add(pid);
  });

  // Enrich all projects
  const enrichedAll = agencyProjects.map(p => {
    const k = kpiMap[p.id] || {};
    const sp = sprintMap[String(p.id)] || { fait: 0, planifie: 0 };
    const startDate = p.start_date ? new Date(p.start_date) : null;
    const endDate = p.end_date ? new Date(p.end_date) : null;
    // Appartenance à l'exercice : par les factures si le projet en a, sinon par ses dates.
    const inFYDates = startDate && endDate ? !(endDate < fyStart || startDate > fyEnd) : true;
    const inFY = projectsWithAnyInvoice.has(String(p.id))
      ? projectsWithFYInvoice.has(String(p.id))
      : inFYDates;
    const amt = Number(p.total_amount) || 0;
    const mEur = Number(p.margin) || 0;

    // Retraitement Achats Médias : déduire le montant pass-through du CA
    const achatsMedias = achatsMediasByProject[String(p.id)] || 0;
    const amtNet = Math.max(0, amt - achatsMedias);

    const timeSold = Number(k.time_sold_budget_days) || 0;
    const timeFait = Math.round(sp.fait * 100) / 100;
    const timePlanifie = Math.round(sp.planifie * 100) / 100;
    const advancement = timeSold > 0 ? Math.min(Math.round(timeFait / timeSold * 1000) / 10, 100) : Number(p.advancement) || 0;

    return {
      id: p.id, title: p.title, company_name: p.company_name,
      canonical_client: getCanonicalClientNameForProject(p.company_name, p.title),
      start_date: p.start_date, end_date: p.end_date,
      created_at: p.created_at,
      total_amount: amtNet, total_cost: Number(p.total_cost) || 0,
      achatsMedias,
      marginEur: mEur,
      margin: amtNet > 0 ? Math.round(mEur / amtNet * 1000) / 10 : 0,
      actif: p.actif, type_label: p.type_label,
      project_manager: p.project_manager, business_account: p.business_account,
      advancement, legal_entity: p.legal_entity,
      time_sold_days: timeSold,
      time_fait_days: timeFait,
      time_planifie_days: timePlanifie,
      // Per-month sprint breakdown
      monthlyDays: sprintMonthMap[String(p.id)] || {},
      monthlyCollab: sprintCollabMap[String(p.id)] || {},
      // Keep legacy fields for compatibility
      time_spent_days: timeFait,
      time_planified_days: timePlanifie,
      turnover: Number(k.turnover) || 0, gross_margin: Number(k.gross_margin) || 0,
      budget: Number(k.budget) || 0, inFY,
    };
  });

  // Determine DC for each project:
  // 1. Check explicit project assignment
  // 2. Else use client assignment
  // 3. Else "A assigner"
  function getDCsForProject(project) {
    // Explicit project assignment (can be multi-DC)
    const projDCs = projectAssignments[project.id];
    if (projDCs && projDCs.length > 0) return projDCs;

    // Client-based assignment
    const clientName = project.company_name;
    if (clientName) {
      const normClient = normalize(clientName);
      const matchKey = Object.keys(clientAssignments).find(k => normalize(k) === normClient);
      if (matchKey && clientAssignments[matchKey]) return [clientAssignments[matchKey]];
    }

    return ['A assigner'];
  }

  // Determine DC for each proposal (devis) — même logique que les projets :
  // 1. Assignation explicite du devis  2. Assignation par client  3. "A assigner"
  function getDCsForProposal(proposal) {
    const propDCs = proposalAssignments[proposal.id];
    if (propDCs && propDCs.length > 0) return propDCs;

    const clientName = proposal.company_name;
    if (clientName) {
      const normClient = normalize(clientName);
      const matchKey = Object.keys(clientAssignments).find(k => normalize(k) === normClient);
      if (matchKey && clientAssignments[matchKey]) return [clientAssignments[matchKey]];
    }

    return ['A assigner'];
  }

  // Bucket proposals by DC (assignment-aware, like projects)
  const proposalsByDC = {};
  proposals.forEach(p => {
    getDCsForProposal(p).forEach(dc => {
      if (!proposalsByDC[dc]) proposalsByDC[dc] = [];
      proposalsByDC[dc].push(p);
    });
  });

  // Map project_id → canonical client (for invoice bucketing)
  const projectToCanonical = {};
  const projectTitleById = {};
  enrichedAll.forEach(p => { projectToCanonical[String(p.id)] = p.canonical_client || p.company_name; projectTitleById[String(p.id)] = p.title; });

  // Taux de marge par projet (marge contractuelle / CA net contractuel) — sert à proratiser
  // la marge selon le CA facturé. Neutralisé pour les projets "placeholder" (CA quasi nul
  // mais marge saisie dans Furious → taux aberrant, ex PUMA à 1€ avec marge -110k€).
  const MIN_CHIFFRAGE = 100; // € : en dessous, projet non chiffré → marge neutralisée
  // Taux de marge par projet (marge contractuelle / CA net). p.total_amount est DÉJÀ net
  // (amtNet = brut − achats médias, cf. enrichedAll). Neutralisé sous MIN_CHIFFRAGE.
  const marginRateByProject = {};
  enrichedAll.forEach(p => {
    marginRateByProject[String(p.id)] = (p.total_amount || 0) >= MIN_CHIFFRAGE ? (p.marginEur || 0) / p.total_amount : 0;
  });
  // Facteur "net de paid média" par facture : la facture Furious bille le brut
  // (total contractuel = net + achats médias). On ramène au CA net (hors BU Achats Médias).
  // p.total_amount est le NET (amtNet) ; brut = net + achatsMedias → netFactor = net/brut.
  const netFactorByProject = {};
  enrichedAll.forEach(p => {
    const brut = (p.total_amount || 0) + (p.achatsMedias || 0);
    netFactorByProject[String(p.id)] = brut > 0 ? (p.total_amount || 0) / brut : 1;
  });
  // Montant net d'une facture (paid média déduit au prorata du projet)
  const invNet = (inv) => (Number(inv.amount_ht) || 0) * (netFactorByProject[String(inv.project_id)] ?? 1);

  // Appariement annulation ↔ avoir : une facture annulée (is_cancelled) est neutralisée
  // par un avoir (montant négatif, même projet, montant opposé). On exclut les DEUX :
  // sinon l'avoir seul (l'annulée étant déjà filtrée) soustrait un CA fantôme.
  // Les avoirs commerciaux réels (sans facture annulée en face) restent comptés.
  const pairedAvoirs = new Set();
  {
    const negByProject = {};
    invoices.forEach(inv => {
      if (Number(inv.amount_ht) < 0) (negByProject[String(inv.project_id)] ||= []).push(inv);
    });
    invoices.forEach(inv => {
      if (inv.is_cancelled != 1) return;
      const list = negByProject[String(inv.project_id)] || [];
      const idx = list.findIndex(n => Math.abs(Math.abs(Number(n.amount_ht)) - Math.abs(Number(inv.amount_ht))) < 0.01);
      if (idx >= 0) { pairedAvoirs.add(list[idx]); list.splice(idx, 1); }
    });
  }

  // ── Médias par client (pour le suivi regroupé Agence/Médias/Cumul) ──
  // CA médias réalisé par client canonique (projets MED0 rattachés à l'exercice)
  const mediaCAByCanon = {};
  allProjects.forEach(p => {
    if (!/^MED0/i.test((p.title || '').trim())) return;
    const sd = p.start_date ? new Date(p.start_date) : null;
    const ed = p.end_date ? new Date(p.end_date) : null;
    const inFYm = sd && ed ? !(ed < fyStart || sd > fyEnd) : true;
    if (!inFYm) return;
    const canon = getCanonicalClientName(p.company_name);
    mediaCAByCanon[canon] = (mediaCAByCanon[canon] || 0) + (Number(p.total_amount) || 0);
  });
  // Matrice objectifs médias (brute) — matching par nom normalisé plus robuste
  let mediaObjectivesRaw = [];
  try { mediaObjectivesRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'media_objectives.json'), 'utf8')); } catch (e) {}

  // Premier mouvement par client canonique (projets agence + factures, tout l'historique).
  // Sert à distinguer NOUVEAU client (1er mvt dans l'exercice) vs client ÉTABLI hors objectif.
  const firstMoveByCanon = {};
  const noteFM = (canon, d) => { const rd = realDate(d); if (!canon || !rd) return; const t = new Date(rd); if (isNaN(t)) return; if (!firstMoveByCanon[canon] || t < firstMoveByCanon[canon]) firstMoveByCanon[canon] = t; };
  allProjects.forEach(p => { if (shouldExcludeProject(p)) return; const c = getCanonicalClientNameForProject(p.company_name, p.title); noteFM(c, p.created_at); noteFM(c, p.start_date); });
  invoices.forEach(inv => { if (inv.is_cancelled) return; noteFM(getCanonicalClientName(inv.company_name), invoiceEffectiveDate(inv)); });
  const isNewCanon = (canon) => !!firstMoveByCanon[canon] && firstMoveByCanon[canon] >= fyStart && firstMoveByCanon[canon] <= fyEndInclusive;

  // Group projects by DC
  const dcGroups = {}; // dcName → { projects, clientNames }
  enrichedAll.forEach(p => {
    const dcs = getDCsForProject(p);
    dcs.forEach(dc => {
      if (!dcGroups[dc]) dcGroups[dc] = { projects: [], clientSet: new Set() };
      dcGroups[dc].projects.push(p);
      if (p.company_name) dcGroups[dc].clientSet.add(p.company_name);
    });
  });

  // Ensure DCs that only have assigned devis (no projects) still get a portfolio
  Object.keys(proposalsByDC).forEach(dc => {
    if (!dcGroups[dc]) dcGroups[dc] = { projects: [], clientSet: new Set() };
  });

  // Build portfolio per DC
  const portfolios = {};
  for (const [dcName, group] of Object.entries(dcGroups)) {
    const projectsList = group.projects;
    const clientNames = [...group.clientSet];
    const projectIds = projectsList.map(p => p.id);

    // Proposals assigned to this DC (explicit devis assignment > client assignment)
    const dcProposals = (proposalsByDC[dcName] || [])
      .map(p => ({ ...p, canonical_client: getCanonicalClientName(p.company_name) }));
    // Invoices & purchases for these projects
    const dcInvoices = invoices.filter(inv => projectIds.includes(inv.project_id));
    const dcPurchases = purchases.filter(pu => projectIds.includes(pu.project_id));

    // Projets rattachés à l'exercice (chevauchement de dates) — sert aux compteurs (projets actifs, jours)
    const fyProjects = projectsList.filter(p => p.inFY);

    // Bornes de l'exercice pour le filtrage des factures
    const fyStartDate = new Date(fyStartYear, 6, 1);
    const fyEndDate = new Date(fyStartYear + 1, 5, 30, 23, 59, 59);
    // Factures valides = non annulées, hors avoir neutralisant une annulée,
    // disposant d'une date effective (émise OU prévue via issue_date, statut 0)
    const validInvoices = dcInvoices.filter(inv =>
      !inv.is_cancelled &&
      inv.statut !== 'cancelled' &&
      !pairedAvoirs.has(inv) &&
      invoiceEffectiveDate(inv)
    );
    // Factures rattachées à l'exercice via leur DATE EFFECTIVE (émise ou prévue) →
    // base de reconnaissance du CA. Un projet à cheval sur 2 exercices voit son CA
    // ventilé selon les dates de facturation (réelles ou prévues), pas en bloc.
    const fyInvoices = validInvoices.filter(inv => {
      const d = new Date(invoiceEffectiveDate(inv));
      return d >= fyStartDate && d <= fyEndDate;
    });

    // CA de l'exercice = somme des factures datées dans l'exercice (CA reconnu : marge
    // seule pour les clients pass-through comme Le Mans)
    // MB = CA facturé × taux de marge du projet (prorata du contractuel)
    const caTotal = fyInvoices.reduce((s, inv) => s + invNet(inv), 0);
    const mbTotal = fyInvoices.reduce((s, inv) =>
      s + invNet(inv) * (marginRateByProject[String(inv.project_id)] || 0), 0);
    const margeBrutePct = caTotal > 0 ? Math.round(mbTotal / caTotal * 1000) / 10 : 0;
    // Marge brute moyenne = moyenne des taux de marge des projets facturés dans l'exercice
    const billedProjectIds = new Set(fyInvoices.map(inv => String(inv.project_id)));
    const margins = fyProjects.filter(p => billedProjectIds.has(String(p.id)) && p.margin > 0).map(p => p.margin);
    const margeBruteMoy = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : 0;

    const projetsActifs = fyProjects.filter(p => p.actif === '1' || p.actif === 1).length;
    const totalSold = fyProjects.reduce((s, p) => s + p.time_sold_days, 0);
    const totalSpent = fyProjects.reduce((s, p) => s + p.time_spent_days, 0);

    const activePipeline = dcProposals.filter(p => {
      const pipe = Number(p.pipe);
      if (!(pipe >= 0 && pipe < 6 && !p.signature_date)) return false;
      // Exclure devis déjà convertis en projet (project_id défini et != 0)
      if (p.project_id && p.project_id !== '0' && p.project_id !== 0) return false;
      // Exclure devis perdus
      if (p.pipe_name === 'Perdu') return false;
      // Exclure devis hors entité SPK (spk_medias, spk_activate, spk_studio)
      if (p.entity && p.entity !== 'spk') return false;
      // Exclure devis Achats Médias (M0*, MED0*)
      const title = (p.title || '').trim();
      if (/^M0/i.test(title) || /^MED0/i.test(title)) return false;
      // Rattachement à l'exercice par la DATE DE FIN envisagée du devis (projet_stop) :
      // un devis compte pour l'exercice où sa fin de prod est prévue.
      // (fallback sur projet_start si projet_stop absent)
      const ref = p.projet_stop ? new Date(p.projet_stop) : (p.projet_start ? new Date(p.projet_start) : null);
      if (ref && (ref < fyStartDate || ref > fyEndDate)) return false;
      return true;
    });
    const pipelineTotal = activePipeline.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pipelineProbabilise = activePipeline.reduce((s, p) =>
      s + (Number(p.amount) || 0) * (Number(p.probability) || 0) / 100, 0);

    const caFacture = fyInvoices.filter(inv => isInvoiceIssued(inv) && new Date(inv.invoice_date) <= now)
      .reduce((s, inv) => s + invNet(inv), 0);

    // Build client breakdown — CA/MB basés sur les factures datées dans l'exercice
    const clientMap = {};
    fyProjects.forEach(p => {
      const canonical = p.canonical_client || p.company_name || 'Inconnu';
      if (!clientMap[canonical]) clientMap[canonical] = { name: canonical, ca: 0, mb: 0, pipe: 0, pipeProbabilise: 0, projects: [] };
      clientMap[canonical].projects.push(p);
    });
    // CA/MB par client = factures de l'exercice ventilées par client canonique
    fyInvoices.forEach(inv => {
      const canonical = projectToCanonical[String(inv.project_id)];
      if (!canonical) return;
      if (!clientMap[canonical]) clientMap[canonical] = { name: canonical, ca: 0, mb: 0, pipe: 0, pipeProbabilise: 0, projects: [] };
      clientMap[canonical].ca += invNet(inv);
      clientMap[canonical].mb += invNet(inv) * (marginRateByProject[String(inv.project_id)] || 0);
    });

    // Add pipeline per canonical client + store devis per client
    const activePipeByClient = {};
    const devisByClient = {};
    activePipeline.forEach(p => {
      const canonical = getCanonicalClientName(p.company_name);
      if (!activePipeByClient[canonical]) activePipeByClient[canonical] = { pipe: 0, pipeProbabilise: 0 };
      activePipeByClient[canonical].pipe += Number(p.amount) || 0;
      activePipeByClient[canonical].pipeProbabilise += (Number(p.amount) || 0) * (Number(p.probability) || 0) / 100;
      if (!devisByClient[canonical]) devisByClient[canonical] = [];
      devisByClient[canonical].push({
        id: p.id, title: p.title, company_name: p.company_name,
        amount: Number(p.amount) || 0, probability: Number(p.probability) || 0,
        probabilise: (Number(p.amount) || 0) * (Number(p.probability) || 0) / 100,
        pipe: Number(p.pipe), pipe_name: p.pipe_name,
        created_at: p.created_at, projet_start: p.projet_start, projet_stop: p.projet_stop,
      });
    });
    for (const [cn, pipeData] of Object.entries(activePipeByClient)) {
      if (clientMap[cn]) {
        clientMap[cn].pipe = pipeData.pipe;
        clientMap[cn].pipeProbabilise = pipeData.pipeProbabilise;
        clientMap[cn].devis = devisByClient[cn] || [];
      } else {
        clientMap[cn] = { name: cn, ca: 0, mb: 0, pipe: pipeData.pipe, pipeProbabilise: pipeData.pipeProbabilise, projects: [], devis: devisByClient[cn] || [] };
      }
    }
    // Ensure all clients have devis array
    Object.values(clientMap).forEach(c => { if (!c.devis) c.devis = []; });

    // Ventilation mensuelle du CA par client (dans l'exercice) : facturé (émis) vs planifié (prévu)
    validInvoices.forEach(inv => {
      const canonical = projectToCanonical[String(inv.project_id)];
      if (!canonical || !clientMap[canonical]) return;
      const ed = invoiceEffectiveDate(inv);
      if (!ed) return;
      const d = new Date(ed);
      if (d < fyStartDate || d > fyEndDate) return; // exclude invoices outside FY
      const month = ed.substring(0, 7);
      const issued = isInvoiceIssued(inv);
      if (issued) {
        if (!clientMap[canonical].monthlyInvoiceCA) clientMap[canonical].monthlyInvoiceCA = {};
        clientMap[canonical].monthlyInvoiceCA[month] = (clientMap[canonical].monthlyInvoiceCA[month] || 0) + invNet(inv);
      } else {
        if (!clientMap[canonical].monthlyInvoicePlan) clientMap[canonical].monthlyInvoicePlan = {};
        clientMap[canonical].monthlyInvoicePlan[month] = (clientMap[canonical].monthlyInvoicePlan[month] || 0) + invNet(inv);
      }
      // Détail par facture (quel projet, quel montant net, quelle date)
      if (!clientMap[canonical].invoiceDetail) clientMap[canonical].invoiceDetail = [];
      clientMap[canonical].invoiceDetail.push({
        month, date: ed.substring(0, 10), amount: invNet(inv), issued,
        project: projectTitleById[String(inv.project_id)] || inv.project_name || '—',
      });
    });
    Object.values(clientMap).forEach(c => {
      if (!c.monthlyInvoiceCA) c.monthlyInvoiceCA = {};
      if (!c.monthlyInvoicePlan) c.monthlyInvoicePlan = {};
      if (!c.invoiceDetail) c.invoiceDetail = [];
      c.invoiceDetail.sort((a, b) => a.date.localeCompare(b.date));
    });

    const clientBreakdown = Object.values(clientMap).sort((a, b) => (b.ca + b.pipeProbabilise) - (a.ca + a.pipeProbabilise));

    // Load objectives for this DC (exercice courant)
    const objData = loadObjectivesForDC(dcName, fyStartYear);
    // Agrège le CA/pipe des clients d'un objectif : par motifs `match` (niveau groupe)
    // sinon par nom canonique exact. Retourne { actual, pipe }.
    const matchObjective = (obj) => {
      if (Array.isArray(obj.match) && obj.match.length) {
        const matched = clientBreakdown.filter(c => obj.match.some(p => normalize(c.name).includes(p)));
        return {
          actual: matched.reduce((s, c) => s + (c.ca || 0), 0),
          pipe: matched.reduce((s, c) => s + (c.pipeProbabilise || 0), 0),
          names: matched.map(c => c.name),
        };
      }
      const cn = getCanonicalClientName(obj.client);
      const m = clientBreakdown.find(c => c.name === cn);
      return { actual: m ? m.ca : 0, pipe: m ? (m.pipeProbabilise || 0) : 0, names: m ? [m.name] : [cn] };
    };

    // Ensemble des clients (du breakdown) déjà rattachés à un objectif nominatif,
    // via patterns `match` (niveau groupe) ou nom canonique. Sert à isoler le Biz Dev
    // (clients hors objectif) SANS double comptage — même logique que matchObjective().
    const claimedClientNames = new Set();
    objData.filter(o => o.client !== '_BIZ_DEV').forEach(obj => {
      if (Array.isArray(obj.match) && obj.match.length) {
        clientBreakdown.forEach(c => { if (obj.match.some(p => normalize(c.name).includes(p))) claimedClientNames.add(c.name); });
      } else {
        const m = clientBreakdown.find(c => c.name === getCanonicalClientName(obj.client));
        if (m) claimedClientNames.add(m.name);
      }
    });
    // Clients hors objectif nominatif, séparés en NOUVEAUX (conquête, 1er mvt dans
    // l'exercice) vs ÉTABLIS (clients existants sans objectif, ex Decathlon/FFF).
    const computeBizDev = (obj) => {
      const hors = clientBreakdown.filter(c => !claimedClientNames.has(c.name) && (c.ca > 0 || (c.pipeProbabilise || 0) > 0));
      const toRow = c => ({ client: c.name, actual: c.ca, pipe: c.pipeProbabilise || 0 });
      const newClients = hors.filter(c => isNewCanon(c.name)).map(toRow);
      const otherClients = hors.filter(c => !isNewCanon(c.name)).map(toRow);
      // "Biz Dev" (conquête) = uniquement les nouveaux clients
      const bizDevCA = newClients.reduce((s, c) => s + c.actual, 0);
      const bizDevPipe = newClients.reduce((s, c) => s + c.pipe, 0);
      return {
        ...obj, actual: bizDevCA, pipe: bizDevPipe, clients: newClients,
        otherClients, otherCA: otherClients.reduce((s, c) => s + c.actual, 0), otherPipe: otherClients.reduce((s, c) => s + c.pipe, 0),
        progress: obj.target > 0 ? Math.round(bizDevCA / obj.target * 100) : 0,
      };
    };

    // Enrich objectives with actual values from clientBreakdown
    // Use getCanonicalClientName() on both sides to ensure robust matching
    // (e.g. "Intersport" → "INTERSPORT FRANCE" matches clientBreakdown canonical name)
    const enrichedObjectives = objData.map(obj => {
      if (obj.client === '_BIZ_DEV') return computeBizDev(obj);
      const { actual, pipe, names } = matchObjective(obj);
      return { ...obj, actual, pipe, canonicalNames: names, progress: obj.target > 0 ? Math.round(actual / obj.target * 100) : (actual > 0 ? 100 : 0) };
    });

    // Filet de sécurité : si aucune ligne _BIZ_DEV n'est saisie mais que le DC a des
    // clients hors objectif (ex. Decathlon/FFF chez Hadrien), on synthétise une ligne
    // Biz Dev pour que le détail par objectif réconcilie avec le CA total. Sans ça, ce
    // CA est compté dans caTotal (carte "CA Signé") mais invisible dans la ventilation.
    if (!enrichedObjectives.some(o => o.client === '_BIZ_DEV')) {
      const synth = computeBizDev({ client: '_BIZ_DEV', label: 'Business Development (Hors objectif)', target: 0, type: 'biz_dev' });
      if (synth.clients.length) enrichedObjectives.push(synth);
    }

    // Total objective
    const totalObjTarget = enrichedObjectives.filter(o => o.client !== '_BIZ_DEV').reduce((s, o) => s + o.target, 0);
    const totalObjActual = enrichedObjectives.filter(o => o.client !== '_BIZ_DEV').reduce((s, o) => s + o.actual, 0);

    // Projets et devis récents (2 derniers mois basé sur created_at)
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsAgoStr = twoMonthsAgo.toISOString().split('T')[0];
    const recentProjects = projectsList.filter(p => p.created_at && p.created_at >= twoMonthsAgoStr)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    // All proposals assigned to this DC (not just active pipeline) for recent devis
    const allDcProposals = proposalsByDC[dcName] || [];
    const recentDevis = allDcProposals
      .filter(p => {
        if (!p.created_at) return false;
        const d = p.created_at.substring(0, 10);
        if (d < twoMonthsAgoStr) return false;
        if (p.project_id && p.project_id !== '0' && p.project_id !== 0) return false;
        if (/^M0|^MED0/i.test(p.title || '')) return false;
        return true;
      })
      .map(p => ({
        id: p.id, title: p.title, company_name: p.company_name,
        canonical_client: getCanonicalClientName(p.company_name),
        amount: Number(p.amount) || 0, probability: Number(p.probability) || 0,
        probabilise: (Number(p.amount) || 0) * (Number(p.probability) || 0) / 100,
        pipe_name: p.pipe_name, created_at: p.created_at,
        projet_start: p.projet_start, projet_stop: p.projet_stop,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Suivi regroupé des clients : CA réalisé vs objectif, agence + médias (filtre Cumul/Agence/Médias)
    const clientTracking = enrichedObjectives
      .filter(o => o.client !== '_BIZ_DEV' && ((o.target || 0) > 0 || (o.actual || 0) > 0))
      .map(o => {
        const normO = normalize(o.client);
        const matchName = (nm) => nm === normO || (normO.length >= 4 && (nm.includes(normO) || normO.includes(nm)));
        const objMedia = mediaObjectivesRaw.filter(m => (m.target || 0) > 0 && matchName(normalize(m.client))).reduce((s, m) => s + m.target, 0);
        const caMedia = Object.entries(mediaCAByCanon).filter(([k]) => matchName(normalize(k))).reduce((s, [, v]) => s + v, 0);
        return { client: o.client, caAgence: o.actual || 0, objAgence: o.target || 0, caMedia, objMedia };
      });

    portfolios[dcName] = {
      dcName,
      projects: projectsList,
      proposals: dcProposals,
      invoices: dcInvoices,
      purchases: dcPurchases,
      clients: clientNames,
      clientBreakdown,
      objectives: enrichedObjectives,
      clientTracking,
      recentProjects,
      recentDevis,
      kpis: {
        caTotal, caFacture, mbTotal,
        margeBrutePct,
        margeBruteMoy: Math.round(margeBruteMoy * 10) / 10,
        projetsActifs, projetsTotal: fyProjects.length,
        clientsActifs: clientBreakdown.length,
        pipelineTotal, pipelineProbabilise,
        totalSold, totalSpent,
        avancementGlobal: totalSold > 0 ? Math.round(totalSpent / totalSold * 1000) / 10 : 0,
        objectifTotal: totalObjTarget,
        objectifActuel: totalObjActual,
        objectifProgress: totalObjTarget > 0 ? Math.round(totalObjActual / totalObjTarget * 100) : 0,
      },
    };
  }

  // Ensure every DC-role user has a portfolio entry, even without Furious data
  try {
    const USERS_FILE = path.join(DATA_DIR, 'users.json');
    if (fs.existsSync(USERS_FILE)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      users.filter(u => u.role === 'dc').forEach(u => {
        const key = u.furiousName || u.name;
        if (key && !portfolios[key]) {
          // DC sans données Furious : on charge quand même ses objectifs (réalisé = 0)
          const objData = loadObjectivesForDC(key, fyStartYear);
          const emptyObjectives = objData.map(o => o.client === '_BIZ_DEV'
            ? { ...o, actual: 0, pipe: 0, clients: [], progress: 0 }
            : { ...o, actual: 0, pipe: 0, progress: 0 });
          const objTarget = emptyObjectives.filter(o => o.client !== '_BIZ_DEV').reduce((s, o) => s + (o.target || 0), 0);
          portfolios[key] = {
            dcName: key,
            projects: [], proposals: [], invoices: [], purchases: [],
            clients: [], clientBreakdown: [], objectives: emptyObjectives,
            recentProjects: [], recentDevis: [],
            kpis: {
              caTotal: 0, caFacture: 0, mbTotal: 0,
              margeBrutePct: 0, margeBruteMoy: 0,
              projetsActifs: 0, projetsTotal: 0,
              clientsActifs: 0, pipelineTotal: 0, pipelineProbabilise: 0,
              totalSold: 0, totalSpent: 0, avancementGlobal: 0,
              objectifTotal: objTarget, objectifActuel: 0, objectifProgress: 0,
            },
          };
        }
      });
    }
  } catch (e) { console.error('[Portfolio] Error injecting empty DC portfolios:', e.message); }

  return portfolios;
}

// ── Vues transverses : Biz Dev (nouveaux clients) & Médias ──────────

/** Bornes de l'exercice fiscal (démarre le 01/07). */
function fyBounds(fyStartYearParam) {
  const now = new Date();
  const cur = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const y = Number.isInteger(fyStartYearParam) ? fyStartYearParam : cur;
  return { y, fyStart: new Date(y, 6, 1), fyEnd: new Date(y + 1, 5, 30, 23, 59, 59) };
}

/** Devis actif (pipe ouvert, non signé, non perdu, entité SPK). */
function isActiveProposal(p) {
  const pipe = Number(p.pipe);
  if (!(pipe >= 0 && pipe < 6 && !p.signature_date)) return false;
  if (p.project_id && p.project_id !== '0' && p.project_id !== 0) return false;
  if (p.pipe_name === 'Perdu') return false;
  if (p.entity && p.entity !== 'spk') return false;
  return true;
}

/**
 * Biz Dev = tous les projets/devis de l'exercice sur des sociétés JAMAIS mouvementées
 * auparavant (= nouveaux clients). Un client est "nouveau" si son tout premier mouvement
 * (projet créé/démarré OU facture, sur tout l'historique) tombe dans l'exercice courant.
 * Les projets médias/internes (M0*, MED0*, internes) sont exclus du calcul de l'historique.
 */
function buildBizDev(fyStartYearParam) {
  const allProjects = loadData('furious_projects')?.data || [];
  const proposals = loadData('furious_proposals')?.data || [];
  const invoices = loadData('furious_invoices')?.data || [];
  const achatsMediasByProject = loadData('furious_achats_medias')?.data || {};
  const { y: fyStartYear, fyStart, fyEnd } = fyBounds(fyStartYearParam);

  // Premier mouvement par client canonique, sur tout l'historique (projets agence + factures).
  // Canonical unifié via getCanonicalClientName(company_name) pour éviter toute fragmentation.
  const firstMove = {};
  const note = (canon, d) => {
    const rd = realDate(d); if (!canon || !rd) return;
    const t = new Date(rd); if (isNaN(t)) return;
    if (!firstMove[canon] || t < firstMove[canon]) firstMove[canon] = t;
  };
  allProjects.forEach(p => {
    if (shouldExcludeProject(p)) return;
    const canon = getCanonicalClientName(p.company_name);
    note(canon, p.created_at); note(canon, p.start_date);
  });
  invoices.forEach(inv => {
    if (inv.is_cancelled) return;
    note(getCanonicalClientName(inv.company_name), invoiceEffectiveDate(inv));
  });
  const isNew = canon => !!firstMove[canon] && firstMove[canon] >= fyStart && firstMove[canon] <= fyEnd;

  const clientsMap = {};
  const ensure = (canon) => {
    if (!clientsMap[canon]) clientsMap[canon] = { name: canon, firstMove: firstMove[canon], projects: [], devis: [], caSigne: 0, mbEur: 0, pipe: 0 };
    return clientsMap[canon];
  };
  // Un client "nouveau" n'a par construction AUCUN mouvement avant l'exercice :
  // on prend donc TOUS ses projets (hors exclus) et TOUS ses devis actifs, sans filtre de date.
  allProjects.forEach(p => {
    if (shouldExcludeProject(p)) return;
    const canon = getCanonicalClientName(p.company_name);
    if (!isNew(canon)) return;
    const amt = Number(p.total_amount) || 0;
    const amtNet = Math.max(0, amt - (achatsMediasByProject[String(p.id)] || 0));
    const mEur = Number(p.margin) || 0;
    const c = ensure(canon);
    c.projects.push({
      id: p.id, title: p.title, total_amount: amtNet, marginEur: mEur,
      margin: amtNet > 0 ? Math.round(mEur / amtNet * 1000) / 10 : 0,
      actif: p.actif, advancement: Number(p.advancement) || 0,
      start_date: p.start_date, end_date: p.end_date, created_at: p.created_at,
    });
    c.caSigne += amtNet; c.mbEur += mEur;
  });
  proposals.forEach(p => {
    if (!isActiveProposal(p)) return;
    const canon = getCanonicalClientName(p.company_name);
    if (!isNew(canon)) return;
    const amount = Number(p.amount) || 0, proba = Number(p.probability) || 0;
    const probabilise = amount * proba / 100;
    const c = ensure(canon);
    c.devis.push({ id: p.id, title: p.title, amount, probability: proba, probabilise, pipe_name: p.pipe_name, projet_start: p.projet_start, projet_stop: p.projet_stop });
    c.pipe += probabilise;
  });

  const clients = Object.values(clientsMap)
    .map(c => ({
      ...c,
      firstMove: c.firstMove ? c.firstMove.toISOString().slice(0, 10) : null,
      margePct: c.caSigne > 0 ? Math.round(c.mbEur / c.caSigne * 1000) / 10 : 0,
      projects: c.projects.sort((a, b) => b.total_amount - a.total_amount),
      devis: c.devis.sort((a, b) => b.probabilise - a.probabilise),
    }))
    .sort((a, b) => (b.caSigne + b.pipe) - (a.caSigne + a.pipe));

  const totals = clients.reduce((t, c) => ({
    count: t.count + 1, caSigne: t.caSigne + c.caSigne, mbEur: t.mbEur + c.mbEur,
    pipe: t.pipe + c.pipe, projects: t.projects + c.projects.length, devis: t.devis + c.devis.length,
  }), { count: 0, caSigne: 0, mbEur: 0, pipe: 0, projects: 0, devis: 0 });
  totals.margePct = totals.caSigne > 0 ? Math.round(totals.mbEur / totals.caSigne * 1000) / 10 : 0;

  const pctTemps = Math.min(100, Math.max(0, Math.round((Date.now() - fyStart.getTime()) / (fyEnd.getTime() - fyStart.getTime()) * 100)));
  return { fyStartYear, clients, totals, objTarget: 2300000, pctTemps };
}

/**
 * Médias = tous les projets & devis dont le titre commence par "MED0" (BU Médias),
 * transverses (tous DC), rattachés à l'exercice. Projets → CA/marge ; devis → pipe pondéré.
 */
function buildMedias(fyStartYearParam) {
  const allProjects = loadData('furious_projects')?.data || [];
  const proposals = loadData('furious_proposals')?.data || [];
  const { y: fyStartYear, fyStart, fyEnd } = fyBounds(fyStartYearParam);
  const isMed = t => /^MED0/i.test((t || '').trim());

  const projects = allProjects.filter(p => isMed(p.title)).map(p => {
    const startDate = p.start_date ? new Date(p.start_date) : null;
    const endDate = p.end_date ? new Date(p.end_date) : null;
    const inFY = startDate && endDate ? !(endDate < fyStart || startDate > fyEnd) : true;
    const amt = Number(p.total_amount) || 0;
    const mEur = Number(p.margin) || 0;
    return {
      id: p.id, title: p.title, company_name: p.company_name,
      canonical_client: getCanonicalClientName(p.company_name),
      start_date: p.start_date, end_date: p.end_date, created_at: p.created_at,
      total_amount: amt, marginEur: mEur, margin: amt > 0 ? Math.round(mEur / amt * 1000) / 10 : 0,
      actif: p.actif, advancement: Number(p.advancement) || 0, inFY,
    };
  }).filter(p => p.inFY).sort((a, b) => b.total_amount - a.total_amount);

  const devis = proposals.filter(p => isMed(p.title)).map(p => {
    const pipe = Number(p.pipe);
    const active = pipe >= 0 && pipe < 6 && !p.signature_date
      && !(p.project_id && p.project_id !== '0' && p.project_id !== 0) && p.pipe_name !== 'Perdu';
    const amount = Number(p.amount) || 0, proba = Number(p.probability) || 0;
    const ref = p.projet_stop ? new Date(p.projet_stop) : (p.projet_start ? new Date(p.projet_start) : null);
    const inFY = ref ? !(ref < fyStart || ref > fyEnd) : true;
    return {
      id: p.id, title: p.title, company_name: p.company_name,
      canonical_client: getCanonicalClientName(p.company_name),
      amount, probability: proba, probabilise: amount * proba / 100,
      pipe_name: p.pipe_name, projet_start: p.projet_start, projet_stop: p.projet_stop, active, inFY,
    };
  }).filter(p => p.inFY && p.active).sort((a, b) => b.probabilise - a.probabilise);

  const totals = {
    projectsCount: projects.length,
    caSigne: projects.reduce((s, p) => s + p.total_amount, 0),
    mbEur: projects.reduce((s, p) => s + p.marginEur, 0),
    devisCount: devis.length,
    pipe: devis.reduce((s, p) => s + p.probabilise, 0),
    pipeBrut: devis.reduce((s, p) => s + p.amount, 0),
  };
  totals.margePct = totals.caSigne > 0 ? Math.round(totals.mbEur / totals.caSigne * 1000) / 10 : 0;

  // ── Objectifs CA par client (matrice commerciale médias) ──
  // CA réalisé net (paid déduit au prorata) par client canonique
  const caByClient = {};
  projects.forEach(p => {
    const c = p.canonical_client || p.company_name || 'Inconnu';
    caByClient[c] = (caByClient[c] || 0) + p.total_amount;
  });
  let mediaObjectives = [];
  try { mediaObjectives = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'media_objectives.json'), 'utf8')); } catch (e) {}
  const used = new Set();
  const clientObjectives = [...mediaObjectives].sort((a, b) => a.ranking - b.ranking).map(o => {
    const on = normalize(o.client);
    let matched = Object.keys(caByClient).filter(c => !used.has(c) && normalize(c) === on);
    if (!matched.length && on.length >= 4) matched = Object.keys(caByClient).filter(c => !used.has(c) && (normalize(c).includes(on) || on.includes(normalize(c))));
    matched.forEach(c => used.add(c));
    const ca = matched.reduce((s, c) => s + caByClient[c], 0);
    return { ranking: o.ranking, tiering: o.tiering, client: o.client, target: o.target, ca, pct: o.target > 0 ? Math.round(ca / o.target * 100) : null };
  });
  // Clients médias avec CA mais hors matrice objectifs
  const autresCA = Object.entries(caByClient).filter(([c]) => !used.has(c) && caByClient[c] > 0)
    .map(([client, ca]) => ({ client, ca })).sort((a, b) => b.ca - a.ca);
  const objTargetTotal = mediaObjectives.reduce((s, o) => s + (o.target || 0), 0);
  const objCaTotal = clientObjectives.reduce((s, o) => s + o.ca, 0);

  const pctTemps = Math.min(100, Math.max(0, Math.round((Date.now() - fyStart.getTime()) / (fyEnd.getTime() - fyStart.getTime()) * 100)));
  return { fyStartYear, projects, devis, totals, clientObjectives, autres: autresCA, objTargetTotal, objCaTotal, objTarget: 1200000, pctTemps };
}

/**
 * Récap mensuel des mouvements par DC : projets signés (créés dans le mois),
 * devis créés et devis perdus dans le mois. Pour les points mensuels avec les DC.
 */
function buildMonthlyRecap(monthParam) {
  const allProjects = loadData('furious_projects')?.data || [];
  const proposals = loadData('furious_proposals')?.data || [];
  const achatsMediasByProject = loadData('furious_achats_medias')?.data || {};

  const now = new Date();
  const month = /^\d{4}-\d{2}$/.test(monthParam || '') ? monthParam : now.toISOString().slice(0, 7);
  // Exercice fiscal du mois (démarre le 01/07) → pour résoudre l'assignation client datée
  const mY = Number(month.slice(0, 4)), mM = Number(month.slice(5, 7));
  const recapFy = mM >= 7 ? mY : mY - 1;
  const clientAssignments = assign.getAllClientAssignments(recapFy);
  const projectAssignments = assign.getAllProjectAssignments();
  const proposalAssignments = assign.getAllProposalAssignments();
  const inMonth = (d) => !!d && String(d).slice(0, 7) === month;

  const clientDC = (companyName) => {
    if (!companyName) return null;
    const nc = normalize(companyName);
    const k = Object.keys(clientAssignments).find(kk => normalize(kk) === nc);
    return k ? clientAssignments[k] : null;
  };
  const dcsOfProject = (p) => {
    const a = projectAssignments[p.id]; if (a && a.length) return a;
    const c = clientDC(p.company_name); return c ? [c] : ['A assigner'];
  };
  const dcsOfProposal = (p) => {
    const a = proposalAssignments[p.id]; if (a && a.length) return a;
    const c = clientDC(p.company_name); return c ? [c] : ['A assigner'];
  };

  const byDC = {};
  const ensure = (dc) => (byDC[dc] = byDC[dc] || { signes: [], devisCrees: [], devisPerdus: [] });

  // Projets signés = créés dans le mois (hors médias/internes)
  allProjects.forEach(p => {
    if (shouldExcludeProject(p)) return;
    if (!inMonth(p.created_at)) return;
    const amt = Number(p.total_amount) || 0;
    const net = Math.max(0, amt - (achatsMediasByProject[String(p.id)] || 0));
    const row = { id: p.id, title: p.title, client: getCanonicalClientName(p.company_name), amount: net, margin: Number(p.margin) || 0, created_at: p.created_at };
    dcsOfProject(p).forEach(dc => ensure(dc).signes.push(row));
  });

  // Devis créés / perdus dans le mois
  proposals.forEach(p => {
    if (/^M0|^MED0/i.test((p.title || '').trim())) return; // médias à part
    const amount = Number(p.amount) || 0, proba = Number(p.probability) || 0;
    const base = { id: p.id, title: p.title, client: getCanonicalClientName(p.company_name), amount, probability: proba, probabilise: amount * proba / 100, pipe_name: p.pipe_name };
    if (inMonth(p.created_at)) {
      const row = { ...base, date: String(p.created_at).slice(0, 10) };
      dcsOfProposal(p).forEach(dc => ensure(dc).devisCrees.push(row));
    }
    if (p.pipe_name === 'Perdu' && inMonth(p.last_updated_at || p.created_at)) {
      const row = { ...base, date: String(p.last_updated_at || p.created_at).slice(0, 10) };
      dcsOfProposal(p).forEach(dc => ensure(dc).devisPerdus.push(row));
    }
  });

  // Tri + totaux par DC
  for (const dc of Object.keys(byDC)) {
    const b = byDC[dc];
    b.signes.sort((a, z) => z.amount - a.amount);
    b.devisCrees.sort((a, z) => z.amount - a.amount);
    b.devisPerdus.sort((a, z) => z.amount - a.amount);
    b.totals = {
      signesCount: b.signes.length, signesCA: b.signes.reduce((s, x) => s + x.amount, 0),
      devisCreesCount: b.devisCrees.length, devisCreesMontant: b.devisCrees.reduce((s, x) => s + x.amount, 0),
      devisPerdusCount: b.devisPerdus.length, devisPerdusMontant: b.devisPerdus.reduce((s, x) => s + x.amount, 0),
    };
  }
  return { month, byDC };
}

/**
 * Heatmap des clients : objectif + CA réalisé + typologie (CRM) + avancement vs temps
 * écoulé dans l'exercice. Vert = en avance, rouge = en retard. Filtrable DC / typologie.
 */
const SECTOR_LABELS = {
  c01_annonceur: 'Annonceur', c02_institution: 'Institution', c03_equipementier: 'Équipementier',
  c04_distributeur: 'Distributeur', c05_plateforme: 'Plateforme', c06_agence_de_com: 'Agence',
  c07_detenteur: 'Détenteur', c10_freelance: 'Freelance',
};
function buildHeatmap(fyStartYearParam) {
  const portfolios = buildDCPortfolios(fyStartYearParam);
  const crm = loadData('furious_crm')?.data || [];
  const { y: fyStartYear, fyStart, fyEnd } = fyBounds(fyStartYearParam);
  const nowMs = Date.now();
  const pctTemps = Math.min(100, Math.max(0, Math.round((nowMs - fyStart.getTime()) / (fyEnd.getTime() - fyStart.getTime()) * 100)));

  // Référentiel manuel de typologies (prioritaire) : { typologie: [motifs] }
  let typoRef = {};
  try { typoRef = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'client_typologies.json'), 'utf8')); } catch (e) {}
  // Secteur CRM (fallback) par société normalisée — clients uniquement (préfixe c0)
  const sectorByCompany = {};
  crm.forEach(c => {
    const co = normalize(c.company); const s = (c.sector || '').trim();
    if (co && /^c\d/.test(s) && !sectorByCompany[co]) sectorByCompany[co] = s;
  });
  const typoOf = (name, canonicalNames) => {
    const text = normalize([name, ...(canonicalNames || [])].join(' '));
    const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
    // 1) Référentiel manuel : mots multiples par includes, mot seul par mot entier
    for (const [label, patterns] of Object.entries(typoRef)) {
      for (const pat of (patterns || [])) {
        const p = normalize(pat).trim();
        if (!p) continue;
        if (p.includes(' ')) { if (text.includes(p)) return label; }
        else if (p.length >= 3 && words.has(p)) return label;
      }
    }
    // 2) Fallback CRM sector
    const cands = [name, ...(canonicalNames || [])].map(normalize).filter(Boolean);
    for (const nc of cands) if (sectorByCompany[nc]) return SECTOR_LABELS[sectorByCompany[nc]] || 'Autre';
    for (const nc of cands) {
      const k = Object.keys(sectorByCompany).find(kk => kk.length >= 4 && (kk.includes(nc) || nc.includes(kk)));
      if (k) return SECTOR_LABELS[sectorByCompany[k]] || 'Autre';
    }
    return 'Autre';
  };

  const clients = [];
  Object.entries(portfolios).forEach(([dc, p]) => {
    if (dc === 'A assigner') return;
    (p.objectives || []).filter(o => o.client !== '_BIZ_DEV' && (o.target || 0) > 0).forEach(o => {
      const ca = o.actual || 0, obj = o.target;
      clients.push({ client: o.client, dc, objectif: obj, ca, pctRealise: Math.round(ca / obj * 100), typologie: typoOf(o.client, o.canonicalNames) });
    });
  });
  clients.sort((a, b) => b.objectif - a.objectif);
  const typologies = [...new Set(clients.map(c => c.typologie))].sort();
  const dcs = [...new Set(clients.map(c => c.dc))].sort();
  return { fyStartYear, pctTemps, clients, typologies, dcs };
}

// ── Routes: Health ───────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok', app: 'spk-dc' }));

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', app: 'spk-dc', sync: syncState,
    dataAvailable: {
      projects: !!loadData('furious_projects'), sprints: !!loadData('furious_sprints'),
      proposals: !!loadData('furious_proposals'), lucca: !!loadData('lucca'),
    },
  });
});

// ── Routes: Auth ─────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Login et mot de passe requis' });
  try {
    const result = auth.login(login, password);
    if (result.error) return res.status(401).json(result);
    res.json(result);
  } catch (e) {
    console.error('[Login] Erreur:', e.message);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

app.get('/api/auth/me', auth.authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ── Routes: Sync ─────────────────────────────────────────

app.post('/api/sync', auth.authMiddleware, auth.adminOnly, async (req, res) => {
  res.json({ message: 'Sync demarree' });
  syncFurious().then(() => syncLucca());
});

app.post('/api/sync/furious', auth.authMiddleware, auth.adminOnly, async (req, res) => {
  res.json({ message: 'Sync Furious demarree' });
  syncFurious();
});

app.post('/api/sync/lucca', auth.authMiddleware, auth.adminOnly, async (req, res) => {
  res.json({ message: 'Sync Lucca demarree' });
  syncLucca();
});

app.get('/api/sync/status', auth.authMiddleware, (req, res) => res.json(syncState));

// ── Routes: Portfolio ────────────────────────────────────

// Directeurs commerciaux : accès équipe complet (comme un admin) sur le pilotage.
const DIRECTORS = new Set(['Paul']);
const isDirector = (user) => DIRECTORS.has(user?.furiousName) || DIRECTORS.has(user?.name);

app.get('/api/data/portfolio', auth.authMiddleware, (req, res) => {
  const fyParam = parseInt(req.query.fy, 10);
  const fyStartYear = Number.isInteger(fyParam) ? fyParam : undefined;
  const portfolios = buildDCPortfolios(fyStartYear);

  if (req.user.role === 'admin' || isDirector(req.user)) {
    return res.json({ portfolios, dcList: Object.keys(portfolios) });
  }

  // DC sees only their portfolio
  const furiousName = req.user.furiousName;
  if (!furiousName) {
    return res.status(400).json({ error: 'Pas de nom configure pour ce compte. Contactez un admin.' });
  }

  const myKey = Object.keys(portfolios).find(k => normalize(k) === normalize(furiousName));
  if (!myKey) {
    return res.json({ myPortfolio: null, message: 'Aucun portefeuille trouve' });
  }

  res.json({ myPortfolio: portfolios[myKey] });
});

// Biz Dev — nouveaux clients (transverse). Admin + directeur uniquement.
app.get('/api/data/biz-dev', auth.authMiddleware, (req, res) => {
  if (!(req.user.role === 'admin' || isDirector(req.user))) {
    return res.status(403).json({ error: 'Acces reserve' });
  }
  const fyParam = parseInt(req.query.fy, 10);
  res.json(buildBizDev(Number.isInteger(fyParam) ? fyParam : undefined));
});

// Récap mensuel des mouvements par DC (signés / devis créés / perdus).
app.get('/api/data/monthly-recap', auth.authMiddleware, (req, res) => {
  res.json(buildMonthlyRecap(req.query.month));
});

// Heatmap des objectifs clients (transverse).
app.get('/api/data/heatmap', auth.authMiddleware, (req, res) => {
  if (!(req.user.role === 'admin' || isDirector(req.user))) return res.status(403).json({ error: 'Acces reserve' });
  const fyParam = parseInt(req.query.fy, 10);
  res.json(buildHeatmap(Number.isInteger(fyParam) ? fyParam : undefined));
});

// Médias — projets & devis MED0 (transverse). Admin + directeur uniquement.
app.get('/api/data/medias', auth.authMiddleware, (req, res) => {
  if (!(req.user.role === 'admin' || isDirector(req.user))) {
    return res.status(403).json({ error: 'Acces reserve' });
  }
  const fyParam = parseInt(req.query.fy, 10);
  res.json(buildMedias(Number.isInteger(fyParam) ? fyParam : undefined));
});

// Farming — board éditable (concepts + événements) d'un DC, persistant sur le volume.
app.get('/api/data/farming', auth.authMiddleware, (req, res) => {
  const dc = req.query.dc || 'Hadrien';
  res.json({ dc, clients: farming.getDC(dc) });
});

app.put('/api/data/farming', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const { dc, client, data } = req.body;
  if (!dc || !client || !data) return res.status(400).json({ error: 'dc, client, data requis' });
  res.json({ success: true, client: farming.saveClient(dc, client, data) });
});

// ── Routes: Assignments (admin) ──────────────────────────

app.get('/api/admin/assignments/clients', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const fy = parseInt(req.query.fy, 10);
  const fyStartYear = Number.isInteger(fy) ? fy : undefined;
  res.json({ assignments: assign.getAllClientAssignments(fyStartYear), detail: assign.getClientAssignmentDetail(fyStartYear), dcs: assign.getActiveDCs() });
});

app.put('/api/admin/assignments/client', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const { clientName, dcName, fyStartYear, removeOverride } = req.body;
  if (!clientName) return res.status(400).json({ error: 'clientName requis' });
  // fyStartYear fourni → override daté par exercice ; sinon → défaut hérité (legacy)
  assign.assignClient(clientName, dcName || '', fyStartYear != null ? Number(fyStartYear) : undefined, !!removeOverride);
  res.json({ success: true });
});

// Définit/modifie l'objectif CA d'un client pour un DC (exercice donné).
app.put('/api/admin/objectives/client', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const { dc, client, target, fyStartYear, remove } = req.body;
  if (!dc || !client) return res.status(400).json({ error: 'dc, client requis' });
  const now = new Date();
  const fy = String(fyStartYear || (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1));
  const fp = path.join(DATA_DIR, 'objectives.json');
  let data = { objectives: {}, imports: [] };
  try { if (fs.existsSync(fp)) data = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) {}
  data.objectives = data.objectives || {};
  data.objectives[fy] = data.objectives[fy] || {};
  const list = data.objectives[fy][dc] = data.objectives[fy][dc] || [];
  const idx = list.findIndex(o => normalize(o.client) === normalize(client));
  if (remove) {
    if (idx >= 0) list.splice(idx, 1);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    return res.json({ success: true, fy, dc, client, removed: idx >= 0 });
  }
  if (idx >= 0) list[idx].target = Number(target) || 0;
  else list.push({ client, target: Number(target) || 0 });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  res.json({ success: true, fy, dc, client, target: Number(target) || 0 });
});

app.get('/api/admin/assignments/projects', auth.authMiddleware, auth.adminOnly, (req, res) => {
  res.json({ assignments: assign.getAllProjectAssignments(), dcs: assign.getActiveDCs() });
});

app.put('/api/admin/assignments/project', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const { projectId, dcNames } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId requis' });
  assign.assignProject(projectId, dcNames || []);
  res.json({ success: true });
});

app.get('/api/admin/assignments/proposals', auth.authMiddleware, auth.adminOnly, (req, res) => {
  res.json({ assignments: assign.getAllProposalAssignments(), dcs: assign.getActiveDCs() });
});

app.put('/api/admin/assignments/proposal', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const { proposalId, dcNames } = req.body;
  if (!proposalId) return res.status(400).json({ error: 'proposalId requis' });
  assign.assignProposal(proposalId, dcNames || []);
  res.json({ success: true });
});

// List all unique clients from projects (for assignment UI) — exercice-scopé
app.get('/api/admin/all-clients', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const fy = parseInt(req.query.fy, 10);
  const fyStartYear = Number.isInteger(fy) ? fy : undefined;
  const projectsData = loadData('furious_projects');
  const allProjects = projectsData?.data || [];
  const agencyProjects = allProjects.filter(p => !shouldExcludeProject(p));
  const clientNames = [...new Set(agencyProjects.map(p => p.company_name).filter(Boolean))].sort();
  const detail = assign.getClientAssignmentDetail(fyStartYear);
  const detailKeys = Object.keys(detail);

  const clients = clientNames.map(name => {
    const normName = normalize(name);
    const matchKey = detailKeys.find(k => normalize(k) === normName);
    const d = matchKey ? detail[matchKey] : null;
    return { name, dc: d ? d.dc : '', dcSource: d ? d.source : '' };
  });

  res.json({ clients, fyStartYear: fyStartYear ?? null, dcs: assign.getActiveDCs() });
});

// List all agency projects (for assignment UI)
app.get('/api/admin/all-projects', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const projectsData = loadData('furious_projects');
  const allProjects = projectsData?.data || [];
  const agencyProjects = allProjects.filter(p => !shouldExcludeProject(p));
  const projectAssignments = assign.getAllProjectAssignments();

  // Fiscal year filter — depuis ?fy sinon exercice courant
  const now = new Date();
  const fyParam = parseInt(req.query.fy, 10);
  const fyStartYear = Number.isInteger(fyParam) ? fyParam : (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);
  const clientAssignments = assign.getAllClientAssignments(fyStartYear);
  const fyStart = new Date(fyStartYear, 6, 1);
  const fyEnd = new Date(fyStartYear + 1, 5, 30);

  const list = agencyProjects
    .filter(p => {
      const s = p.start_date ? new Date(p.start_date) : null;
      const e = p.end_date ? new Date(p.end_date) : null;
      if (s && e) return !(e < fyStart || s > fyEnd);
      return true;
    })
    .map(p => {
      // Determine assigned DCs
      const projDCs = projectAssignments[p.id];
      let assignedDCs = projDCs && projDCs.length > 0 ? projDCs : null;
      if (!assignedDCs && p.company_name) {
        const normClient = normalize(p.company_name);
        const matchKey = Object.keys(clientAssignments).find(k => normalize(k) === normClient);
        if (matchKey && clientAssignments[matchKey]) assignedDCs = [clientAssignments[matchKey]];
      }
      return {
        id: p.id, title: p.title, company_name: p.company_name,
        total_amount: Number(p.total_amount) || 0, actif: p.actif,
        assignedDCs: assignedDCs || [], source: projDCs?.length ? 'project' : (assignedDCs ? 'client' : 'none'),
      };
    });

  res.json({ projects: list, dcs: assign.getActiveDCs() });
});

// List all active devis en cours (for assignment UI)
app.get('/api/admin/all-proposals', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const proposalsData = loadData('furious_proposals');
  const allProposals = proposalsData?.data || [];
  const proposalAssignments = assign.getAllProposalAssignments();

  // Fin d'exercice (30 juin) pour couper le pipeline — depuis ?fy sinon exercice courant
  const now = new Date();
  const fyParam = parseInt(req.query.fy, 10);
  const fyStartYear = Number.isInteger(fyParam) ? fyParam : (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);
  const clientAssignments = assign.getAllClientAssignments(fyStartYear);
  const FY_END = new Date(fyStartYear + 1, 5, 30);

  // Même filtre que activePipeline : devis en cours, hors médias / perdus / convertis
  const list = allProposals
    .filter(p => {
      const pipe = Number(p.pipe);
      if (!(pipe >= 0 && pipe < 6 && !p.signature_date)) return false;
      if (p.project_id && p.project_id !== '0' && p.project_id !== 0) return false;
      if (p.pipe_name === 'Perdu') return false;
      if (p.entity && p.entity !== 'spk') return false;
      const title = (p.title || '').trim();
      if (/^M0/i.test(title) || /^MED0/i.test(title)) return false;
      // Inclure si la prod démarre sur l'exercice courant (start <= 30/06),
      // même si elle se termine sur l'exercice suivant.
      if (p.projet_start) {
        const start = new Date(p.projet_start);
        if (start > FY_END) return false;
      }
      return true;
    })
    .map(p => {
      // Determine assigned DCs (explicit > client)
      const propDCs = proposalAssignments[p.id];
      let assignedDCs = propDCs && propDCs.length > 0 ? propDCs : null;
      if (!assignedDCs && p.company_name) {
        const normClient = normalize(p.company_name);
        const matchKey = Object.keys(clientAssignments).find(k => normalize(k) === normClient);
        if (matchKey && clientAssignments[matchKey]) assignedDCs = [clientAssignments[matchKey]];
      }
      return {
        id: p.id, title: p.title, company_name: p.company_name,
        amount: Number(p.amount) || 0, probability: Number(p.probability) || 0,
        pipe_name: p.pipe_name,
        assignedDCs: assignedDCs || [], source: propDCs?.length ? 'proposal' : (assignedDCs ? 'client' : 'none'),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  res.json({ proposals: list, dcs: assign.getActiveDCs() });
});

// ── Routes: Objectives ───────────────────────────────────

app.get('/api/data/objectives', auth.authMiddleware, (req, res) => {
  const fyParam = parseInt(req.query.fy, 10);
  const fy = Number.isInteger(fyParam) ? fyParam : undefined;
  if (req.user.role === 'admin') {
    return res.json({ objectives: objectives.getAllObjectives(fy), imports: objectives.getImportHistory() });
  }
  const myObjectives = objectives.getObjectivesForDC(req.user.furiousName || req.user.name, fy);
  res.json({ objectives: myObjectives });
});

app.post('/api/admin/objectives/import', auth.authMiddleware, auth.adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const result = objectives.importCSV(req.file.buffer.toString('utf8'), req.user.name);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// ── Routes: Pilotage commercial / Activité hebdo ─────────

// Lecture : admin → toutes les saisies ; DC → uniquement les siennes.
app.get('/api/data/activity', auth.authMiddleware, (req, res) => {
  const currentWeek = activity.currentWeek();
  if (req.user.role === 'admin') {
    return res.json({ activity: activity.getAllActivity(), currentWeek });
  }
  const myName = req.user.furiousName || req.user.name;
  res.json({ activity: { [myName]: activity.getDCActivity(myName) }, currentWeek, myName });
});

// Saisie : un DC ne peut écrire que sa propre semaine ; un admin peut saisir pour n'importe quel DC (body.dc).
app.put('/api/data/activity', auth.authMiddleware, (req, res) => {
  const { dc, week, leads, rdv, briefs, note } = req.body || {};
  const dcName = req.user.role === 'admin' ? (dc || req.user.furiousName) : (req.user.furiousName || req.user.name);
  if (!dcName) return res.status(400).json({ error: 'DC non identifié' });
  const result = activity.upsertEntry(dcName, week, { leads, rdv, briefs, note });
  if (result.error) return res.status(400).json(result);
  res.json({ dc: dcName, ...result });
});

// Portefeuille prospects du directeur commercial (objectifs par prospect)
app.get('/api/data/director-prospects', auth.authMiddleware, (req, res) => {
  const fp = path.join(DATA_DIR, 'director_prospects.json');
  try {
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const total = (data.prospects || []).reduce((s, p) => s + (p.objectif || 0), 0);
      return res.json({ ...data, total });
    }
  } catch (e) { console.error('[DirectorProspects] Error:', e.message); }
  res.json({ prospects: [], total: 0 });
});

// Dernier snapshot de pipe (répartition par statut : Proactif / Reco / Brief en attente…)
app.get('/api/data/pipe-stages', auth.authMiddleware, (req, res) => {
  const snapDir = path.join(DATA_DIR, '_pipe_snapshots');
  let snapshot = null;
  try {
    if (fs.existsSync(snapDir)) {
      const files = fs.readdirSync(snapDir)
        .filter(f => f.startsWith('pipe_') && f.endsWith('.json')).sort();
      if (files.length) snapshot = JSON.parse(fs.readFileSync(path.join(snapDir, files[files.length - 1]), 'utf8'));
    }
  } catch (e) { console.error('[PipeStages] Error:', e.message); }
  res.json({ snapshot });
});

// ── Routes: Admin - Users ────────────────────────────────

app.get('/api/admin/users', auth.authMiddleware, auth.adminOnly, (req, res) => {
  res.json({ users: auth.getUsers() });
});

app.post('/api/admin/users', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const result = auth.createUser(req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/admin/users/:id', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const result = auth.updateUser(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/admin/users/:id', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const result = auth.deleteUser(req.params.id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// ── Routes: Raw data (admin) ─────────────────────────────

app.get('/api/data/furious/:endpoint', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const map = {
    projects: 'furious_projects', 'project-kpis': 'furious_project_kpis',
    proposals: 'furious_proposals', crm: 'furious_crm',
    invoices: 'furious_invoices', sprints: 'furious_sprints',
    purchases: 'furious_purchases',
  };
  const key = map[req.params.endpoint];
  if (!key) return res.status(404).json({ error: 'Endpoint inconnu' });
  res.json(loadData(key) || { data: [], syncDate: null });
});

app.get('/api/data/lucca', auth.authMiddleware, (req, res) => {
  res.json(loadData('lucca') || { data: [], syncDate: null });
});

// ── SPA fallback ─────────────────────────────────────────

if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Cron ─────────────────────────────────────────────────

// Sync matinale : données fraîches dès le début de journée (jours ouvrés et week-end)
cron.schedule('0 7 * * *', () => { console.log('[Cron] 07:00 — Furious sync (matin)'); syncFurious(); }, { timezone: 'Europe/Paris' });
cron.schedule('0 20 * * *', () => { console.log('[Cron] 20:00 — Lucca sync'); syncLucca(); }, { timezone: 'Europe/Paris' });
cron.schedule('0 21 * * *', () => { console.log('[Cron] 21:00 — Furious sync (soir)'); syncFurious(); }, { timezone: 'Europe/Paris' });

// ── Startup ──────────────────────────────────────────────

auth.initDefaultUsers();

app.listen(PORT, () => {
  console.log(`\n[SPK DC] Server running on port ${PORT}`);
  console.log(`[SPK DC] Client assignments: ${Object.keys(assign.getAllClientAssignments()).length}`);
  console.log(`[SPK DC] Active DCs: ${assign.getActiveDCs().join(', ')}`);

  // Contrôle de fraîcheur au démarrage : Railway a un filesystem éphémère,
  // donc après chaque redéploiement/réveil on repart du seed committé.
  // Si les données ont plus de STALE_HOURS, on resync immédiatement (en fond)
  // pour ne jamais servir des chiffres périmés, même si le cron du soir a été manqué.
  const STALE_HOURS = Number(process.env.STALE_HOURS) || 18;
  const cached = loadData('furious_sprints');
  const ageH = cached?.syncDate ? (Date.now() - new Date(cached.syncDate).getTime()) / 36e5 : Infinity;
  if (!cached) {
    console.log('[SPK DC] No cached data, starting initial sync...');
    syncFurious().then(() => syncLucca());
  } else if (ageH > STALE_HOURS) {
    console.log(`[SPK DC] Cached data is ${ageH.toFixed(1)}h old (> ${STALE_HOURS}h) — refreshing in background...`);
    syncFurious().then(() => syncLucca());
  } else {
    console.log(`[SPK DC] Cached data is fresh (${ageH.toFixed(1)}h) — skipping initial sync`);
  }
});

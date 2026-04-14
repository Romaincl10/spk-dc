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
const { getCanonicalClientName, getCanonicalClientNameForProject } = require('./clientGroups.cjs');

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3002;
const DATA_DIR = path.join(__dirname, 'data');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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

function loadObjectivesForDC(dcName) {
  try {
    const fp = path.join(DATA_DIR, 'objectives.json');
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      return data.objectives?.[dcName] || [];
    }
  } catch (e) {}
  return [];
}

// ── Portfolio builder (assignment-based) ─────────────────

function buildDCPortfolios() {
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
  const achatsMediasByProject = achatsMediasData?.data || {};

  const clientAssignments = assign.getAllClientAssignments();
  const projectAssignments = assign.getAllProjectAssignments();

  // Fiscal year
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
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

  // Enrich all projects
  const enrichedAll = agencyProjects.map(p => {
    const k = kpiMap[p.id] || {};
    const sp = sprintMap[String(p.id)] || { fait: 0, planifie: 0 };
    const startDate = p.start_date ? new Date(p.start_date) : null;
    const endDate = p.end_date ? new Date(p.end_date) : null;
    const inFY = startDate && endDate ? !(endDate < fyStart || startDate > fyEnd) : true;
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

  // Map project_id → canonical client (for invoice bucketing)
  const projectToCanonical = {};
  enrichedAll.forEach(p => { projectToCanonical[String(p.id)] = p.canonical_client || p.company_name; });

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

  // Build portfolio per DC
  const portfolios = {};
  for (const [dcName, group] of Object.entries(dcGroups)) {
    const projectsList = group.projects;
    const clientNames = [...group.clientSet];
    const projectIds = projectsList.map(p => p.id);

    // Proposals for these clients
    const dcProposals = proposals.filter(p =>
      clientNames.some(cn => normalize(p.company_name) === normalize(cn))
    );
    // Invoices & purchases for these projects
    const dcInvoices = invoices.filter(inv => projectIds.includes(inv.project_id));
    const dcPurchases = purchases.filter(pu => projectIds.includes(pu.project_id));

    // KPIs (fiscal year only)
    const fyProjects = projectsList.filter(p => p.inFY);
    // CA basé sur le total_amount des projets (montant contracté, indépendant des dates de facturation)
    const caTotal = fyProjects.reduce((s, p) => s + p.total_amount, 0);
    const mbTotal = fyProjects.reduce((s, p) => s + (p.marginEur || 0), 0);
    const margins = fyProjects.filter(p => p.margin > 0).map(p => p.margin);
    const margeBruteMoy = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : 0;
    const margeBrutePct = caTotal > 0 ? Math.round(mbTotal / caTotal * 1000) / 10 : 0;

    // Bornes FY pour filtrage factures (chart mensuel uniquement)
    const fyStartDate = new Date(fyStartYear, 6, 1);
    const fyEndDate = new Date(fyStartYear + 1, 5, 30, 23, 59, 59);
    // Exclure les factures annulées ET les factures planifiées (id=0, invoice_date='0000-00-00')
    const validInvoices = dcInvoices.filter(inv =>
      !inv.is_cancelled &&
      inv.statut !== 'cancelled' &&
      String(inv.id) !== '0' &&
      inv.invoice_date &&
      inv.invoice_date !== '0000-00-00'
    );
    const projetsActifs = fyProjects.filter(p => p.actif === '1' || p.actif === 1).length;
    const totalSold = fyProjects.reduce((s, p) => s + p.time_sold_days, 0);
    const totalSpent = fyProjects.reduce((s, p) => s + p.time_spent_days, 0);

    const FY_END = new Date(fyStartYear + 1, 5, 30); // 30 juin fin exercice
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
      // Couper au 30/06 fin d'exercice
      if (p.projet_stop) {
        const stop = new Date(p.projet_stop);
        if (stop > FY_END) return false;
      }
      return true;
    });
    const pipelineTotal = activePipeline.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pipelineProbabilise = activePipeline.reduce((s, p) =>
      s + (Number(p.amount) || 0) * (Number(p.probability) || 0) / 100, 0);

    const caFacture = validInvoices.filter(inv => {
      if (!inv.invoice_date) return false;
      return new Date(inv.invoice_date) <= now;
    }).reduce((s, inv) => s + (Number(inv.amount_ht) || 0), 0);

    // Build client breakdown with canonical names + pipeline per client (CA = project-based)
    const clientMap = {};
    fyProjects.forEach(p => {
      const canonical = p.canonical_client || p.company_name || 'Inconnu';
      if (!clientMap[canonical]) clientMap[canonical] = { name: canonical, ca: 0, mb: 0, pipe: 0, pipeProbabilise: 0, projects: [] };
      clientMap[canonical].ca += p.total_amount;
      clientMap[canonical].mb += p.marginEur || 0;
      clientMap[canonical].projects.push(p);
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

    // Monthly invoice CA per canonical client (FY dates only): split past (facturé) vs future (planifié)
    validInvoices.forEach(inv => {
      const canonical = projectToCanonical[String(inv.project_id)];
      if (!canonical || !clientMap[canonical]) return;
      if (!inv.invoice_date) return;
      const d = new Date(inv.invoice_date);
      if (d < fyStartDate || d > fyEndDate) return; // exclude invoices outside FY
      const month = inv.invoice_date.substring(0, 7);
      const isPast = d <= now;
      if (isPast) {
        if (!clientMap[canonical].monthlyInvoiceCA) clientMap[canonical].monthlyInvoiceCA = {};
        clientMap[canonical].monthlyInvoiceCA[month] = (clientMap[canonical].monthlyInvoiceCA[month] || 0) + (Number(inv.amount_ht) || 0);
      } else {
        if (!clientMap[canonical].monthlyInvoicePlan) clientMap[canonical].monthlyInvoicePlan = {};
        clientMap[canonical].monthlyInvoicePlan[month] = (clientMap[canonical].monthlyInvoicePlan[month] || 0) + (Number(inv.amount_ht) || 0);
      }
    });
    Object.values(clientMap).forEach(c => {
      if (!c.monthlyInvoiceCA) c.monthlyInvoiceCA = {};
      if (!c.monthlyInvoicePlan) c.monthlyInvoicePlan = {};
    });

    const clientBreakdown = Object.values(clientMap).sort((a, b) => (b.ca + b.pipeProbabilise) - (a.ca + a.pipeProbabilise));

    // Load objectives for this DC
    const objData = loadObjectivesForDC(dcName);

    // Enrich objectives with actual values from clientBreakdown
    // Use getCanonicalClientName() on both sides to ensure robust matching
    // (e.g. "Intersport" → "INTERSPORT FRANCE" matches clientBreakdown canonical name)
    const enrichedObjectives = objData.map(obj => {
      if (obj.client === '_BIZ_DEV') {
        // Biz Dev = CA from clients NOT explicitly targeted by an objective
        const objCanonicalNames = objData
          .filter(o => o.client !== '_BIZ_DEV')
          .map(o => getCanonicalClientName(o.client));
        const bizDevClients = clientBreakdown.filter(c => !objCanonicalNames.includes(c.name));
        const bizDevCA = bizDevClients.reduce((s, c) => s + c.ca, 0);
        const bizDevPipe = bizDevClients.reduce((s, c) => s + (c.pipeProbabilise || 0), 0);
        // Expose individual clients so frontend can show them one by one
        const clients = bizDevClients
          .filter(c => c.ca > 0 || (c.pipeProbabilise || 0) > 0)
          .map(c => ({ client: c.name, actual: c.ca, pipe: c.pipeProbabilise || 0 }));
        return { ...obj, actual: bizDevCA, pipe: bizDevPipe, clients, progress: obj.target > 0 ? Math.round(bizDevCA / obj.target * 100) : 0 };
      }
      const canonicalObj = getCanonicalClientName(obj.client);
      const match = clientBreakdown.find(c => c.name === canonicalObj);
      const actual = match ? match.ca : 0;
      const pipe = match ? match.pipeProbabilise : 0;
      return { ...obj, actual, pipe, progress: obj.target > 0 ? Math.round(actual / obj.target * 100) : (actual > 0 ? 100 : 0) };
    });

    // Total objective
    const totalObjTarget = enrichedObjectives.filter(o => o.client !== '_BIZ_DEV').reduce((s, o) => s + o.target, 0);
    const totalObjActual = enrichedObjectives.filter(o => o.client !== '_BIZ_DEV').reduce((s, o) => s + o.actual, 0);

    // Projets et devis récents (2 derniers mois basé sur created_at)
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsAgoStr = twoMonthsAgo.toISOString().split('T')[0];
    const recentProjects = projectsList.filter(p => p.created_at && p.created_at >= twoMonthsAgoStr)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    // All proposals for DC clients (not just active pipeline) for recent devis
    const allDcProposals = proposals.filter(p =>
      clientNames.some(cn => normalize(p.company_name) === normalize(cn))
    );
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

    portfolios[dcName] = {
      dcName,
      projects: projectsList,
      proposals: dcProposals,
      invoices: dcInvoices,
      purchases: dcPurchases,
      clients: clientNames,
      clientBreakdown,
      objectives: enrichedObjectives,
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

  return portfolios;
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
  const result = auth.login(login, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
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

app.get('/api/data/portfolio', auth.authMiddleware, (req, res) => {
  const portfolios = buildDCPortfolios();

  if (req.user.role === 'admin') {
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

// ── Routes: Assignments (admin) ──────────────────────────

app.get('/api/admin/assignments/clients', auth.authMiddleware, auth.adminOnly, (req, res) => {
  res.json({ assignments: assign.getAllClientAssignments(), dcs: assign.getActiveDCs() });
});

app.put('/api/admin/assignments/client', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const { clientName, dcName } = req.body;
  if (!clientName) return res.status(400).json({ error: 'clientName requis' });
  assign.assignClient(clientName, dcName || '');
  res.json({ success: true });
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

// List all unique clients from projects (for assignment UI)
app.get('/api/admin/all-clients', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const projectsData = loadData('furious_projects');
  const allProjects = projectsData?.data || [];
  const agencyProjects = allProjects.filter(p => !shouldExcludeProject(p));
  const clientNames = [...new Set(agencyProjects.map(p => p.company_name).filter(Boolean))].sort();
  const assignments = assign.getAllClientAssignments();

  const clients = clientNames.map(name => {
    const normName = normalize(name);
    const matchKey = Object.keys(assignments).find(k => normalize(k) === normName);
    return { name, dc: matchKey ? assignments[matchKey] : '' };
  });

  res.json({ clients, dcs: assign.getActiveDCs() });
});

// List all agency projects (for assignment UI)
app.get('/api/admin/all-projects', auth.authMiddleware, auth.adminOnly, (req, res) => {
  const projectsData = loadData('furious_projects');
  const allProjects = projectsData?.data || [];
  const agencyProjects = allProjects.filter(p => !shouldExcludeProject(p));
  const projectAssignments = assign.getAllProjectAssignments();
  const clientAssignments = assign.getAllClientAssignments();

  // Fiscal year filter
  const now = new Date();
  const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
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

// ── Routes: Objectives ───────────────────────────────────

app.get('/api/data/objectives', auth.authMiddleware, (req, res) => {
  if (req.user.role === 'admin') {
    return res.json({ objectives: objectives.getAllObjectives(), imports: objectives.getImportHistory() });
  }
  const myObjectives = objectives.getObjectivesForDC(req.user.furiousName || req.user.name);
  res.json({ objectives: myObjectives });
});

app.post('/api/admin/objectives/import', auth.authMiddleware, auth.adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const result = objectives.importCSV(req.file.buffer.toString('utf8'), req.user.name);
  if (result.error) return res.status(400).json(result);
  res.json(result);
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

cron.schedule('0 20 * * *', () => { console.log('[Cron] 20:00 — Lucca sync'); syncLucca(); }, { timezone: 'Europe/Paris' });
cron.schedule('0 21 * * *', () => { console.log('[Cron] 21:00 — Furious sync'); syncFurious(); }, { timezone: 'Europe/Paris' });

// ── Startup ──────────────────────────────────────────────

auth.initDefaultUsers();

app.listen(PORT, () => {
  console.log(`\n[SPK DC] Server running on port ${PORT}`);
  console.log(`[SPK DC] Client assignments: ${Object.keys(assign.getAllClientAssignments()).length}`);
  console.log(`[SPK DC] Active DCs: ${assign.getActiveDCs().join(', ')}`);

  if (!loadData('furious_sprints')) {
    console.log('[SPK DC] No cached data, starting initial sync...');
    syncFurious().then(() => syncLucca());
  } else {
    console.log('[SPK DC] Cached data found, skipping initial sync');
  }
});

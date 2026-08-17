/**
 * SPK DC — Module Assignations
 * Gestion des assignations client→DC et projet→DC
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR ? require('path').resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const CLIENT_FILE = path.join(DATA_DIR, 'client_assignments.json');
const PROJECT_FILE = path.join(DATA_DIR, 'project_assignments.json');
const PROPOSAL_FILE = path.join(DATA_DIR, 'proposal_assignments.json');

// ── Client assignments ───────────────────────────────────

const _norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Exercice fiscal courant (démarre le 01/07)
function currentFyStartYear() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

function loadClientAssignments() {
  try {
    if (fs.existsSync(CLIENT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8'));
      if (!data.assignments) data.assignments = {};
      if (!data.byYear) data.byYear = {};
      return data;
    }
  } catch (e) { console.error('[Assignments] Error loading clients:', e.message); }
  return { assignments: {}, byYear: {}, updatedAt: null };
}

function saveClientAssignments(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(CLIENT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Map effective { client: dc } pour un exercice : défaut hérité + overrides de l'exercice.
function effectiveClientMap(data, fyStartYear) {
  const eff = { ...(data.assignments || {}) };
  const yr = data.byYear && data.byYear[String(fyStartYear ?? currentFyStartYear())];
  if (yr) {
    for (const [client, dc] of Object.entries(yr)) {
      const existing = Object.keys(eff).find(k => _norm(k) === _norm(client));
      if (existing) delete eff[existing];
      eff[client] = dc; // '' = à assigner explicite pour cet exercice
    }
  }
  return eff;
}

function getClientDC(clientName, fyStartYear) {
  const eff = effectiveClientMap(loadClientAssignments(), fyStartYear);
  const key = Object.keys(eff).find(k => _norm(k) === _norm(clientName));
  return key ? eff[key] : '';
}

// Map effective { client: dc } pour l'exercice (d\u00e9faut \u222a overrides d'exercice).
function getAllClientAssignments(fyStartYear) {
  return effectiveClientMap(loadClientAssignments(), fyStartYear);
}

// D\u00e9tail par client pour un exercice : { client: { dc, source: 'year'|'default'|'' } }
// Permet \u00e0 l'UI de distinguer override dat\u00e9 et h\u00e9ritage du d\u00e9faut.
function getClientAssignmentDetail(fyStartYear) {
  const data = loadClientAssignments();
  const fy = String(fyStartYear ?? currentFyStartYear());
  const yr = data.byYear[fy] || {};
  const out = {};
  for (const [client, dc] of Object.entries(data.assignments || {})) out[client] = { dc, source: dc ? 'default' : '' };
  for (const [client, dc] of Object.entries(yr)) {
    const existing = Object.keys(out).find(k => _norm(k) === _norm(client));
    if (existing) delete out[existing];
    out[client] = { dc, source: 'year' };
  }
  return out;
}

// Assigne un client. fyStartYear fourni \u2192 override dat\u00e9 (byYear) ; sinon \u2192 d\u00e9faut h\u00e9rit\u00e9.
// removeOverride: retire l'override de l'exercice pour revenir \u00e0 la valeur h\u00e9rit\u00e9e.
function assignClient(clientName, dcName, fyStartYear, removeOverride) {
  const data = loadClientAssignments();
  if (fyStartYear != null) {
    const fy = String(fyStartYear);
    data.byYear[fy] = data.byYear[fy] || {};
    const existing = Object.keys(data.byYear[fy]).find(k => _norm(k) === _norm(clientName));
    if (existing) delete data.byYear[fy][existing];
    if (!removeOverride) data.byYear[fy][clientName] = dcName;
  } else {
    data.assignments[clientName] = dcName;
  }
  saveClientAssignments(data);
}

function assignClientsBulk(assignments) {
  const data = loadClientAssignments();
  for (const [client, dc] of Object.entries(assignments)) {
    data.assignments[client] = dc;
  }
  saveClientAssignments(data);
  return Object.keys(assignments).length;
}

// ── Project assignments ──────────────────────────────────

function loadProjectAssignments() {
  try {
    if (fs.existsSync(PROJECT_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8'));
    }
  } catch (e) { console.error('[Assignments] Error loading projects:', e.message); }
  return { assignments: {}, updatedAt: null };
}

function saveProjectAssignments(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROJECT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getProjectDCs(projectId) {
  const data = loadProjectAssignments();
  return data.assignments[projectId] || [];
}

function getAllProjectAssignments() {
  return loadProjectAssignments().assignments;
}

/**
 * Assign a project to one or more DCs
 * @param {string} projectId
 * @param {string[]} dcNames - array of DC names
 */
function assignProject(projectId, dcNames) {
  const data = loadProjectAssignments();
  data.assignments[projectId] = Array.isArray(dcNames) ? dcNames : [dcNames];
  saveProjectAssignments(data);
}

function assignProjectsBulk(assignments) {
  const data = loadProjectAssignments();
  for (const [projectId, dcs] of Object.entries(assignments)) {
    data.assignments[projectId] = Array.isArray(dcs) ? dcs : [dcs];
  }
  saveProjectAssignments(data);
  return Object.keys(assignments).length;
}

// ── Proposal assignments (devis) ─────────────────────────
// Même logique que les projets : assignation explicite devis→DC
// qui prime sur l'assignation par client.

function loadProposalAssignments() {
  try {
    if (fs.existsSync(PROPOSAL_FILE)) {
      return JSON.parse(fs.readFileSync(PROPOSAL_FILE, 'utf8'));
    }
  } catch (e) { console.error('[Assignments] Error loading proposals:', e.message); }
  return { assignments: {}, updatedAt: null };
}

function saveProposalAssignments(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROPOSAL_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getProposalDCs(proposalId) {
  const data = loadProposalAssignments();
  return data.assignments[proposalId] || [];
}

function getAllProposalAssignments() {
  return loadProposalAssignments().assignments;
}

/**
 * Assign a proposal (devis) to one or more DCs
 * @param {string} proposalId
 * @param {string[]} dcNames - array of DC names
 */
function assignProposal(proposalId, dcNames) {
  const data = loadProposalAssignments();
  data.assignments[proposalId] = Array.isArray(dcNames) ? dcNames : [dcNames];
  saveProposalAssignments(data);
}

function assignProposalsBulk(assignments) {
  const data = loadProposalAssignments();
  for (const [proposalId, dcs] of Object.entries(assignments)) {
    data.assignments[proposalId] = Array.isArray(dcs) ? dcs : [dcs];
  }
  saveProposalAssignments(data);
  return Object.keys(assignments).length;
}

// ── DC list (assignments + users.json) ───────────────────

function getActiveDCs() {
  const clientData = loadClientAssignments();
  const projectData = loadProjectAssignments();
  const proposalData = loadProposalAssignments();
  const dcs = new Set();
  // From assignments
  Object.values(clientData.assignments).forEach(dc => { if (dc) dcs.add(dc); });
  Object.values(projectData.assignments).forEach(dcList => {
    if (Array.isArray(dcList)) dcList.forEach(dc => { if (dc) dcs.add(dc); });
  });
  Object.values(proposalData.assignments).forEach(dcList => {
    if (Array.isArray(dcList)) dcList.forEach(dc => { if (dc) dcs.add(dc); });
  });
  // Always include all DC-role users (so new DCs without assignments still appear)
  try {
    const USERS_FILE = path.join(DATA_DIR, 'users.json');
    if (fs.existsSync(USERS_FILE)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      users.filter(u => u.role === 'dc').forEach(u => {
        const label = u.furiousName || u.name;
        if (label) dcs.add(label);
      });
    }
  } catch (e) { /* ignore */ }
  return [...dcs].sort();
}

module.exports = {
  getAllClientAssignments, getClientDC, assignClient, assignClientsBulk, getClientAssignmentDetail,
  getAllProjectAssignments, getProjectDCs, assignProject, assignProjectsBulk,
  getAllProposalAssignments, getProposalDCs, assignProposal, assignProposalsBulk,
  getActiveDCs, loadClientAssignments, loadProjectAssignments, loadProposalAssignments,
};

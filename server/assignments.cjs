/**
 * SPK DC — Module Assignations
 * Gestion des assignations client→DC et projet→DC
 */
const fs = require('fs');
const path = require('path');

const CLIENT_FILE = path.join(__dirname, 'data', 'client_assignments.json');
const PROJECT_FILE = path.join(__dirname, 'data', 'project_assignments.json');

// ── Client assignments ───────────────────────────────────

function loadClientAssignments() {
  try {
    if (fs.existsSync(CLIENT_FILE)) {
      return JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8'));
    }
  } catch (e) { console.error('[Assignments] Error loading clients:', e.message); }
  return { assignments: {}, updatedAt: null };
}

function saveClientAssignments(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(CLIENT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getClientDC(clientName) {
  const data = loadClientAssignments();
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const key = Object.keys(data.assignments).find(k => norm(k) === norm(clientName));
  return key ? data.assignments[key] : '';
}

function getAllClientAssignments() {
  return loadClientAssignments().assignments;
}

function assignClient(clientName, dcName) {
  const data = loadClientAssignments();
  data.assignments[clientName] = dcName;
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

// ── DC list (derived from assignments) ───────────────────

function getActiveDCs() {
  const clientData = loadClientAssignments();
  const projectData = loadProjectAssignments();
  const dcs = new Set();
  Object.values(clientData.assignments).forEach(dc => { if (dc) dcs.add(dc); });
  Object.values(projectData.assignments).forEach(dcList => {
    if (Array.isArray(dcList)) dcList.forEach(dc => { if (dc) dcs.add(dc); });
  });
  return [...dcs].sort();
}

module.exports = {
  getAllClientAssignments, getClientDC, assignClient, assignClientsBulk,
  getAllProjectAssignments, getProjectDCs, assignProject, assignProjectsBulk,
  getActiveDCs, loadClientAssignments, loadProjectAssignments,
};

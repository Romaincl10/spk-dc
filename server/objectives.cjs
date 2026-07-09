/**
 * SPK DC — Module Objectifs
 * Import CSV + gestion des objectifs par DC
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const OBJ_FILE = path.join(DATA_DIR, 'objectives.json');

function loadObjectives() {
  try {
    if (fs.existsSync(OBJ_FILE)) {
      return JSON.parse(fs.readFileSync(OBJ_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Objectives] Error loading:', e.message);
  }
  return { objectives: {}, imports: [] };
}

function saveObjectives(data) {
  fs.writeFileSync(OBJ_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Exercice fiscal courant (d\u00e9marre le 01/07) \u2014 fyStartYear = ann\u00e9e de d\u00e9but
function currentFyStartYear() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

// Retourne la map { dc: [...] } pour un exercice donn\u00e9, en g\u00e9rant la structure
// scind\u00e9e { "2025": {...}, "2026": {...} } ou l'ancienne structure plate.
function objectivesByDC(root, fyStartYear) {
  const scoped = Object.keys(root || {}).some(k => /^\d{4}$/.test(k));
  if (!scoped) return root || {};
  return root[String(fyStartYear ?? currentFyStartYear())] || {};
}

function getObjectivesForDC(dcName, fyStartYear) {
  const data = loadObjectives();
  const byDc = objectivesByDC(data.objectives, fyStartYear);
  // Match by normalized name (case-insensitive, accent-insensitive)
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const key = Object.keys(byDc).find(k => norm(k) === norm(dcName));
  return key ? byDc[key] : [];
}

function getAllObjectives(fyStartYear) {
  return objectivesByDC(loadObjectives().objectives, fyStartYear);
}

function getImportHistory() {
  return loadObjectives().imports || [];
}

/**
 * Parse CSV content (separator: ; or ,)
 * Expected columns: DC;Objectif;Cible;Type;Periode
 */
function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return { error: 'Le fichier doit contenir au moins un en-tete et une ligne de donnees' };

  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  // Map header names
  const dcIdx = headers.findIndex(h => h === 'dc' || h === 'directeur');
  const objIdx = headers.findIndex(h => h === 'objectif' || h === 'label');
  const targetIdx = headers.findIndex(h => h === 'cible' || h === 'valeur_cible' || h === 'target');
  const typeIdx = headers.findIndex(h => h === 'type');
  const periodIdx = headers.findIndex(h => h === 'periode' || h === 'period');

  if (dcIdx === -1 || objIdx === -1 || targetIdx === -1) {
    return { error: 'Colonnes requises manquantes : DC, Objectif, Cible' };
  }

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim());
    if (!cols[dcIdx]) continue;

    results.push({
      dc: cols[dcIdx],
      label: cols[objIdx] || '',
      target: parseFloat(cols[targetIdx]) || 0,
      type: typeIdx >= 0 ? cols[typeIdx] || 'custom' : 'custom',
      period: periodIdx >= 0 ? cols[periodIdx] || '' : '',
    });
  }

  return { data: results };
}

function importCSV(content, importedBy) {
  const parsed = parseCSV(content);
  if (parsed.error) return parsed;

  const store = loadObjectives();

  // Group by DC name
  const grouped = {};
  for (const row of parsed.data) {
    if (!grouped[row.dc]) grouped[row.dc] = [];
    grouped[row.dc].push({
      label: row.label,
      target: row.target,
      type: row.type,
      period: row.period,
    });
  }

  // Merge/replace objectives — cible l'exercice courant si structure scindée par exercice
  const root = store.objectives || {};
  const scoped = Object.keys(root).some(k => /^\d{4}$/.test(k));
  if (scoped) {
    const yk = String(currentFyStartYear());
    root[yk] = { ...(root[yk] || {}), ...grouped };
    store.objectives = root;
  } else {
    store.objectives = { ...root, ...grouped };
  }

  // Track import
  store.imports.push({
    date: new Date().toISOString(),
    by: importedBy || 'admin',
    count: parsed.data.length,
    exercise: scoped ? String(currentFyStartYear()) : undefined,
    dcs: Object.keys(grouped),
  });

  saveObjectives(store);
  return { success: true, count: parsed.data.length, dcs: Object.keys(grouped) };
}

module.exports = { getObjectivesForDC, getAllObjectives, getImportHistory, importCSV, parseCSV };

/**
 * SPK DC — Module Objectifs
 * Import CSV + gestion des objectifs par DC
 */
const fs = require('fs');
const path = require('path');

const OBJ_FILE = path.join(__dirname, 'data', 'objectives.json');

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

function getObjectivesForDC(dcName) {
  const data = loadObjectives();
  // Match by normalized name (case-insensitive, accent-insensitive)
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const key = Object.keys(data.objectives).find(k => norm(k) === norm(dcName));
  return key ? data.objectives[key] : [];
}

function getAllObjectives() {
  return loadObjectives().objectives;
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

  // Merge/replace objectives
  store.objectives = { ...store.objectives, ...grouped };

  // Track import
  store.imports.push({
    date: new Date().toISOString(),
    by: importedBy || 'admin',
    count: parsed.data.length,
    dcs: Object.keys(grouped),
  });

  saveObjectives(store);
  return { success: true, count: parsed.data.length, dcs: Object.keys(grouped) };
}

module.exports = { getObjectivesForDC, getAllObjectives, getImportHistory, importCSV, parseCSV };

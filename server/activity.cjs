/**
 * SPK DC — Module Activité commerciale (pilotage)
 * Capture du haut de funnel non porté par Furious :
 *   - leads générés
 *   - RDV réalisés
 *   - briefs détectés
 * Stockage par DC et par semaine ISO (ex: "2026-W26").
 * Le bas du funnel (opportunités, pipe, CA) reste calculé depuis Furious
 * dans buildDCPortfolios() — on ne duplique jamais cette donnée ici.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const ACTIVITY_FILE = path.join(DATA_DIR, 'weekly_activity.json');

// ── Semaine ISO ──────────────────────────────────────────

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;        // lundi = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3);     // jeudi de la semaine
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function currentWeek() {
  return isoWeek(new Date());
}

// ── Store ────────────────────────────────────────────────

function loadActivity() {
  try {
    if (fs.existsSync(ACTIVITY_FILE)) {
      return JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
    }
  } catch (e) { console.error('[Activity] Error loading:', e.message); }
  return { entries: {}, updatedAt: null };
}

function saveActivity(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Renvoie toutes les semaines d'un DC : { "2026-W26": {leads,rdv,briefs,note,updatedAt} } */
function getDCActivity(dcName) {
  const data = loadActivity();
  return data.entries[dcName] || {};
}

/** Renvoie l'ensemble des entrées, tous DC confondus */
function getAllActivity() {
  return loadActivity().entries;
}

/** Crée ou met à jour la saisie d'un DC pour une semaine donnée */
function upsertEntry(dcName, week, { leads, rdv, briefs, note }) {
  if (!dcName) return { error: 'DC manquant' };
  const wk = week || currentWeek();
  const data = loadActivity();
  if (!data.entries[dcName]) data.entries[dcName] = {};
  data.entries[dcName][wk] = {
    leads: toInt(leads),
    rdv: toInt(rdv),
    briefs: toInt(briefs),
    note: typeof note === 'string' ? note.slice(0, 500) : '',
    updatedAt: new Date().toISOString(),
  };
  saveActivity(data);
  return { week: wk, entry: data.entries[dcName][wk] };
}

module.exports = {
  isoWeek, currentWeek,
  getDCActivity, getAllActivity, upsertEntry,
};

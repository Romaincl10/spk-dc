/**
 * SPK DC — Module Farming
 * État éditable du board farming (concepts + événements par client), persistant sur DATA_DIR.
 * Initialisé depuis farming_seed.json (données de base) pour les clients non encore touchés.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const FARMING_FILE = path.join(DATA_DIR, 'farming.json');
const SEED_FILE = path.join(__dirname, 'data', 'farming_seed.json');

function loadSeed() {
  try { return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); } catch (e) { return {}; }
}
function loadLive() {
  try { if (fs.existsSync(FARMING_FILE)) return JSON.parse(fs.readFileSync(FARMING_FILE, 'utf8')); }
  catch (e) { console.error('[Farming] load error:', e.message); }
  return {};
}
function saveLive(data) {
  fs.writeFileSync(FARMING_FILE, JSON.stringify(data, null, 1), 'utf8');
}

/** État d'un client depuis le seed (statut vide, corbeilles vides). */
function seedClient(s) {
  return {
    col: s.col, obj: s.obj, mb: s.mb,
    concepts: (s.concepts || []).map(c => ({ ...c })),
    conceptsArchived: [],
    events: (s.events || []).map(e => ({ ...e })),
    eventsArchived: [],
  };
}

/** Retourne l'état complet d'un DC : clients vivants si touchés, sinon seedés. */
function getDC(dc) {
  const seed = loadSeed()[dc] || {};
  const dcLive = loadLive()[dc] || {};
  const result = {};
  const clients = new Set([...Object.keys(seed), ...Object.keys(dcLive)]);
  for (const client of clients) {
    result[client] = dcLive[client] || (seed[client] ? seedClient(seed[client]) : null);
    if (!result[client]) delete result[client];
  }
  return result;
}

/** Sauvegarde l'état complet d'un client (concepts, conceptsArchived, events, eventsArchived, méta). */
function saveClient(dc, client, data) {
  const live = loadLive();
  if (!live[dc]) live[dc] = {};
  // Conserve les métadonnées (col/obj/mb) du seed si non fournies
  const seed = (loadSeed()[dc] || {})[client] || {};
  live[dc][client] = {
    col: data.col || seed.col, obj: data.obj ?? seed.obj, mb: data.mb || seed.mb,
    concepts: data.concepts || [],
    conceptsArchived: data.conceptsArchived || [],
    events: data.events || [],
    eventsArchived: data.eventsArchived || [],
  };
  saveLive(live);
  return live[dc][client];
}

module.exports = { getDC, saveClient };

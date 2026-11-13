/**
 * SPK DC — Opportunités du matin
 * Cartes d'opportunités déposées par le scan (moments + concepts), en attente de
 * validation par le DC. Stockées sur le volume, par DC. L'intégration reverse la
 * carte dans le Plan de jeu (farming) et la retire du vivier.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'opportunites.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; }
}
function save(d) {
  try { fs.writeFileSync(FILE, JSON.stringify(d, null, 1)); } catch (e) { console.error('[Opp] save', e.message); }
}

function getDC(dc) {
  const d = load();
  return d[dc] || [];
}

// Dépose des cartes pour un DC (dédoublonne par (client + title/name)).
function addCards(dc, cards) {
  const d = load();
  const list = d[dc] || [];
  const sig = c => (c.client || '') + '|' + (c.moment && c.moment.title || '') + '|' + (c.concept && c.concept.name || '');
  const seen = new Set(list.map(sig));
  const now = new Date().toISOString();
  const added = (cards || [])
    .filter(c => !seen.has(sig(c)))
    .map((c, i) => ({ id: c.id || ('opp-' + Date.now() + '-' + i), createdAt: now, ...c }));
  d[dc] = [...added, ...list];
  save(d);
  return added.length;
}

// Remplace entièrement le vivier d'un DC (utilisé par le seed démo : chaque
// déploiement repart exactement des cartes du fichier, vague propre).
function setDC(dc, cards) {
  const d = load();
  const now = new Date().toISOString();
  d[dc] = (cards || []).map((c, i) => ({ id: c.id || ('opp-' + Date.now() + '-' + i), createdAt: now, ...c }));
  save(d);
  return d[dc].length;
}

function getCard(dc, id) {
  return getDC(dc).find(c => c.id === id);
}
function setCard(dc, id, card) {
  const d = load();
  if (!d[dc]) return;
  d[dc] = d[dc].map(c => (c.id === id ? card : c));
  save(d);
}
function removeCard(dc, id) {
  const d = load();
  if (!d[dc]) return false;
  const before = d[dc].length;
  d[dc] = d[dc].filter(c => c.id !== id);
  save(d);
  return d[dc].length < before;
}

module.exports = { getDC, addCards, setDC, getCard, setCard, removeCard };

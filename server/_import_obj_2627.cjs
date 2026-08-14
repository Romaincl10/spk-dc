/* Import des objectifs 26/27 depuis le budget prévisionnel (onglet "CA").
 * - Agrège par DC × Client (niveau groupe), cible = CA annuel, mbTarget = MB € annuelle.
 * - Mappe chaque client budget vers des motifs de match (normalisés) contre les
 *   noms canoniques de l'outil ; agrégation groupe pour Puma, etc.
 * - Restructure objectives.json par exercice : { "2025": {...actuel}, "2026": {...import} }.
 * - PAS de _BIZ_DEV en 26/27.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const BUDGET = 'C:/Users/RomainCLOUET/Documents/13/Budget previsionnel SPK 2026-2027 v3.__new__.xlsx';
const OBJ_FILE = path.join(__dirname, 'data', 'objectives.json');

// Motifs de match (normalisés, minuscules, sans accents) budget-client -> noms canoniques outil.
// Défaut : [norm(nom budget)]. Cas spéciaux (groupes / typos / variantes) explicités.
const MATCH = {
  'Adidas': ['adidas'],
  'CNOSCF': ['cnosf', 'cnoscf'],
  'CIC': ['cic'],
  'Crédit Mutuel': ['credit mutuel'],
  'Kappa': ['kappa'],
  'Synergie': ['synergie'],
  'FC Nantes': ['fc nantes'],
  'Eminence': ['eminence'],
  'Puma': ['puma', 'psf italy'],            // groupe : toutes entités Puma (hors Motorsport = Audrey)
  'Lacoste': ['lacoste'],
  'Pennylane': ['pennylane'],
  'Decathlon': ['decathlon'],
  'SAIL GP': ['sailgp', 'sail gp'],
  'Motorsport': ['motorsport'],
  'GMF Assurance': ['gmf'],
  'Le Mans Endurance': ['mans endurance'],
  'Asics': ['asics'],
  'ON AG': ['on ag'],
  '2 Ride': ['2ride', '2 ride'],
  'Hummel': ['hummel'],
  'Mizuno': ['mizuno'],
  'Match Worn Shirt': ['match worn'],
  'New Balance': ['new balance'],
  'FF Sport pour tous': ['pour tous'],
  'AS Monaco': ['as monaco'],
  'Intersport': ['intersport'],             // groupe : INTERSPORT FRANCE + IIC
  'Brooks': ['brooks'],
  'Abeille Assurances': ['abeille'],
  'FFF': ['federation francaise de football', 'fff'],
};

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// 1) Parse onglet CA (rows 2..jusqu'à TOTAL), skip Médias
const wb = XLSX.readFile(BUDGET);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['CA'], { header: 1, blankrows: false });
const DCS = ['Hadrien', 'Clément', 'Audrey', 'Ninon', 'Naël'];

const agg = {}; // dc -> client -> { ca, mb }
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  const dc = (r[0] || '').toString().trim();
  if (dc === 'TOTAL' || dc === 'Synthèse par DC') break;
  if (!DCS.includes(dc)) continue; // ignore Médias & autres
  const client = (r[1] || '').toString().trim();
  if (!client) continue;
  const ca = Number(r[3]) || 0;
  const mb = Number(r[5]) || 0;
  (agg[dc] ||= {});
  (agg[dc][client] ||= { ca: 0, mb: 0 });
  agg[dc][client].ca += ca;
  agg[dc][client].mb += mb;
}

// 2) Construit les objectifs 26/27 par DC
const obj2026 = {};
const missingMatch = [];
for (const dc of DCS) {
  const clients = agg[dc] || {};
  obj2026[dc] = Object.entries(clients)
    .sort((a, b) => b[1].ca - a[1].ca)
    .map(([client, v]) => {
      const match = MATCH[client] || [norm(client)];
      if (!MATCH[client]) missingMatch.push(`${dc}/${client}`);
      return { client, target: Math.round(v.ca), mbTarget: Math.round(v.mb), match };
    });
}

// 3) Restructure objectives.json par exercice
const raw = JSON.parse(fs.readFileSync(OBJ_FILE, 'utf8'));
const isScoped = Object.keys(raw.objectives || {}).some(k => /^\d{4}$/.test(k));
const objectives = isScoped ? raw.objectives : { '2025': raw.objectives || {} };
objectives['2026'] = obj2026;

const out = { objectives, imports: raw.imports || [] };
out.imports.push({ date: '2026-07-09T00:00:00.000Z', by: 'import-budget-2627', exercise: '2026', dcs: DCS });
fs.writeFileSync(OBJ_FILE, JSON.stringify(out, null, 2), 'utf8');

// 4) Récap
console.log('Structure objectives.json -> exercices:', Object.keys(objectives).join(', '));
for (const dc of DCS) {
  const list = obj2026[dc];
  const tot = list.reduce((s, o) => s + o.target, 0);
  console.log(`\n${dc} — ${list.length} clients, cible ${tot.toLocaleString('fr-FR')} €`);
  list.forEach(o => console.log('   ', o.client.padEnd(22), o.target.toLocaleString('fr-FR').padStart(10), '€  [match: ' + o.match.join('|') + ']'));
}
if (missingMatch.length) console.log('\n⚠️ match par défaut (à vérifier):', missingMatch.join(', '));

/**
 * Fetch live Furious -> fichiers data/ consommés par _build_previ.cjs
 * Skill "Projections 26/27". Récupère projets, devis, factures (AVEC issue_date,
 * indispensable aux dates de factures prévues) et la map Achats Médias (BU 31).
 *
 * Credentials : jamais en clair ici — furious.cjs lit .env / 1Password.
 */
const fs = require('fs');
const path = require('path');
const F = require('./furious.cjs');

const dir = path.join(__dirname, 'data');
const write = (name, obj) => {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));
  console.log('  écrit', name);
};

// Factures : fetchInvoices() standard N'INCLUT PAS issue_date -> query dédiée.
async function fetchInvoicesWithIssueDate() {
  return F.fetchAll(
    'stand-alone-invoice', 'Invoices',
    'id,statut,is_cancelled,project_id,project_name,company_name,proposal_id,amount_ht,invoice_date,issue_date'
  );
}

// Marge brute des devis : lignes de chiffrage ProposalRateCard (vente=amount, achat=purchase_price).
// On agrège par devis (hors lignes option) -> { proposal_id: { sell, cost, media } }.
// media = Σ purchase_price des lignes Achats Médias (bu_id 31), pour usage éventuel.
async function fetchProposalMargins() {
  const lines = await F.fetchAll(
    'proposal-rate-card', 'ProposalRateCard',
    'proposal_id,bu_id,amount,purchase_price,is_option'
  );
  const map = {};
  lines.forEach(l => {
    const pid = String(l.proposal_id);
    if (!map[pid]) map[pid] = { sell: 0, cost: 0, media: 0, sellAll: 0, costAll: 0 };
    const amt = Number(l.amount) || 0, pp = Number(l.purchase_price) || 0;
    map[pid].sellAll += amt; map[pid].costAll += pp;        // toutes lignes (incl. options)
    if (String(l.is_option || '0') !== '0') return;          // hors options
    map[pid].sell += amt;
    map[pid].cost += pp;
    if (String(l.bu_id) === '31') map[pid].media += pp;
  });
  return { map, nLines: lines.length };
}

(async () => {
  const t0 = Date.now();
  console.log('[Prévi] Fetch live Furious...');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const syncDate = new Date().toISOString();
  const [projects, proposals, invoices, am, propMargins] = await Promise.all([
    F.fetchProjects(),
    F.fetchProposals(),
    fetchInvoicesWithIssueDate(),
    F.fetchAchatsMediasRateCards(),
    fetchProposalMargins(),
  ]);

  write('_live_projects.json', { data: projects, syncDate });
  write('_live_proposals.json', { data: proposals, syncDate });
  write('_invoices_full.json', invoices);   // tableau brut (consommé tel quel)
  write('_am_map.json', am);                // { project_id: € Achats Médias }
  write('_prop_margin_map.json', propMargins.map);  // { proposal_id: { sell, cost, media } }

  console.log(`[Prévi] OK en ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
    `${projects.length} projets, ${proposals.length} devis, ${invoices.length} factures, ` +
    `${Object.keys(am).length} projets Achats Médias, ` +
    `${propMargins.nLines} lignes devis -> ${Object.keys(propMargins.map).length} devis chiffrés.`);
})().catch(e => { console.error('[Prévi] ÉCHEC fetch :', e.message); process.exit(1); });

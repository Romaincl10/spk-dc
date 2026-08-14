/**
 * Export devis d'un projet -> data/_devis_<CODE>.json
 * Récupère projet, proposal (header) et lignes de chiffrage (ProposalRateCard),
 * avec résolution bu_id -> nom de profil via business-unit.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const F = require('./furious.cjs');

const CODE = process.argv[2] || 'SPK0227';

function q(token, ep, qn, fields, filters, limit = 500) {
  return new Promise((resolve, reject) => {
    let parts = [`limit:${limit}`];
    if (filters) parts.push(`filter:{${filters}}`);
    const query = `{${qn}(${parts.join(',')}){${fields}}}`;
    const p = `/api/v2/${ep}/?query=${encodeURIComponent(query)}`;
    https.request({ hostname: 'spk-group.furious-squad.com', path: p, method: 'GET',
      headers: { 'Content-Type': 'application/json', 'F-Auth-Token': token } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error(d.slice(0, 300))); } }); })
      .on('error', reject).end();
  });
}

(async () => {
  const token = await F.authenticate();

  const projects = await F.fetchProjects();
  const proj = projects.find(p => String(p.title || '').toUpperCase().includes(CODE.toUpperCase()));
  if (!proj) throw new Error('Projet introuvable: ' + CODE);
  const projId = String(proj.id);

  const proposals = await F.fetchProposals();
  let proposal = proposals.find(p => String(p.id) === String(proj.proposal_id));
  if (!proposal) proposal = proposals.find(p => String(p.project_id) === projId);
  if (!proposal) throw new Error('Devis introuvable pour ' + CODE);
  const propId = String(proposal.id);

  // BU map
  const buRes = await q(token, 'business-unit', 'BusinessUnit', 'id,name');
  const buMap = {};
  (buRes.data?.BusinessUnit || []).forEach(b => { buMap[String(b.id)] = b.name; });

  // Lignes de chiffrage
  const lcRes = await q(token, 'proposal-rate-card', 'ProposalRateCard',
    'id,proposal_id,bu_id,amount,purchase_price,is_option,unit_type,category,quantity,vat,discount',
    `proposal_id:{eq:"${propId}"}`, 1000);
  const lines = (lcRes.data?.ProposalRateCard || []).map(l => ({
    id: l.id,
    bu_id: l.bu_id,
    bu_name: buMap[String(l.bu_id)] || ('BU ' + l.bu_id),
    category: l.category || '(Sans catégorie)',
    description: (l.description || '').replace(/<[^>]*>/g, '').trim(),
    unit_type: l.unit_type,
    quantity: Number(l.quantity) || 0,
    unit_sell: Number(l.amount) || 0,
    unit_cost: l.purchase_price == null ? null : Number(l.purchase_price),
    discount: l.discount == null ? null : Number(l.discount),
    is_option: String(l.is_option || '0') !== '0',
  }));

  const out = { code: CODE, project: proj, proposal, lines, buMap, syncDate: new Date().toISOString() };
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `_devis_${CODE}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('OK', file, '—', lines.length, 'lignes');
})().catch(e => { console.error('ÉCHEC:', e.message); process.exit(1); });

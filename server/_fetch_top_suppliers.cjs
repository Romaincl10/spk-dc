/**
 * Top fournisseurs par montant d'achats (cost HT) — extraction live Furious.
 * Jointure CORRECTE :
 *   Purchase.supplier_id -> Clients.id (nom = Clients.company, company_id)
 *   Clients.company_id   -> Company.id (siren, siret)
 * Agrège par entité légale (company_id) quand dispo, sinon par client.
 * Écrit data/_top_suppliers.json
 */
const fs = require('fs');
const path = require('path');
const { authenticate, fetchAll } = require('./furious.cjs');

const INTRA_SPK = ['SPORTPACK', 'SPK MEDIAS', 'SPK ACTIVATE', 'SPK STUDIO', 'SPK GROUP',
                   'SPK STORE', 'SPK', 'SPK DC', 'SPK ATHLETIC'];
function isIntraSPK(name) {
  const n = (name || '').toUpperCase().trim();
  return INTRA_SPK.includes(n) || n.startsWith('SPK ') || n === 'SPK';
}

(async () => {
  await authenticate();

  const purchases = await fetchAll('purchase', 'Purchase',
    'id,cost,vat,currency,supplier_id,statut,type,expense_type,project_id');
  const companies = await fetchAll('company', 'Company', 'id,name,siren,siret');
  const clients   = await fetchAll('crm', 'Clients', 'id,company,company_id');

  const coById = {}; companies.forEach(c => coById[String(c.id)] = c);
  const clById = {}; clients.forEach(c => clById[String(c.id)] = c);

  const agg = {};
  let totalCost = 0, costNoSupplier = 0, costUnknown = 0, nNoSup = 0, nUnknown = 0;

  for (const p of purchases) {
    const cost = Number(p.cost || 0);
    if (!cost) continue;
    totalCost += cost;
    const sid = String(p.supplier_id || '0');
    if (sid === '0' || sid === '') { costNoSupplier += cost; nNoSup++; continue; }

    const cl = clById[sid];
    let key, name, siren, siret, companyId;
    if (cl) {
      companyId = String(cl.company_id || '');
      const co = companyId && companyId !== '0' ? coById[companyId] : null;
      name  = (co && co.name) ? co.name : (cl.company || `(client #${sid})`);
      siren = co ? (co.siren || '').trim() : '';
      siret = co ? (co.siret || '').trim() : '';
      key   = (co ? 'co' + companyId : 'cl' + sid);
    } else {
      // supplier_id orphelin (ni client ni company) -> on tente company directe en dernier recours
      const co = coById[sid];
      name  = co ? co.name : `(inconnu #${sid})`;
      siren = co ? (co.siren || '').trim() : '';
      siret = co ? (co.siret || '').trim() : '';
      key   = co ? 'co' + sid : 'sid' + sid;
      if (!co) { costUnknown += cost; nUnknown++; }
    }
    if (!agg[key]) agg[key] = { name, siren, siret, total: 0, lines: 0, intra: isIntraSPK(name) };
    agg[key].total += cost;
    agg[key].lines += 1;
    if (siren && !agg[key].siren) agg[key].siren = siren;
  }

  const rows = Object.values(agg)
    .map(a => ({ ...a, total_ht: Math.round(a.total * 100) / 100 }))
    .sort((x, y) => y.total_ht - x.total_ht);

  const top = rows.slice(0, 100);
  const sirenCov = top.filter(r => r.siren).length;
  const intraCount = top.filter(r => r.intra).length;

  console.log('\n=== DIAGNOSTIC ===');
  console.log('Montant HT total achats:', Math.round(totalCost).toLocaleString('fr-FR'), 'EUR');
  console.log('  sans fournisseur (supplier_id 0):', Math.round(costNoSupplier).toLocaleString('fr-FR'), 'EUR /', nNoSup, 'lignes');
  console.log('  supplier_id orphelin (non résolu):', Math.round(costUnknown).toLocaleString('fr-FR'), 'EUR /', nUnknown, 'lignes');
  console.log('Fournisseurs distincts:', rows.length);
  console.log('Top 100 — SIREN renseigné:', sirenCov, '/100  | intra-SPK:', intraCount);
  console.log('\nTop 20:');
  top.slice(0, 20).forEach((r, i) =>
    console.log(`${String(i+1).padStart(3)}. ${r.name.substring(0,38).padEnd(40)} ${(r.intra?'[intra]':'       ')} SIREN=${(r.siren||'—').padEnd(11)} ${r.total_ht.toLocaleString('fr-FR')} €`));

  const outDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '_top_suppliers.json');
  fs.writeFileSync(outPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_purchases_ht: Math.round(totalCost),
    suppliers_count: rows.length,
    top100: top,
  }, null, 2), 'utf8');
  console.log('\nÉcrit:', outPath);
})().catch(e => { console.error('ERREUR', e); process.exit(1); });

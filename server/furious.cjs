/**
 * Furioussquad API v2 Client
 * Copie depuis spk-dashboard — memes endpoints, meme auth
 */
const https = require('https');
require('dotenv').config();

const API_HOST = 'spk-group.furious-squad.com';
const API_USERNAME = process.env.FURIOUS_USERNAME || 'ali.gator.32533';
const API_PASSWORD = process.env.FURIOUS_PASSWORD || 'auUYkE3&=r\u00a7Vq-V';

let cachedToken = null;
let tokenExpiry = 0;

function authenticate() {
  return new Promise((resolve, reject) => {
    if (cachedToken && Date.now() < tokenExpiry) return resolve(cachedToken);
    const postData = JSON.stringify({
      action: 'auth',
      data: { username: API_USERNAME, password: API_PASSWORD },
    });
    const req = https.request(
      {
        hostname: API_HOST,
        path: '/api/v2/auth/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.success && json.token) {
              cachedToken = json.token;
              tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
              console.log('[Furious] Authenticated, token expires in', json.expires_in, 's');
              resolve(cachedToken);
            } else {
              reject(new Error(`Auth failed: ${json.message || 'Unknown error'}`));
            }
          } catch (e) {
            reject(new Error(`Auth parse error: ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Auth timeout')); });
    req.write(postData);
    req.end();
  });
}

function apiSearch(token, endpoint, queryName, fields, filters, limit, offset) {
  return new Promise((resolve, reject) => {
    let queryParts = [];
    if (limit) queryParts.push(`limit:${limit}`);
    if (offset) queryParts.push(`offset:${offset}`);
    if (filters) queryParts.push(`filter:{${filters}}`);
    const params = queryParts.length > 0 ? `(${queryParts.join(',')})` : '';
    const query = `{${queryName}${params}{${fields}}}`;
    const encodedQuery = encodeURIComponent(query);
    const path = `/api/v2/${endpoint}/?query=${encodedQuery}`;

    const req = https.request(
      {
        hostname: API_HOST,
        path,
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'F-Auth-Token': token },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.success === false) {
              reject(new Error(`API error: ${JSON.stringify(json.errors || json.message)}`));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error(`Parse error: ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function fetchAll(endpoint, queryName, fields, filters, maxItems = 50000) {
  const token = await authenticate();
  const allItems = [];
  let offset = 0;
  const limit = 250;

  while (allItems.length < maxItems) {
    console.log(`  [Furious] ${endpoint} offset=${offset} (${allItems.length} so far)...`);
    const result = await apiSearch(token, endpoint, queryName, fields, filters, limit, offset);
    const items = result.data?.[queryName] || [];
    allItems.push(...items);

    const totalElements = result.meta?.totalElementsWithFilters || result.meta?.totalElements || 0;
    if (allItems.length >= totalElements || items.length < limit) break;
    offset += limit;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`  [Furious] ${endpoint} -> ${allItems.length} items total`);
  return allItems;
}

async function fetchProjects() {
  return fetchAll(
    'project', 'Project',
    'id,title,company_name,contact_id,contact_company_id,billing_contact,start_date,end_date,created_at,total_amount,total_cost,progress,actif,legal_entity,currency,proposal_id,project_manager,business_account,project_pipe,project_pipe_name,type,type_label,margin,is_rate_card_project,total_gross_margin_distributed,campaign_name,client_configuration,advancement'
  );
}

async function fetchProjectKPIs() {
  return fetchAll(
    'project-kpis', 'ProjectKpis',
    'project_id,time_sold_budget_days,time_spent_days,time_spent_amount,time_planified_days,time_planified_amount,production,net_profitability,time_sold_proposal_days,turnover,cost,budget,gross_margin'
  );
}

async function fetchProposals() {
  return fetchAll(
    'proposal', 'Proposal',
    'id,title,amount,discount,discounted_amount,vat,currency,pipe,pipe_name,probability,client_id,company_name,legal_entity,entity,assigned_to,created_at,last_updated_at,signature_date,projet_start,projet_stop,project_id,total_days,total_sold_days,total_cost,tags'
  );
}

async function fetchCRM() {
  return fetchAll(
    'crm', 'Clients',
    'id,company,company_id,lastname,firstname,email,phone,category,type,status,sector,tags,assigned_people,date_creation,city,country'
  );
}

async function fetchInvoices() {
  return fetchAll(
    'stand-alone-invoice', 'Invoices',
    'id,id_system,proposal_id,project_id,project_name,company_name,company_id,amount_ht,vat,amount_inc_tax,statut,is_cancelled,invoice_date,issue_date,due_date,payment_date,entity,currency,period_start,period_stop,author,tags'
  );
}

async function fetchSprints() {
  return fetchAll(
    'sprint', 'Sprint',
    'id,project_id,title,time,time_in_hours,start_date,end_date,assigned_people,assigned_people_name,project_rate_card_id,project_rate_card_label,proposal_id,is_validated,category_name,project_name,client_name'
  );
}

async function fetchPurchases() {
  return fetchAll(
    'purchase', 'Purchase',
    'id,title,cost,vat,currency,project_id,project_name,proposal_id,proposal_name,statut,start_date,end_date,type,expense_type,who,who_name,is_billable,supplier_id,tags'
  );
}

/**
 * Fetch les lignes de rate card de la BU "Achats Médias" (bu_id=31).
 * Retourne un objet { [project_id]: montantAchatsMedias }
 * Ces montants sont retraités du CA (pass-through non comptabilisé en CA net).
 */
async function fetchAchatsMediasRateCards() {
  console.log('[Furious] Fetching Achats Medias rate cards (BU 31)...');
  const token = await authenticate();
  const all = [];
  let offset = 0;
  const limit = 250;

  while (true) {
    const r = await apiSearch(
      token, 'project-rate-card', 'ProjectRateCard',
      'id,project_id,amount,bu_id',
      'bu_id:{eq:"31"}',
      limit, offset
    );
    const items = r.data?.ProjectRateCard || [];
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
    await new Promise(res => setTimeout(res, 300));
  }

  // Aggregate par project_id
  const byProject = {};
  all.forEach(rc => {
    const pid = String(rc.project_id);
    byProject[pid] = (byProject[pid] || 0) + Number(rc.amount || 0);
  });
  const total = Object.values(byProject).reduce((s, v) => s + v, 0);
  console.log(`[Furious] Achats Medias: ${all.length} lignes, ${Object.keys(byProject).length} projets, total ${total.toFixed(0)}€`);
  return byProject;
}

async function fullSync() {
  const startTime = Date.now();
  console.log('[Furious] === Starting full sync ===');

  const projects = await fetchProjects();
  const projectKPIs = await fetchProjectKPIs();
  const proposals = await fetchProposals();
  const crm = await fetchCRM();
  const invoices = await fetchInvoices();
  const sprints = await fetchSprints();
  const purchases = await fetchPurchases();
  const achatsMediasByProject = await fetchAchatsMediasRateCards();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Furious] === Full sync completed in ${elapsed}s ===`);

  return {
    projects, projectKPIs, proposals, crm, invoices, sprints, purchases, achatsMediasByProject,
    syncDate: new Date().toISOString(),
    counts: {
      projects: projects.length, projectKPIs: projectKPIs.length,
      proposals: proposals.length, crm: crm.length,
      invoices: invoices.length, sprints: sprints.length,
      purchases: purchases.length,
      achatsMedias: Object.keys(achatsMediasByProject).length,
    },
  };
}

module.exports = { authenticate, fetchAll, fetchProjects, fetchProjectKPIs, fetchProposals, fetchCRM, fetchInvoices, fetchSprints, fetchPurchases, fetchAchatsMediasRateCards, fullSync };

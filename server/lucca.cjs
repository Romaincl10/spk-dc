/**
 * Lucca HR API Sync — copie depuis spk-dashboard
 */
const https = require('https');

const LUCCA_HOST = 'spkgroup.ilucca.net';

const LEAVE_CATEGORIES = {
  cp:          [1124, 1125, 1126, 1127, 1128, 1119, 1120, 1121, 1122, 1123],
  rtt:         [1325, 1326, 1327, 1328, 1329, 1320, 1321, 1322, 1323, 1324],
  teletravail: [34, 47],
  deplacement: [35],
  maladie:     [27, 22, 23, 28],
  formation:   [41],
  recuperation:[6],
  seminaire:   [43],
  ecole:       [36, 40, 44],
};

function getCategoryForAccount(accountId) {
  const id = Number(accountId);
  for (const [cat, ids] of Object.entries(LEAVE_CATEGORIES)) {
    if (ids.includes(id)) return cat;
  }
  return 'autre';
}

function getApiKey() {
  return process.env.LUCCA_API_KEY || '';
}

function luccaGet(urlPath) {
  return new Promise((resolve, reject) => {
    const apiKey = getApiKey();
    if (!apiKey) return reject(new Error('LUCCA_API_KEY not set'));
    const options = {
      hostname: LUCCA_HOST,
      path: urlPath,
      method: 'GET',
      headers: {
        'Authorization': `lucca application=${apiKey}`,
        'Accept': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status >= 400) return reject(new Error(`Lucca ${parsed.status}: ${parsed.detail || parsed.title}`));
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchAllPages(basePath, pageSize = 1000, delayMs = 300) {
  const items = [];
  let offset = 0;
  while (true) {
    const sep = basePath.includes('?') ? '&' : '?';
    const r = await luccaGet(`${basePath}${sep}paging=${offset},${pageSize}`);
    const batch = r.data?.items || [];
    items.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    await sleep(delayMs);
  }
  return items;
}

async function fullSync() {
  const FY_START = '2025-07-01';
  const FY_END   = '2026-06-30';

  console.log('[Lucca] Starting sync...');

  const users = await fetchAllPages(
    '/api/v3/users?fields=id,firstName,lastName,mail,dtContractStart,dtContractEnd,departmentId,jobTitle'
  );
  console.log(`[Lucca] ${users.length} users`);

  const userIds = users.map(u => u.id).join(',');
  await sleep(500);

  const periods = await fetchAllPages(
    `/api/v3/leavePeriods?fields=id,ownerId&ownerId=${userIds}`, 1000, 400
  );
  const periodMap = {};
  periods.forEach(p => { periodMap[p.id] = p.ownerId; });

  await sleep(1000);

  const rawLeaves = await fetchAllPages(
    `/api/v3/leaves?date=between,${FY_START},${FY_END}&leavePeriod.ownerId=${userIds}&fields=id,date,isAM,isActive,leaveAccountId,leavePeriod`,
    5000, 1000
  );

  const leaves = rawLeaves
    .filter(l => l.isActive)
    .map(l => ({
      date: (l.date || '').substring(0, 10),
      isAM: l.isAM,
      leaveAccountId: l.leaveAccountId,
      ownerId: periodMap[l.leavePeriod?.id],
      category: getCategoryForAccount(l.leaveAccountId),
    }))
    .filter(l => l.ownerId && l.date);

  const userLeaveMap = {};
  leaves.forEach(l => {
    const uid = l.ownerId;
    const month = l.date.substring(0, 7);
    const days = 0.5;
    if (!userLeaveMap[uid]) userLeaveMap[uid] = {};
    if (!userLeaveMap[uid][month]) userLeaveMap[uid][month] = {};
    const map = userLeaveMap[uid][month];
    map[l.category] = (map[l.category] || 0) + days;
  });

  const userLeaves = users.map(u => {
    const monthly = userLeaveMap[u.id] || {};
    const totals = {};
    Object.values(monthly).forEach(mData => {
      Object.entries(mData).forEach(([cat, days]) => {
        totals[cat] = (totals[cat] || 0) + days;
      });
    });
    return {
      id: u.id, firstName: u.firstName, lastName: u.lastName,
      fullName: `${u.firstName} ${u.lastName}`,
      mail: u.mail, jobTitle: u.jobTitle,
      dtContractStart: u.dtContractStart, dtContractEnd: u.dtContractEnd,
      monthly, totals,
    };
  });

  return {
    users: userLeaves,
    syncDate: new Date().toISOString(),
    counts: { users: users.length, leaves: leaves.length },
  };
}

module.exports = { fullSync };

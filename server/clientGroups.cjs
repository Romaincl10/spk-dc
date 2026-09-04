/**
 * SPK DC — Regroupement de noms clients
 * Mappe les variantes de noms Furious vers un nom canonique
 */

// Chaque cle = nom canonique (affiche), valeurs = patterns (lowercase, sans accents)
const CLIENT_GROUPS = {
  // DECATHLON group
  'DECATHLON': ['decathlon france', 'decathlon france sas', 'decathlon atelier regional ouest',
    'decathlon se', 'decathlon sports ireland limited', 'decathlon'],

  // LFP group
  'LFP': ['lfp media', 'lfp - ligue de football professionnel', 'filiale lfp 1', 'lfp'],

  // CIC group
  'CIC': ['cic eparcic', 'cic u nantes atlantique', 'credit industriel et commercial', 'cic'],

  // HUMMEL group
  'HUMMEL': ['hummel france', 'hummel global', 'hummel'],

  // INTERSPORT group (hors IIC qui a ses propres objectifs)
  'INTERSPORT FRANCE': ['intersport france', 'intersport', 'l\'academie intersport',
    'l\u0092academie intersport', 'lacademie intersport', 'l academie intersport'],

  // NIKE group
  'NIKE': ['nike france', 'nike retail bv', 'nike'],

  // ON (On Running) \u2014 entit\u00e9s groupe
  'ON': ['on ag', 'on europe ag', 'on italy s.r.l'],

  // MIZUNO group
  'MIZUNO': ['mizuno france', 'mizuno corporation emea', 'mizuno'],

  // NEW BALANCE group (I-RUN rattach\u00e9 \u00e0 New Balance)
  'NEW BALANCE': ['new balance france sarl', 'new balance', 'i-run'],

  // PUMA group (SE, Europe, France, DACH consolid\u00e9s \u2014 affich\u00e9 \u00ab PUMA \u00bb)
  'PUMA': ['puma se', 'puma europe gmbh', 'puma france sas', 'puma dach'],

  // LACOSTE group
  'LACOSTE': ['lacoste sas', 'lacoste france', 'lacoste'],

  // BROOKS group
  'BROOKS': ['brooks running', 'brooks bv', 'brooks sports sarl', 'brooks'],

  // 2RIDE group (inclut SHARK et TROPHY comme sous-marques)
  '2Ride Group': ['2ride group', 'shark', 'trophy'],

  // PUMA Motorsport (regroupement des projets motorsport)
  'PUMA Motorsport': ['puma motorsport'],

  // PSF ITALY = PUMA ITALY
  'PSF ITALY': ['psf italy', 'puma italy'],

  // GMF group (anciens projets K-numérotés + nouveaux SPK)
  'GMF ASSURANCES': ['gmf assurances', 'gmf'],

  // ABEILLE
  'ABEILLE ASSURANCES': ['abeille assurances', 'abeille assurances holding'],

  // TIKTOK group
  'TIKTOK': ['titok', 'tiktok sas', 'tiktok'],

  // KAPPA
  'KAPPA': ['kappa', 'kappa france', 'kappa s.r.l'],

  // EVENTEAM
  'EVENTEAM': ['eventeam', 'eventeam group'],

  // FFF
  'FEDERATION FRANCAISE DE FOOTBALL': ['federation francaise de football', 'fff'],

  // FFA (Athletisme)
  'FFA': ['federation francaise d\'athletisme', 'ffa'],

  // ACO (Le Mans)
  'ACO': ['aco', 'ste sportive professionnelle - aco'],

  // Fédération BB
  'FEDERATION FRANCAISE DE BASKETBALL': ['federation francaise de basketball'],

  // Fédération Sport Boules
  'FEDERATION FRANCAISE DU SPORT BOULES': ['federation francaise du sport boules'],
};

function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0080-\u009f]/g, '') // Remove control chars like \x92
    .toLowerCase().trim();
}

/**
 * Returns the canonical (grouped) name for a client
 * If no group matches, returns the original name
 */
function getCanonicalClientName(clientName) {
  const n = norm(clientName);
  for (const [canonical, patterns] of Object.entries(CLIENT_GROUPS)) {
    if (patterns.some(p => n === p)) return canonical;
  }
  return clientName;
}

/**
 * Returns canonical name for a project, considering both company name AND project title.
 * Special rule: PUMA SE + title contains "Motor" → "PUMA Motorsport"
 */
function getCanonicalClientNameForProject(companyName, projectTitle) {
  if ((norm(companyName) === 'puma se' || norm(companyName) === 'puma motorsport') && /motor/i.test(projectTitle || '')) {
    return 'PUMA Motorsport';
  }
  return getCanonicalClientName(companyName);
}

/**
 * Checks if two client names belong to the same group
 */
function isSameClient(name1, name2) {
  return getCanonicalClientName(name1) === getCanonicalClientName(name2);
}

module.exports = { getCanonicalClientName, getCanonicalClientNameForProject, isSameClient, CLIENT_GROUPS, norm };

/**
 * Update du mot de passe de Germain BUTROT pour alignement SPK Hub.
 * Usage local : node server/update-germain-pwd.cjs
 * Usage Railway : railway run npm run update-germain-pwd
 *
 * Mot de passe cible : variable d'env GERMAIN_PWD ou défaut hub.
 * Lit/écrit users.json dans DATA_DIR (Railway Volume sur /mnt/data).
 */
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NEW_PASSWORD = process.env.GERMAIN_PWD || 'zmpibMWuXhLTmnuP8p';
const LOGIN = 'germain.butrot';

async function main() {
  if (!fs.existsSync(USERS_FILE)) {
    console.error(`[update-germain-pwd] ${USERS_FILE} introuvable`);
    process.exit(1);
  }
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const u = users.find(x => x.login === LOGIN);
  if (!u) {
    console.error(`[update-germain-pwd] user ${LOGIN} introuvable`);
    process.exit(1);
  }
  u.password = await bcrypt.hash(NEW_PASSWORD, 12);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log(`[update-germain-pwd] mdp mis à jour pour ${LOGIN}`);
}

main().catch(e => { console.error(e); process.exit(1); });

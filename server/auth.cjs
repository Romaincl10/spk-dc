/**
 * SPK DC — Auth module
 * Gestion des utilisateurs DC + Admin avec JWT
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'spk-dc-secret-2026';
const JWT_EXPIRES = '24h';

// ── Helpers ──────────────────────────────────────────────

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Auth] Error loading users:', e.message);
  }
  return [];
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function initDefaultUsers() {
  const users = loadUsers();
  if (users.length > 0) return;

  console.log('[Auth] Creating default admin user...');
  const defaultUsers = [
    {
      id: 'admin-1',
      login: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      name: 'Administrateur',
      role: 'admin',
      furiousName: '',
      createdAt: new Date().toISOString(),
    },
  ];
  saveUsers(defaultUsers);
  console.log('[Auth] Default admin created (admin / admin123)');
}

// ── Auth functions ───────────────────────────────────────

function login(loginStr, password) {
  const users = loadUsers();
  const target = String(loginStr).trim().toLowerCase();
  const user = users.find(u => typeof u.login === 'string' && u.login.toLowerCase() === target);
  if (!user) return { error: 'Identifiant inconnu' };
  if (!bcrypt.compareSync(password, user.password)) return { error: 'Mot de passe incorrect' };

  const token = jwt.sign(
    { id: user.id, login: user.login, name: user.name, role: user.role, furiousName: user.furiousName },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  // Update last login
  user.lastLogin = new Date().toISOString();
  saveUsers(users);

  return {
    token,
    user: { id: user.id, login: user.login, name: user.name, role: user.role, furiousName: user.furiousName },
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const decoded = verifyToken(authHeader.split(' ')[1]);
  if (!decoded) return res.status(401).json({ error: 'Token invalide ou expire' });
  req.user = decoded;
  next();
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acces reserve aux administrateurs' });
  }
  next();
}

// ── User CRUD (admin only) ──────────────────────────────

function getUsers() {
  return loadUsers().map(u => ({
    id: u.id, login: u.login, name: u.name, role: u.role,
    furiousName: u.furiousName, lastLogin: u.lastLogin, createdAt: u.createdAt,
  }));
}

function createUser({ login: loginStr, password, name, role, furiousName }) {
  const users = loadUsers();
  if (users.find(u => u.login === loginStr)) {
    return { error: 'Ce login existe deja' };
  }
  const newUser = {
    id: `user-${Date.now()}`,
    login: loginStr,
    password: bcrypt.hashSync(password, 10),
    name: name || loginStr,
    role: role || 'dc',
    furiousName: furiousName || '',
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);
  return { user: { id: newUser.id, login: newUser.login, name: newUser.name, role: newUser.role, furiousName: newUser.furiousName } };
}

function updateUser(userId, updates) {
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return { error: 'Utilisateur non trouve' };

  if (updates.name) users[idx].name = updates.name;
  if (updates.furiousName !== undefined) users[idx].furiousName = updates.furiousName;
  if (updates.role) users[idx].role = updates.role;
  if (updates.password) users[idx].password = bcrypt.hashSync(updates.password, 10);
  if (updates.login) {
    if (users.find(u => u.login === updates.login && u.id !== userId)) {
      return { error: 'Ce login existe deja' };
    }
    users[idx].login = updates.login;
  }

  saveUsers(users);
  return { user: { id: users[idx].id, login: users[idx].login, name: users[idx].name, role: users[idx].role, furiousName: users[idx].furiousName } };
}

function deleteUser(userId) {
  const users = loadUsers();
  const filtered = users.filter(u => u.id !== userId);
  if (filtered.length === users.length) return { error: 'Utilisateur non trouve' };
  saveUsers(filtered);
  return { success: true };
}

module.exports = {
  initDefaultUsers, login, verifyToken, authMiddleware, adminOnly,
  getUsers, createUser, updateUser, deleteUser,
};

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'beaux_arts_secret_key_2026';

// 中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Session expirée ou invalide.' });
    req.user = user;
    next();
  });
}

// 注册
router.post('/register', (req, res) => {
  const { username, email, password, school, atelier, bio } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Nom d’utilisateur ou email déjà utilisé.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, school, atelier, bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(username.trim(), email.trim().toLowerCase(), password_hash, school || 'École des Beaux-Arts', atelier || '', bio || '');

    const token = jwt.sign(
      { id: Number(info.lastInsertRowid), username, email, school: school || 'École des Beaux-Arts' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: {
        id: Number(info.lastInsertRowid),
        username,
        email,
        school: school || 'École des Beaux-Arts',
        atelier: atelier || '',
        bio: bio || ''
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// 登录
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(identifier.trim(), identifier.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, school: user.school },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        school: user.school,
        atelier: user.atelier,
        bio: user.bio
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// 获取个人资料
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, school, atelier, bio, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    const count = db.prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ?').get(req.user.id);
    res.json({ user, stats: { itemsCount: count.count } });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = { router, authenticateToken, JWT_SECRET };

const path = require('node:path');
const bcrypt = require('bcryptjs');

let db = null;
let isNative = false;

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(path.join(__dirname, 'data.db'));
  isNative = true;
  console.log('[DB] Moteur natif node:sqlite activé.');
} catch (err) {
  console.log('[DB] node:sqlite non disponible. Utilisation du moteur universel JSON.');
  db = require('./db_json');
}

function initDatabase() {
  if (isNative) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT, school TEXT, atelier TEXT, bio TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, category TEXT, exchange_type TEXT, price REAL DEFAULT 0, location TEXT, description TEXT, image_url TEXT, status TEXT DEFAULT 'available', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, user1_id INTEGER, user2_id INTEGER, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER, sender_id INTEGER, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0);
    `);
  }

  const check = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!check || check.count === 0) {
    console.log('[DB] Initialisation des comptes de test...');
    const salt = bcrypt.genSaltSync(10);
    const pass = bcrypt.hashSync('beauxarts123', salt);

    const insU = db.prepare('INSERT INTO users (username, email, password_hash, school, atelier, bio) VALUES (?, ?, ?, ?, ?, ?)');
    insU.run('camille_ensba', 'camille@beauxartsparis.fr', pass, 'TALM-Tours', 'Atelier Peinture', '4e année');
    insU.run('julien_lyon', 'julien@ensba-lyon.fr', pass, 'ENSBA Lyon', 'Atelier Bois', 'Sculpture');
    insU.run('ines_ensad', 'ines@ensad.fr', pass, 'ÉnsAD Paris', 'Design Textile', 'Chutes de soies');
  }
}

initDatabase();

module.exports = db;

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
    console.log('[DB] Initialisation des données de démo...');
    const salt = bcrypt.genSaltSync(10);
    const pass = bcrypt.hashSync('beauxarts123', salt);

    const insU = db.prepare('INSERT INTO users (username, email, password_hash, school, atelier, bio) VALUES (?, ?, ?, ?, ?, ?)');
    insU.run('camille_ensba', 'camille@beauxartsparis.fr', pass, 'Beaux-Arts de Paris', 'Atelier Peinture', '4e année');
    insU.run('julien_lyon', 'julien@ensba-lyon.fr', pass, 'ENSBA Lyon', 'Atelier Bois', 'Sculpture');
    insU.run('ines_ensad', 'ines@ensad.fr', pass, 'ÉnsAD Paris', 'Design Textile', 'Chutes de soies');

    const insI = db.prepare('INSERT INTO items (user_id, title, category, exchange_type, price, location, description, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insI.run(1, '5 Châssis entoilés en lin brut (80x100cm)', 'Toiles & Châssis', 'Gratuit', 0, 'Paris 6e - Beaux-Arts, Cour vitrée', 'Toiles prêtes à peindre. À venir chercher avant vendredi.', 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800', 'available');
    insI.run(2, 'Lot de chutes de contreplaqué bouleau', 'Bois', 'Gratuit', 0, 'Lyon - ENSBA, Atelier Menuiserie', 'Découpes propres d’environ 60x90cm pour maquettes ou socles.', 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?w=800', 'available');
    insI.run(3, 'Coupons de soie sauvage et feutre dense', 'Tissus & Fibres', 'Échange', 0, 'Paris 5e - Arts Déco', 'Chutes nobles. Échange contre pigments ou fil.', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', 'available');
  }
}

initDatabase();

module.exports = db;

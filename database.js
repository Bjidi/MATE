const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data.db');
const db = new DatabaseSync(dbPath);

// 初始化数据表
function initDatabase() {
  // 1. 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      school TEXT DEFAULT 'École des Beaux-Arts',
      atelier TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. 材料发布表
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      exchange_type TEXT NOT NULL, -- 'Gratuit', 'Échange', 'Prix'
      price REAL DEFAULT 0,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      status TEXT DEFAULT 'available', -- 'available', 'reserved', 'completed'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // 3. 私信会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      user1_id INTEGER NOT NULL, -- 发起人
      user2_id INTEGER NOT NULL, -- 接收人（物品发布者）
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (user1_id) REFERENCES users(id),
      FOREIGN KEY (user2_id) REFERENCES users(id),
      UNIQUE(item_id, user1_id, user2_id)
    );
  `);

  // 4. 私信消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );
  `);

  // 检查是否有演示数据，若无则初始化示范数据
  seedInitialData();
}

function seedInitialData() {
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const result = checkStmt.get();
  if (result.count === 0) {
    console.log('Seeding demo users and items...');
    const salt = bcrypt.genSaltSync(10);
    const demoPassword = bcrypt.hashSync('beauxarts123', salt);

    // 创建示例用户
    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, school, atelier, bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('camille_ensba', 'camille@beauxartsparis.fr', demoPassword, 'Beaux-Arts de Paris', 'Atelier P2 - Peinture', 'Étudiante en 4e année. Spécialité grand format.');
    insertUser.run('julien_lyon', 'julien@ensba-lyon.fr', demoPassword, 'ENSBA Lyon', 'Atelier Volume / Bois', 'Scénographie et sculpture.');
    insertUser.run('ines_ensad', 'ines@ensad.fr', demoPassword, 'ÉnsAD Paris (Arts Déco)', 'Atelier Design Textile', 'Chutes de soies et toiles brutes.');

    // 创建示例材料
    const insertItem = db.prepare(`
      INSERT INTO items (user_id, title, category, exchange_type, price, location, description, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertItem.run(
      1,
      '5 Châssis entoilés en lin brut (80x100cm)',
      'Toiles & Châssis',
      'Gratuit',
      0,
      'Paris 6e - Beaux-Arts, Cour vitrée',
      'Reste d’un projet d’exposition. Toiles de lin apprêtées au gesso, très bon état, prêtes à peindre. À venir récupérer avant vendredi.',
      'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
      'available'
    );

    insertItem.run(
      2,
      'Lot de chutes de contreplaqué bouleau (15mm et 18mm)',
      'Bois',
      'Gratuit',
      0,
      'Lyon - ENSBA, Atelier Menuiserie RDC',
      'Plusieurs découpes propres d’environ 60x90cm et 40x120cm, idéales pour maquettes d’architecture ou socles de sculpture. Ne jetez pas, servez-vous !',
      'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?w=800&auto=format&fit=crop&q=80',
      'available'
    );

    insertItem.run(
      3,
      'Coupons de soie sauvage et chutes de feutre de laine',
      'Tissus & Fibres',
      'Échange',
      0,
      'Paris 5e - Arts Déco (rue d’Ulm)',
      'Chutes de tissus de très haute qualité (soie naturelle blanc cassé et feutre dense gris). Échange volontiers contre de la teinture naturelle ou fil à broder.',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'available'
    );

    insertItem.run(
      1,
      'Pots de pigments Sennelier (Ocre rouge & Bleu outremer)',
      'Pigments & Peintures',
      'Prix',
      5,
      'Beaux-Arts de Paris - Atelier Peinture',
      'Pots entamés à 75%. Pigments purs parfaits pour liant à l’œuf ou tempera. 5€ le lot symbolique pour racheter du médium.',
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=80',
      'available'
    );

    insertItem.run(
      2,
      'Deux socles d’exposition en MDF blanc mat (40x40x100cm)',
      'Scénographie',
      'Gratuit',
      0,
      'ENSBA Lyon - Couloir expo',
      'Servis une seule fois pour le bilan de semestre. Peints en blanc mat, légères traces faciles à repeindre.',
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
      'available'
    );

    console.log('Demo seed data populated successfully.');
  }
}

initDatabase();

module.exports = db;

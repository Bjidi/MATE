const express = require('express');
const router = express.Router();
const path = require('node:path');
const multer = require('multer');
const db = require('../database');
const { authenticateToken } = require('./auth');

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `mat_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// 获取材料列表
router.get('/', (req, res) => {
  const { category, type, search, status } = req.query;
  let sql = `
    SELECT items.*, users.username as author_name, users.school as author_school, users.atelier as author_atelier
    FROM items
    JOIN users ON items.user_id = users.id
    WHERE 1=1
  `;
  const params = [];

  if (category && category !== 'Tous') {
    sql += ' AND items.category = ?';
    params.push(category);
  }

  if (type && type !== 'Tous') {
    sql += ' AND items.exchange_type = ?';
    params.push(type);
  }

  if (status) {
    sql += ' AND items.status = ?';
    params.push(status);
  } else {
    sql += " AND items.status IN ('available', 'reserved')";
  }

  if (search && search.trim()) {
    sql += ' AND (items.title LIKE ? OR items.description LIKE ? OR items.location LIKE ? OR users.school LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY items.created_at DESC';

  try {
    const items = db.prepare(sql).all(...params);
    res.json(items);
  } catch (err) {
    console.error('Fetch items error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des matériaux.' });
  }
});

// 获取详情
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare(`
      SELECT items.*, users.username as author_name, users.school as author_school, users.atelier as author_atelier, users.email as author_email
      FROM items
      JOIN users ON items.user_id = users.id
      WHERE items.id = ?
    `).get(req.params.id);

    if (!item) return res.status(404).json({ error: 'Matériau introuvable.' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// 发布新材料
router.post('/', authenticateToken, upload.single('image'), (req, res) => {
  const { title, category, exchange_type, price, location, description } = req.body;

  if (!title || !category || !location || !description) {
    return res.status(400).json({ error: 'Titre, catégorie, lieu et description sont obligatoires.' });
  }

  let image_url = '';
  if (req.body.image_url && req.body.image_url.startsWith('data:image/')) {
    // 优先采用 Base64 数据，直接存入数据库，永不丢失！
    image_url = req.body.image_url;
  } else if (req.file) {
    // 即使上传到磁盘，也同步转为 Base64 写入数据库，防止服务器重启后丢失图片文件
    try {
      const fs = require('node:fs');
      const fileBuffer = fs.readFileSync(req.file.path);
      const mime = req.file.mimetype || 'image/jpeg';
      image_url = `data:${mime};base64,${fileBuffer.toString('base64')}`;
    } catch (err) {
      image_url = `/uploads/${req.file.filename}`;
    }
  } else if (req.body.image_url) {
    image_url = req.body.image_url;
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO items (user_id, title, category, exchange_type, price, location, description, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available')
    `);
    const parsedPrice = exchange_type === 'Prix' ? parseFloat(price) || 0 : 0;
    const info = stmt.run(
      req.user.id,
      title.trim(),
      category,
      exchange_type || 'Gratuit',
      parsedPrice,
      location.trim(),
      description.trim(),
      image_url
    );

    const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json({ message: 'Matériau publié !', item: newItem });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Erreur lors de la publication.' });
  }
});

// 状态更新（如标记送出）
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Matériau introuvable.' });
    if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé.' });

    db.prepare('UPDATE items SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Statut mis à jour.', status });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// 删除材料
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Matériau introuvable.' });
    if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé.' });

    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ message: 'Matériau supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;

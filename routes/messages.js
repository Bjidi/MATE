const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('./auth');

// 获取当前用户的全部私信对话
router.get('/conversations', authenticateToken, (req, res) => {
  const userId = req.user.id;
  try {
    const list = db.prepare(`
      SELECT 
        c.id, c.item_id, c.updated_at,
        i.title as item_title, i.image_url as item_image, i.exchange_type as item_exchange_type,
        u1.id as user1_id, u1.username as user1_username, u1.school as user1_school,
        u2.id as user2_id, u2.username as user2_username, u2.school as user2_school,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0) as unread_count
      FROM conversations c
      LEFT JOIN items i ON c.item_id = i.id
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.updated_at DESC
    `).all(userId, userId, userId);

    const formatted = list.map(c => {
      const isUser1 = c.user1_id === userId;
      return {
        id: c.id,
        item: {
          id: c.item_id,
          title: c.item_title,
          image_url: c.item_image,
          exchange_type: c.item_exchange_type
        },
        otherUser: {
          id: isUser1 ? c.user2_id : c.user1_id,
          username: isUser1 ? c.user2_username : c.user1_username,
          school: isUser1 ? c.user2_school : c.user1_school
        },
        last_message: c.last_message || 'Conversation commencée',
        last_message_time: c.last_message_time || c.updated_at,
        unread_count: c.unread_count || 0
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Fetch conv error:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// 获取某一对话的所有消息
router.get('/conversations/:id/messages', authenticateToken, (req, res) => {
  const convId = req.params.id;
  const userId = req.user.id;

  try {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
      return res.status(403).json({ error: 'Accès interdit.' });
    }

    // 标为已读
    db.prepare('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?').run(convId, userId);

    const msgs = db.prepare(`
      SELECT m.*, u.username as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `).all(convId);

    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// 发送私信
router.post('/messages', authenticateToken, (req, res) => {
  const { recipient_id, item_id, conversation_id, content } = req.body;
  const senderId = req.user.id;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message vide.' });
  }

  try {
    let convId = conversation_id;

    if (!convId) {
      if (!recipient_id) return res.status(400).json({ error: 'Destinataire manquant.' });
      if (Number(recipient_id) === senderId) {
        return res.status(400).json({ error: 'Impossible de vous envoyer un message à vous-même.' });
      }

      // 查找是否已有对话
      const existing = db.prepare(`
        SELECT id FROM conversations
        WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
          AND ((item_id = ?) OR (item_id IS NULL AND ? IS NULL))
      `).get(senderId, recipient_id, recipient_id, senderId, item_id || null, item_id || null);

      if (existing) {
        convId = existing.id;
      } else {
        const stmt = db.prepare(`
          INSERT INTO conversations (item_id, user1_id, user2_id, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        const info = stmt.run(item_id || null, senderId, Number(recipient_id));
        convId = Number(info.lastInsertRowid);
      }
    }

    const ins = db.prepare(`
      INSERT INTO messages (conversation_id, sender_id, content, created_at, is_read)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)
    `);
    const info = ins.run(convId, senderId, content.trim());

    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(convId);

    const message = db.prepare(`
      SELECT m.*, u.username as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(Number(info.lastInsertRowid));

    res.status(201).json({ conversation_id: convId, message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Erreur lors de l’envoi.' });
  }
});

// 未读小红点
router.get('/unread-count', authenticateToken, (req, res) => {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as unread
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.user1_id = ? OR c.user2_id = ?)
        AND m.sender_id != ?
        AND m.is_read = 0
    `).get(req.user.id, req.user.id, req.user.id);
    res.json({ unread: row.unread || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;

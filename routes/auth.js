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

const nodemailer = require('nodemailer');

// 内存验证码存储 (email -> { code, expiresAt })
const resetCodes = new Map();

// 邮件发送辅助函数
async function sendResetEmail(toEmail, code) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    try {
      const isHotmail = user.includes('@hotmail') || user.includes('@outlook') || host.includes('hotmail') || host.includes('outlook') || host.includes('office365');

      const transportConfig = isHotmail ? {
        service: 'hotmail',
        auth: { user: user.trim(), pass: pass.trim() }
      } : {
        host: host.trim(),
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: user.trim(), pass: pass.trim() },
        tls: { rejectUnauthorized: false }
      };

      const transporter = nodemailer.createTransport({
        ...transportConfig,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000
      });

      // Hotmail/Outlook 严格要求 发件人 (from) 必须与认证用户名完全一致
      const fromAddress = isHotmail ? user.trim() : (process.env.SMTP_FROM || `"MATE Beaux-Arts" <${user.trim()}>`);

      await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: '[MATE] Code de réinitialisation de mot de passe',
        text: `Bonjour,\n\nVoici votre code à 6 chiffres pour réinitialiser votre mot de passe sur la plateforme MATE : ${code}\n\nCe code est valable pendant 15 minutes.\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.\n\nL’équipe MATE\nContact : MATE_Arts@hotmail.com`,
        html: `
          <div style="font-family:sans-serif; max-width:500px; border:2px solid #000; padding:2rem; background:#fff;">
            <h1 style="font-size:1.5rem; margin-top:0; letter-spacing:-0.03em;">MATE · Beaux-Arts</h1>
            <p>Bonjour,</p>
            <p>Voici votre code de vérification pour réinitialiser votre mot de passe :</p>
            <div style="font-size:2.2rem; font-weight:900; letter-spacing:0.25em; padding:1.2rem; background:#f4f4f4; text-align:center; border:2px solid #000; margin:1.5rem 0; font-family:monospace;">
              ${code}
            </div>
            <p style="font-size:0.85rem; color:#666;">Ce code est strictement personnel et valable pendant 15 minutes.</p>
            <hr style="border:none; border-top:1px solid #eee; margin:1.5rem 0;" />
            <p style="font-size:0.75rem; color:#999;">MATE · Réseau d’échange pour les écoles d’art · Contact : MATE_Arts@hotmail.com</p>
          </div>
        `
      });
      console.log(`[EMAIL] Code envoyé avec succès à ${toEmail}`);
      return { sent: true };
    } catch (err) {
      console.error('[EMAIL ERROR]', err.message);
      return { sent: false, error: err.message };
    }
  } else {
    console.log(`[EMAIL] SMTP non configuré. Veuillez définir SMTP_HOST, SMTP_USER, SMTP_PASS.`);
    return { sent: false, notConfigured: true };
  }
}

// 申请重置密码（发送验证码）
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Veuillez saisir votre adresse email.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Aucun compte associé à cette adresse email.' });
    }

    // 生成 6 位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15分钟有效
    resetCodes.set(cleanEmail, { code, expiresAt });

    const mailResult = await sendResetEmail(cleanEmail, code);

    if (!mailResult.sent) {
      if (mailResult.notConfigured) {
        return res.status(503).json({
          error: "Le service d'envoi d'emails est en attente de configuration SMTP. Contactez l'administrateur : MATE_Arts@hotmail.com."
        });
      } else {
        return res.status(502).json({
          error: `Échec d'envoi de l'email (${mailResult.error || 'Erreur SMTP'}). Veuillez vérifier le mot de passe d'application ou contacter MATE_Arts@hotmail.com.`
        });
      }
    }

    // 发送成功：绝不向客户端暴露验证码数字！
    res.json({
      message: 'Un code de vérification à 6 chiffres vous a été envoyé par email.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation.' });
  }
});

// 输入验证码与新密码，完成重置
router.post('/reset-password', (req, res) => {
  const { email, code, new_password } = req.body;
  if (!email || !code || !new_password) {
    return res.status(400).json({ error: 'Email, code et nouveau mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = resetCodes.get(cleanEmail);

  if (!record) {
    return res.status(400).json({ error: 'Aucun code demandé pour cette adresse ou code déjà utilisé.' });
  }

  if (Date.now() > record.expiresAt) {
    resetCodes.delete(cleanEmail);
    return res.status(400).json({ error: 'Ce code a expiré. Veuillez refaire une demande.' });
  }

  if (record.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Code de vérification incorrect.' });
  }

  try {
    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(new_password, salt);

    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(newHash, cleanEmail);
    resetCodes.delete(cleanEmail);

    res.json({ message: 'Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe.' });
  }
});

module.exports = { router, authenticateToken, JWT_SECRET };

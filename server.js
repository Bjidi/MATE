const express = require('express');
const path = require('node:path');
const cors = require('cors');

const authModule = require('./routes/auth');
const itemsRouter = require('./routes/items');
const messagesRouter = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 静态资源与图片上传目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// 挂载路由
app.use('/api/auth', authModule.router);
app.use('/api/items', itemsRouter);
app.use('/api/messages', messagesRouter);

// 单页前端兜底路由
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(` MATE — Échange · Beaux-Arts`);
  console.log(` Plateforme active : http://0.0.0.0:${PORT}`);
  console.log(`=================================================`);
});

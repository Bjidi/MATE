# MATÉRIAUX — Bourse Circulaire des Beaux-Arts (France)

Plateforme d'échange, de don et de réemploi de matériaux créatifs pour étudiants et artistes des Écoles Supérieures d'Art (Beaux-Arts, ÉnsAD, Villa Arson, etc.).

---

## 🎨 特色与设计
1. **风格**：极简黑白排版（Minimalist Monochrome / Swiss Style），高对比度设计，专为艺术学院工作室量身定制。
2. **多用户与密码系统**：支持自主注册账号、密码安全哈希（bcrypt）、JWT 身份凭证。
3. **材料发布系统**：支持本地照片上传预览、分类（画布画框、木材、布料、颜料、展台道具等）、标价/免费赠送/以物易物状态标记。
4. **实时私信对话（Messagerie Privée）**：针对具体材料直接向发布者发起私信交流，包含会话列表、聊天气泡、未读红点提示与轮询刷新。
5. **极简超轻量**：基于 Node.js + 原生 SQLite，单机内存占用仅约 30MB，部署在最基础的 3-5 欧/月法国服务器（OVH / Scaleway）上即可极其流畅运行。

---

## 🚀 本地运行与体验

服务当前已在后台启动，直接在浏览器中打开：
👉 **http://localhost:3000**

如需手动重启：
```bash
cd /Users/boliblc/.cline/data/workspaces/chat/materiaux_exchange_fr
node server.js
```

---

## 👥 预置的演示账号（1键登录或手动输入）
* 账号 1：`camille_ensba`（密码：`beauxarts123`）— Beaux-Arts de Paris
* 账号 2：`julien_lyon`（密码：`beauxarts123`）— ENSBA Lyon
* 账号 3：`ines_ensad`（密码：`beauxarts123`）— ÉnsAD Paris (Arts Déco)

您可以在登录弹窗中直接点击顶部的“一键测试按钮”快速切换不同美院同学的身份，测试互相发私信沟通。

---

## 🚢 部署到法国服务器（如 OVH / Scaleway）
1. 购买一个 `.fr` 域名（约 7€/年）。
2. 开通一台最基础的 VPS（如 OVH VPS Starter，约 4€/月）。
3. 使用 `pm2 start server.js --name materiaux` 守护进程常驻运行即可。

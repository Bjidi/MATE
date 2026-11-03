// MATÉRIAUX — Frontend Application Logic

const app = {
  token: localStorage.getItem('mat_token') || null,
  user: null,
  items: [],
  currentCategory: 'Tous',
  currentType: 'Tous',
  searchQuery: '',
  conversations: [],
  activeConversationId: null,
  activeItemContext: null,
  pollInterval: null,

  async init() {
    this.setupAuthUI();
    await this.fetchCurrentUser();
    await this.loadItems();
    this.checkUnread();

    // 每 4 秒轮询未读消息
    setInterval(() => {
      if (this.token) this.checkUnread();
    }, 4000);
  },

  // 认证状态 UI 更新
  setupAuthUI() {
    const area = document.getElementById('auth-nav-area');
    if (!area) return;

    if (this.user) {
      area.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <span style="font-family:var(--font-mono); font-size:0.75rem; border:1px solid #000; padding:0.3rem 0.6rem;">
            ● ${this.escape(this.user.username)} (${this.escape(this.user.email || '')})
          </span>
          <button class="btn btn-small" onclick="app.logout()">Déconnexion</button>
        </div>
      `;
    } else {
      area.innerHTML = `
        <button class="btn" onclick="app.openAuthModal('login')">Connexion / Inscription</button>
      `;
    }
  },

  async fetchCurrentUser() {
    if (!this.token) {
      this.user = null;
      this.setupAuthUI();
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        this.setupAuthUI();
      } else {
        this.logout();
      }
    } catch (e) {
      console.warn('Auth check error:', e);
    }
  },

  // 加载材料列表
  async loadItems() {
    const grid = document.getElementById('items-grid');
    grid.innerHTML = '<div style="font-family:var(--font-mono); color:var(--text-muted); padding:2rem 0;">Chargement des annonces...</div>';

    try {
      const params = new URLSearchParams();
      if (this.currentCategory !== 'Tous') params.append('category', this.currentCategory);
      if (this.currentType !== 'Tous') params.append('type', this.currentType);
      if (this.searchQuery) params.append('search', this.searchQuery);

      const res = await fetch(`/api/items?${params.toString()}`);
      this.items = await res.json();
      this.renderGrid(this.items);
    } catch (e) {
      grid.innerHTML = '<div style="color:red; font-family:var(--font-mono);">Erreur de chargement.</div>';
    }
  },

  // 渲染材料卡片网格
  renderGrid(items) {
    const grid = document.getElementById('items-grid');
    if (!items || items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; padding: 4rem 2rem; border: 1.5px dashed var(--border); text-align: center;">
          <p style="font-weight: 700; font-size: 1.2rem; margin-bottom: 0.5rem;">Aucun matériau ne correspond à vos critères.</p>
          <p style="color:var(--text-muted); font-size: 0.85rem; font-family:var(--font-mono);">Soyez le premier de votre atelier à proposer un don ou un troc !</p>
          <button class="btn btn-primary" style="margin-top:1.5rem;" onclick="app.openPublishModal()">+ Publier un matériau</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(item => {
      const isFree = item.exchange_type === 'Gratuit';
      const badgeClass = isFree ? 'badge-black' : 'badge-white';
      const badgeText = isFree ? '● GRATUIT' : (item.exchange_type === 'Prix' ? `${item.price} €` : '⇄ TROC');
      const img = item.image_url || 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80';

      return `
        <div class="item-card" onclick="app.openDetail(${item.id})">
          <div class="card-img-wrapper">
            <span class="badge ${badgeClass} card-badge">${badgeText}</span>
            <img src="${this.escape(img)}" class="card-img" alt="${this.escape(item.title)}" loading="lazy">
          </div>
          <div class="card-content">
            <div class="card-category">${this.escape(item.category)}</div>
            <h3 class="card-title">${this.escape(item.title)}</h3>
            <div class="card-location">📍 ${this.escape(item.location)}</div>
            <div class="card-footer">
              <span>Par @${this.escape(item.author_name)}</span>
              <span style="color:var(--text-muted);">${this.timeAgo(item.created_at)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // 筛选器
  setCategory(cat) {
    this.currentCategory = cat;
    document.querySelectorAll('[data-cat]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-cat') === cat);
    });
    this.loadItems();
  },

  setType(type) {
    this.currentType = type;
    document.querySelectorAll('[data-type]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-type') === type);
    });
    this.loadItems();
  },

  handleSearch(val) {
    this.searchQuery = val.trim();
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadItems(), 250);
  },

  showHome() {
    this.currentCategory = 'Tous';
    this.currentType = 'Tous';
    this.searchQuery = '';
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    this.setCategory('Tous');
    this.setType('Tous');
  },

  // 详情模态框
  async openDetail(id) {
    try {
      const res = await fetch(`/api/items/${id}`);
      if (!res.ok) return alert('Matériau introuvable.');
      const item = await res.json();

      document.getElementById('detail-category').innerText = item.category;
      const typeBadge = document.getElementById('detail-type');
      typeBadge.innerText = item.exchange_type === 'Gratuit' ? '● DON GRATUIT' : (item.exchange_type === 'Prix' ? `${item.price} €` : '⇄ TROC');

      const isAuthor = this.user && this.user.id === item.user_id;
      const img = item.image_url || 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=80';

      const body = document.getElementById('detail-body');
      body.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.8rem; margin-top:1rem;">
          <div>
            <img src="${this.escape(img)}" style="width:100%; border:1.5px solid var(--border); max-height:420px; object-fit:cover;" alt="Photo">
          </div>
          <div style="display:flex; flex-direction:column;">
            <h2 style="font-size:1.6rem; font-weight:800; line-height:1.2; margin-bottom:0.8rem;">${this.escape(item.title)}</h2>
            
            <div style="background:#fafafa; border:1px solid #e0e0e0; padding:1rem; margin-bottom:1.2rem; font-family:var(--font-mono); font-size:0.75rem;">
              <div><strong>PROPOSÉ PAR :</strong> @${this.escape(item.author_name)}</div>
              <div><strong>ÉTABLISSEMENT :</strong> ${this.escape(item.author_school || 'Non spécifié')}</div>
              <div><strong>ATELIER :</strong> ${this.escape(item.author_atelier || 'Non spécifié')}</div>
              <div style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px dashed #ccc;"><strong>📍 RETRAIT :</strong> ${this.escape(item.location)}</div>
            </div>

            <div style="font-size:0.95rem; line-height:1.6; margin-bottom:1.5rem; white-space:pre-wrap;">${this.escape(item.description)}</div>

            <div style="margin-top:auto; padding-top:1rem; border-top:1.5px solid var(--border); display:flex; gap:0.8rem; flex-wrap:wrap;">
              ${isAuthor ? `
                <button class="btn btn-primary" onclick="app.toggleItemStatus(${item.id}, '${item.status === 'available' ? 'completed' : 'available'}')">
                  ${item.status === 'available' ? '✓ Marquer comme donné/échangé' : 'Remettre disponible'}
                </button>
                <button class="btn" style="color:red; border-color:red;" onclick="app.deleteItem(${item.id})">Supprimer l'annonce</button>
              ` : `
                <button class="btn btn-primary" style="flex:1; justify-content:center;" onclick="app.startChatFromItem(${item.id}, ${item.user_id}, '${this.escape(item.title)}')">
                  ✉️ Écrire à l'artiste (Envoyer un message)
                </button>
              `}
            </div>
          </div>
        </div>
      `;

      this.openModal('detail-modal');
    } catch (e) {
      alert('Erreur lors du chargement des détails.');
    }
  },

  // 发布材料
  openPublishModal() {
    if (!this.token) {
      alert('Veuillez vous connecter pour publier un matériau.');
      this.openAuthModal('login');
      return;
    }
    document.getElementById('publish-form').reset();
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('price-field').style.display = 'none';
    this.openModal('publish-modal');
  },

  handleTypeChange(val) {
    const priceField = document.getElementById('price-field');
    priceField.style.display = val === 'Prix' ? 'block' : 'none';
  },

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      // 客户端压缩图片并转换为持久化 Base64，防止服务器重启丢失文件
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);

          this._compressedImageBase64 = base64;
          const preview = document.getElementById('image-preview');
          preview.src = base64;
          preview.style.display = 'inline-block';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  },

  async handlePublishSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('publish-submit-btn');
    btn.disabled = true;
    btn.innerText = 'Publication en cours...';

    const form = event.target;
    const formData = new FormData(form);
    if (this._compressedImageBase64) {
      formData.set('image_url', this._compressedImageBase64);
    }

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        this._compressedImageBase64 = null;
        this.closeModal('publish-modal');
        await this.loadItems();
        alert('Votre annonce a été publiée avec succès !');
      } else {
        alert(data.error || 'Erreur lors de la publication.');
      }
    } catch (e) {
      alert('Erreur réseau.');
    } finally {
      btn.disabled = false;
      btn.innerText = "Diffuser l'annonce";
    }
  },

  async toggleItemStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/items/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        this.closeModal('detail-modal');
        this.loadItems();
      }
    } catch (e) {
      alert('Erreur.');
    }
  },

  async deleteItem(id) {
    if (!confirm('Supprimer définitivement cette annonce ?')) return;
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        this.closeModal('detail-modal');
        this.loadItems();
      }
    } catch (e) {
      alert('Erreur.');
    }
  },

  // ==================== MESSAGING (私信功能) ====================

  async startChatFromItem(itemId, recipientId, itemTitle) {
    if (!this.token) {
      alert('Veuillez vous connecter pour envoyer un message.');
      this.closeModal('detail-modal');
      this.openAuthModal('login');
      return;
    }
    if (this.user && this.user.id === recipientId) {
      return alert('Vous êtes l\'auteur de cette annonce.');
    }

    this.closeModal('detail-modal');
    this.openModal('messages-modal');

    // 发起与该物品相关的会话
    this.activePendingItem = { itemId, recipientId, itemTitle };
    await this.loadConversations();

    // 检查是否已有该会话
    const found = this.conversations.find(c => c.item && c.item.id === itemId && c.otherUser.id === recipientId);
    if (found) {
      this.selectConversation(found.id);
    } else {
      // 准备新对话界面
      document.getElementById('chat-with-user').innerText = `Contacter l'auteur au sujet de :`;
      document.getElementById('chat-item-context').innerText = `📦 ${itemTitle}`;
      document.getElementById('chat-messages').innerHTML = `
        <div style="background:#f9f9f9; border:1px dashed #ccc; padding:1.2rem; text-align:center; font-size:0.85rem; font-family:var(--font-mono);">
          Écrivez votre premier message ci-dessous pour convenir d'un rendez-vous à l'atelier.<br>
          <span style="color:var(--text-muted);">Objet : ${this.escape(itemTitle)}</span>
        </div>
      `;
      document.getElementById('chat-input-area').style.display = 'flex';
      this.activeConversationId = null;
      document.getElementById('chat-input').focus();
    }
  },

  async openMessagesModal() {
    if (!this.token) {
      alert('Veuillez vous connecter pour voir vos messages.');
      this.openAuthModal('login');
      return;
    }
    this.openModal('messages-modal');
    await this.loadConversations();
    if (this.conversations.length > 0 && !this.activeConversationId) {
      this.selectConversation(this.conversations[0].id);
    }
  },

  async loadConversations() {
    try {
      const res = await fetch('/api/messages/conversations', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        this.conversations = await res.json();
        this.renderConversationsList();
      }
    } catch (e) {
      console.error(e);
    }
  },

  renderConversationsList() {
    const list = document.getElementById('inbox-list');
    if (!this.conversations || this.conversations.length === 0) {
      list.innerHTML = `
        <div style="padding:2rem 1rem; text-align:center; color:var(--text-muted); font-size:0.8rem; font-family:var(--font-mono);">
          Aucune conversation pour l’instant.
        </div>
      `;
      return;
    }

    list.innerHTML = this.conversations.map(c => {
      const isActive = c.id === this.activeConversationId;
      const unreadBadge = c.unread_count > 0 ? `<span class="badge-count">${c.unread_count}</span>` : '';
      return `
        <div class="inbox-item ${isActive ? 'active' : ''}" onclick="app.selectConversation(${c.id})">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <strong style="font-size:0.85rem;">@${this.escape(c.otherUser.username)}</strong>
            <span style="font-size:0.65rem; color:var(--text-muted); font-family:var(--font-mono);">${this.timeAgo(c.last_message_time)}</span>
          </div>
          <div style="font-size:0.75rem; color:#444; font-family:var(--font-mono); margin-bottom:0.3rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${c.item ? `📦 ${this.escape(c.item.title)}` : ''}
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; justify-content:space-between;">
            <span>${this.escape(c.last_message)}</span>
            ${unreadBadge}
          </div>
        </div>
      `;
    }).join('');
  },

  async selectConversation(convId) {
    this.activeConversationId = convId;
    this.renderConversationsList();

    const conv = this.conversations.find(c => c.id === convId);
    if (conv) {
      document.getElementById('chat-with-user').innerText = `Discussion avec @${conv.otherUser.username} (${conv.otherUser.school || 'Artiste'})`;
      document.getElementById('chat-item-context').innerText = conv.item ? `📦 Matériau : ${conv.item.title}` : '';
    }
    document.getElementById('chat-input-area').style.display = 'flex';
    document.getElementById('chat-input').focus();

    await this.loadMessages(convId);
    this.checkUnread();

    clearInterval(this._activeChatTimer);
    this._activeChatTimer = setInterval(() => {
      if (this.activeConversationId === convId) {
        this.loadMessages(convId, true);
      }
    }, 2500);
  },

  async loadMessages(convId, silent = false) {
    try {
      const res = await fetch(`/api/messages/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const msgs = await res.json();
        const container = document.getElementById('chat-messages');
        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 80;

        container.innerHTML = msgs.map(m => {
          const isMine = this.user && m.sender_id === this.user.id;
          return `
            <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
              <div style="font-size:0.7rem; opacity:0.7; font-family:var(--font-mono); margin-bottom:0.2rem;">
                ${isMine ? 'Moi' : `@${this.escape(m.sender_name)}`} · ${this.formatTime(m.created_at)}
              </div>
              <div style="word-break:break-word;">${this.escape(m.content)}</div>
            </div>
          `;
        }).join('');

        if (!silent || isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';
    const payload = { content };

    if (this.activeConversationId) {
      payload.conversation_id = this.activeConversationId;
    } else if (this.activePendingItem) {
      payload.recipient_id = this.activePendingItem.recipientId;
      payload.item_id = this.activePendingItem.itemId;
    } else {
      return alert('Aucun destinataire sélectionné.');
    }

    try {
      const res = await fetch('/api/messages/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        this.activeConversationId = data.conversation_id;
        this.activePendingItem = null;
        await this.loadConversations();
        await this.loadMessages(this.activeConversationId);
      } else {
        alert(data.error || 'Erreur envoi.');
      }
    } catch (e) {
      alert('Erreur réseau.');
    }
  },

  async checkUnread() {
    if (!this.token) return;
    try {
      const res = await fetch('/api/messages/unread-count', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const badge = document.getElementById('unread-badge');
        if (badge) {
          if (data.unread > 0) {
            badge.innerText = data.unread;
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }
      }
    } catch (e) {}
  },

  // ==================== AUTH & MODAL HELPERS ====================

  openAuthModal(mode = 'login') {
    this.toggleAuthMode(mode);
    this.openModal('auth-modal');
  },

  toggleAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const resetForm = document.getElementById('reset-form');
    const title = document.getElementById('auth-modal-title');

    // 重置按钮文本与状态
    if (forgotForm) {
      const btn = forgotForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.innerText = 'Envoyer le code'; }
    }
    if (resetForm) {
      const btn = resetForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.innerText = 'Confirmer le nouveau mot de passe'; }
    }

    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'none';
    if (forgotForm) forgotForm.style.display = 'none';
    if (resetForm) resetForm.style.display = 'none';

    if (mode === 'login') {
      loginForm.style.display = 'block';
      title.innerText = 'CONNEXION';
    } else if (mode === 'register') {
      regForm.style.display = 'block';
      title.innerText = 'CRÉER UN COMPTE MATE';
    } else if (mode === 'forgot') {
      forgotForm.style.display = 'block';
      title.innerText = 'MOT DE PASSE OUBLIÉ';
    } else if (mode === 'reset') {
      resetForm.style.display = 'block';
      title.innerText = 'RÉINITIALISER LE MOT DE PASSE';
    }
  },

  async handleForgotSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    const email = form.email.value.trim();
    if (!email) return;

    btn.disabled = true;
    btn.innerText = 'Envoi en cours...';

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        this._pendingResetEmail = email;
        const resetEmailInput = document.getElementById('reset-email-input');
        if (resetEmailInput) resetEmailInput.value = email;

        // 安全提示：仅告知已发送到邮箱，不暴露具体验证码数字！
        alert(`Un code de vérification à 6 chiffres a été envoyé à l’adresse : ${email}\n\nVeuillez vérifier votre boîte de réception (ainsi que vos dossiers spams / courriers indésirables).`);
        this.toggleAuthMode('reset');
      } else {
        alert(data.error || 'Erreur lors de l’envoi.');
      }
    } catch (e) {
      alert('Erreur réseau ou délai d’attente dépassé.');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Envoyer le code';
    }
  },

  async handleResetSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    const email = form.email.value.trim() || this._pendingResetEmail;
    const code = form.code.value.trim();
    const new_password = form.new_password.value;

    if (!email || !code || !new_password) return alert('Tous les champs sont requis.');

    btn.disabled = true;
    btn.innerText = 'Mise à jour...';

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Mot de passe modifié avec succès ! Connectez-vous avec votre nouveau mot de passe.');
        this.toggleAuthMode('login');
      } else {
        alert(data.error || 'Erreur de réinitialisation.');
      }
    } catch (e) {
      alert('Erreur réseau.');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Confirmer le nouveau mot de passe';
    }
  },

  async handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const identifier = form.identifier.value;
    const password = form.password.value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (res.ok) {
        this.setSession(data.token, data.user);
        this.closeModal('auth-modal');
      } else {
        alert(data.error || 'Identifiant ou mot de passe incorrect.');
      }
    } catch (e) {
      alert('Erreur réseau.');
    }
  },

  async handleRegisterSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const payload = {
      username: form.username.value,
      email: form.email.value,
      password: form.password.value,
      school: form.school.value,
      atelier: form.atelier.value
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        this.setSession(data.token, data.user);
        this.closeModal('auth-modal');
      } else {
        alert(data.error || 'Erreur lors de la création du compte.');
      }
    } catch (e) {
      alert('Erreur réseau.');
    }
  },

  async quickLogin(username) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: username, password: 'beauxarts123' })
      });
      const data = await res.json();
      if (res.ok) {
        this.setSession(data.token, data.user);
        this.closeModal('auth-modal');
      }
    } catch (e) {
      alert('Erreur.');
    }
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('mat_token', token);
    this.setupAuthUI();
    this.loadItems();
    this.checkUnread();
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('mat_token');
    clearInterval(this._activeChatTimer);
    this.setupAuthUI();
    this.loadItems();
    const badge = document.getElementById('unread-badge');
    if (badge) badge.style.display = 'none';
  },

  openModal(id) {
    document.getElementById(id).classList.add('active');
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'messages-modal') {
      clearInterval(this._activeChatTimer);
    }
  },

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  },

  timeAgo(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'À l’instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return `Il y a ${Math.floor(diff / 86400)} j`;
  }
};

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});






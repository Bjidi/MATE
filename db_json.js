const path = require('node:path');
const fs = require('node:fs');

const file = path.join(__dirname, 'data.json');
let data = { users: [], items: [], conversations: [], messages: [] };

if (fs.existsSync(file)) {
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e){}
}

const save = () => {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch(e){}
};

const nextId = (arr) => arr.length ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1;

const jsonDb = {
  exec() {},
  prepare(sql) {
    const q = sql.replace(/\s+/g, ' ').trim();
    return {
      get(...params) {
        if (q.includes('COUNT(*) as count FROM users')) return { count: data.users.length };
        if (q.includes('FROM users WHERE username = ? OR email = ?')) {
          const [u, e] = params;
          return data.users.find(x => x.username.toLowerCase() === String(u).toLowerCase() || x.email.toLowerCase() === String(e).toLowerCase()) || null;
        }
        if (q.includes('FROM users WHERE id = ?')) {
          const u = data.users.find(x => x.id === Number(params[0]));
          return u ? { id: u.id, username: u.username, email: u.email, school: u.school, atelier: u.atelier, bio: u.bio, created_at: u.created_at } : null;
        }
        if (q.includes('COUNT(*) as count FROM items WHERE user_id = ?')) {
          return { count: data.items.filter(x => x.user_id === Number(params[0])).length };
        }
        if (q.includes('FROM items') && q.includes('WHERE items.id = ?')) {
          const it = data.items.find(x => x.id === Number(params[0]));
          if (!it) return null;
          const u = data.users.find(x => x.id === it.user_id) || {};
          return { ...it, author_name: u.username, author_school: u.school, author_atelier: u.atelier, author_email: u.email };
        }
        if (q.includes('FROM items WHERE id = ?')) {
          return data.items.find(x => x.id === Number(params[0])) || null;
        }
        if (q.includes('FROM conversations') && q.includes('WHERE id = ?')) {
          return data.conversations.find(x => x.id === Number(params[0])) || null;
        }
        if (q.includes('FROM conversations') && q.includes('user1_id = ?')) {
          const [sId, rId, , , itId] = params;
          return data.conversations.find(c => {
            const uMatch = (c.user1_id === sId && c.user2_id === rId) || (c.user1_id === rId && c.user2_id === sId);
            const iMatch = (!itId && !c.item_id) || (c.item_id === itId);
            return uMatch && iMatch;
          }) || null;
        }
        if (q.includes('COUNT(*) as unread')) {
          const uid = params[2];
          let count = 0;
          data.conversations.forEach(c => {
            if (c.user1_id === uid || c.user2_id === uid) {
              count += data.messages.filter(m => m.conversation_id === c.id && m.sender_id !== uid && m.is_read === 0).length;
            }
          });
          return { unread: count, unread_total: count };
        }
        return null;
      },

      all(...params) {
        if (q.includes('FROM items JOIN users')) {
          let list = data.items.map(it => {
            const u = data.users.find(x => x.id === it.user_id) || {};
            return { ...it, author_name: u.username, author_school: u.school, author_atelier: u.atelier };
          });
          params.forEach(p => {
            const val = String(p);
            if (val.startsWith('%') && val.endsWith('%')) {
              const term = val.slice(1, -1).toLowerCase();
              list = list.filter(it => (it.title && it.title.toLowerCase().includes(term)) || (it.description && it.description.toLowerCase().includes(term)) || (it.location && it.location.toLowerCase().includes(term)) || (it.author_school && it.author_school.toLowerCase().includes(term)));
            } else if (['Toiles & Châssis', 'Bois', 'Tissus & Fibres', 'Pigments & Peintures', 'Scénographie', 'Métal & Verre', 'Outils & Équipement', 'Autres'].includes(val)) {
              list = list.filter(it => it.category === val);
            } else if (['Gratuit', 'Échange', 'Prix'].includes(val)) {
              list = list.filter(it => it.exchange_type === val);
            } else if (['available', 'reserved', 'completed'].includes(val)) {
              list = list.filter(it => it.status === val);
            }
          });
          return list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        }
        if (q.includes('FROM conversations c')) {
          const uid = params[0];
          const myConvs = data.conversations.filter(c => c.user1_id === uid || c.user2_id === uid);
          myConvs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
          return myConvs.map(c => {
            const u1 = data.users.find(u => u.id === c.user1_id) || {};
            const u2 = data.users.find(u => u.id === c.user2_id) || {};
            const it = data.items.find(i => i.id === c.item_id) || {};
            const msgs = data.messages.filter(m => m.conversation_id === c.id);
            const lastMsg = msgs[msgs.length - 1];
            return {
              id: c.id, item_id: c.item_id, updated_at: c.updated_at,
              item_title: it.title || '', item_image: it.image_url || '', item_exchange_type: it.exchange_type || '', item_status: it.status || '',
              user1_id: c.user1_id, user1_username: u1.username || '', user1_school: u1.school || '',
              user2_id: c.user2_id, user2_username: u2.username || '', user2_school: u2.school || '',
              last_message: lastMsg ? lastMsg.content : '', last_message_time: lastMsg ? lastMsg.created_at : c.updated_at,
              unread_count: msgs.filter(m => m.sender_id !== uid && m.is_read === 0).length
            };
          });
        }
        if (q.includes('FROM messages m JOIN users u')) {
          const cid = Number(params[0]);
          return data.messages.filter(m => m.conversation_id === cid).map(m => {
            const u = data.users.find(x => x.id === m.sender_id) || {};
            return { ...m, sender_name: u.username || 'Inconnu' };
          });
        }
        return [];
      },

      run(...params) {
        if (q.includes('INSERT INTO users')) {
          const [username, email, password_hash, school, atelier, bio] = params;
          const id = nextId(data.users);
          data.users.push({ id, username, email, password_hash, school, atelier, bio, created_at: new Date().toISOString() });
          save();
          return { lastInsertRowid: id };
        }
        if (q.includes('INSERT INTO items')) {
          const [user_id, title, category, exchange_type, price, location, description, image_url, status] = params;
          const id = nextId(data.items);
          data.items.push({ id, user_id, title, category, exchange_type, price, location, description, image_url, status: status || 'available', created_at: new Date().toISOString() });
          save();
          return { lastInsertRowid: id };
        }
        if (q.includes('UPDATE items SET status = ? WHERE id = ?')) {
          const it = data.items.find(x => x.id === Number(params[1]));
          if (it) it.status = params[0];
          save();
          return { changes: 1 };
        }
        if (q.includes('DELETE FROM items WHERE id = ?')) {
          data.items = data.items.filter(x => x.id !== Number(params[0]));
          save();
          return { changes: 1 };
        }
        if (q.includes('INSERT INTO conversations')) {
          const id = nextId(data.conversations);
          data.conversations.push({ id, item_id: params[0], user1_id: params[1], user2_id: params[2], updated_at: new Date().toISOString() });
          save();
          return { lastInsertRowid: id };
        }
        if (q.includes('UPDATE conversations SET updated_at')) {
          const c = data.conversations.find(x => x.id === Number(params[0]));
          if (c) c.updated_at = new Date().toISOString();
          save();
          return { changes: 1 };
        }
        if (q.includes('INSERT INTO messages')) {
          const id = nextId(data.messages);
          data.messages.push({ id, conversation_id: params[0], sender_id: params[1], content: params[2], created_at: new Date().toISOString(), is_read: 0 });
          save();
          return { lastInsertRowid: id };
        }
        if (q.includes('UPDATE messages SET is_read = 1')) {
          const [cid, uid] = params;
          data.messages.forEach(m => {
            if (m.conversation_id === Number(cid) && m.sender_id !== uid) m.is_read = 1;
          });
          save();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    };
  }
};

module.exports = jsonDb;


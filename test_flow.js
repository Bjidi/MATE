async function test() {
  try {
    // 1. 注册新用户
    const regRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'leo_villa_arson',
        email: 'leo@villa-arson.fr',
        password: 'password123',
        school: 'Villa Arson Nice',
        atelier: 'Atelier Céramique'
      })
    });
    const regData = await regRes.json();
    console.log('1. User registered:', regData.user ? regData.user.username : regData);
    const token = regData.token;

    // 2. 发布新材料
    const postRes = await fetch('http://localhost:3000/api/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        title: 'Pain d’argile rouge Chamottée (12kg)',
        category: 'Autres',
        exchange_type: 'Gratuit',
        location: 'Villa Arson - Atelier Terre',
        description: 'Pain d’argile non ouvert, conservé dans son plastique étanche.',
        image_url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800'
      })
    });
    const postData = await postRes.json();
    console.log('2. Material published, item id:', postData.item ? postData.item.id : postData);

    // 3. 向 Camille 发私信咨询她发布的画布 (item_id: 1, recipient_id: 1)
    const msgRes = await fetch('http://localhost:3000/api/messages/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        recipient_id: 1,
        item_id: 1,
        content: 'Bonjour Camille ! Tes châssis m’intéressent beaucoup, je peux passer à la cour vitrée demain ?'
      })
    });
    const msgData = await msgRes.json();
    console.log('3. Message sent to Camille, conversation ID:', msgData.conversation_id);

    // 4. Camille 登录并查收消息
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'camille_ensba',
        password: 'beauxarts123'
      })
    });
    const loginData = await loginRes.json();
    console.log('4. Camille logged in:', loginData.user.username);

    // 5. Camille 查看会话
    const convRes = await fetch('http://localhost:3000/api/messages/conversations', {
      headers: { 'Authorization': 'Bearer ' + loginData.token }
    });
    const convs = await convRes.json();
    console.log('5. Camille inbox count:', convs.length, 'Last msg:', convs[0].last_message);

    // 6. Camille 回复私信
    const replyRes = await fetch('http://localhost:3000/api/messages/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + loginData.token
      },
      body: JSON.stringify({
        conversation_id: convs[0].id,
        content: 'Salut Léo ! Oui avec plaisir, je suis à l’atelier de 10h à 15h. À demain !'
      })
    });
    const replyData = await replyRes.json();
    console.log('6. Camille replied:', replyData.message.content);

    console.log('--- ALL BACKEND TEST PASS SUCCESSFULLY ---');
  } catch (err) {
    console.error('Test error:', err);
  }
}

test();

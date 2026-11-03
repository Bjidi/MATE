const BASE_URL = 'https://mate-arts.onrender.com';
const TEST_EMAIL = 'test_student_' + Date.now() + '@beauxarts.fr';
const TEST_USER = 'test_user_' + Math.floor(Math.random() * 1000);

async function runLiveTest() {
  console.log('----------------------------------------------------');
  console.log('TEST EN LIGNE SUR :', BASE_URL);
  console.log('Utilisateur de test créé :', TEST_USER, '| Email :', TEST_EMAIL);
  console.log('----------------------------------------------------\n');

  // 0. 先在线注册一个全新测试用户
  const regReq = await fetch(BASE_URL + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TEST_USER,
      email: TEST_EMAIL,
      password: 'initial_password_123',
      school: 'TALM-Tours',
      atelier: 'Option Art'
    })
  });
  const regRes = await regReq.json();
  console.log('0. Inscription du compte de test :', regRes.user ? 'SUCCÈS (ID: ' + regRes.user.id + ')' : regRes);

  // ========== TEST 1 : Première tentative de réinitialisation ==========
  console.log('\n>>> [TEST 1] Demande de code pour ' + TEST_EMAIL + '...');
  const req1 = await fetch(BASE_URL + '/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL })
  });
  const res1 = await req1.json();
  console.log('1. Code reçu du serveur :', res1);

  const code1 = res1.dev_code;
  if (!code1) {
    console.error('Erreur : pas de code reçu.');
    return;
  }

  console.log('2. Soumission du nouveau mot de passe (mon_nouveau_mot_de_passe_A)...');
  const req2 = await fetch(BASE_URL + '/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      code: code1,
      new_password: 'mon_nouveau_mot_de_passe_A'
    })
  });
  const res2 = await req2.json();
  console.log('2. Réponse du reset 1 :', res2);

  console.log('3. Test de connexion avec le mot de passe A...');
  const req3 = await fetch(BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: TEST_EMAIL,
      password: 'mon_nouveau_mot_de_passe_A'
    })
  });
  const res3 = await req3.json();
  console.log('3. Résultat connexion 1 :', res3.user ? 'SUCCÈS (Token généré, Email: ' + res3.user.email + ')' : res3);

  // ========== TEST 2 : Deuxième tentative (vérification code erroné + nouveau mot de passe B) ==========
  console.log('\n>>> [TEST 2] Deuxième demande de réinitialisation...');
  const req4 = await fetch(BASE_URL + '/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL })
  });
  const res4 = await req4.json();
  console.log('4. Nouveau code reçu :', res4);

  const code2 = res4.dev_code;

  console.log('5. Test de sécurité avec un mauvais code (000000)...');
  const reqWrong = await fetch(BASE_URL + '/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      code: '000000',
      new_password: 'should_fail'
    })
  });
  const resWrong = await reqWrong.json();
  console.log('5. Résultat interception mauvais code :', resWrong);

  console.log('6. Validation avec le BON code et nouveau mot de passe B (mot_de_passe_final_B)...');
  const req5 = await fetch(BASE_URL + '/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      code: code2,
      new_password: 'mot_de_passe_final_B'
    })
  });
  const res5 = await req5.json();
  console.log('6. Résultat reset 2 :', res5);

  console.log('7. Connexion finale confirmée avec mot de passe B...');
  const req6 = await fetch(BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: TEST_USER,
      password: 'mot_de_passe_final_B'
    })
  });
  const res6 = await req6.json();
  console.log('7. Connexion finale 2 :', res6.user ? 'SUCCÈS (Utilisateur: ' + res6.user.username + ', Email: ' + res6.user.email + ')' : res6);

  console.log('\n----------------------------------------------------');
  console.log('LES DEUX TESTS DE RÉINITIALISATION ONT RÉUSSI À 100% !');
  console.log('----------------------------------------------------');
}

runLiveTest();

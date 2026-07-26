document
.getElementById('login-btn')
.addEventListener('click', async () => {

    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (!user || !pass) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    try {
        const res = await fetch('http://localhost:3002/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                login: user,
                password: pass
            })
        });

        const data = await res.json();

        if (data.success) {
            console.log('Login OK');
            window.location.href = 'http://localhost:3002/';
        } else {
            alert(data.error || 'Credenciais invÃ¡lidas');
        }
    } catch (err) {
        console.error(err);
        alert('Erro de conexÃ£o');
    }
});

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('login-btn').click();
    }
});


function showCard(id) {

    document.querySelectorAll('.login-card').forEach(card => {
        card.classList.remove('active');
    });

    const card = document.getElementById(id);

    if (card) {
        card.classList.add('active');
    }
}


document
.getElementById('create-account-btn')
.addEventListener('click', () => {
    showCard('card-register');
});


document
.getElementById('recover-account-btn')
.addEventListener('click', () => {
    showCard('card-recover');
});


document
.getElementById('back-login-register')
.addEventListener('click', () => {
    showCard('card-login');
});


document
.getElementById('back-login-recover')
.addEventListener('click', () => {
    showCard('card-login');
});


document
.getElementById('register-btn')
.addEventListener('click', async () => {

    const login = document.getElementById('reg-user').value;
    const email = document.getElementById('reg-email').value;
    const emailConf = document.getElementById('reg-email-conf').value;
    const password = document.getElementById('reg-pass').value;
    const passConf = document.getElementById('reg-pass-conf').value;

    if (!login || !email || !password) {
        alert('Preencha todos os campos.');
        return;
    }

    if (email !== emailConf) {
        alert('Os e-mails nÃ£o conferem');
        return;
    }

    if (password !== passConf) {
        alert('As senhas nÃ£o conferem');
        return;
    }

    try {

        const res = await fetch('api/auth/register', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                login,
                email,
                password
            })
        });

        const data = await res.json();

        if (data.success) {
            alert('Conta criada com sucesso!');
            showCard('card-login');
        } else {
            alert(data.error || 'Erro no cadastro');
        }

    } catch(err) {
        alert('Erro na conexÃ£o');
    }

});


document
.getElementById('recover-btn')
.addEventListener('click', async () => {

    const login = document.getElementById('rec-user').value;
    const email = document.getElementById('rec-email').value;

    if (!login || !email) {
        alert('Preencha todos os campos.');
        return;
    }

    try {

        const res = await fetch('api/auth/recover', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                login,
                email
            })
        });

        const data = await res.json();

        alert(data.message || data.error);

        showCard('card-login');

    } catch(err) {
        alert('Erro na recuperaÃ§Ã£o');
    }

});

function setLoginBackground() {
    const hour = new Date().getHours();

    let className;
    if (hour >= 6 && hour < 12) {
        className = 'manha';
    } else if (hour >= 12 && hour < 18) {
        className = 'tarde';
    } else {
        className = 'noite';
    }

    document.body.className = className;
}

showCard('card-login');



/* ===============================
   RECUPERAÃ‡ÃƒO DE SENHA
================================ */

let recoverToken = null;

const params = new URLSearchParams(window.location.search);

if (params.has('recover')) {
    recoverToken = params.get('recover');
    showCard('card-reset');
}


document
.getElementById('reset-btn')
.addEventListener('click', async () => {

    const pass = document.getElementById('reset-pass').value;
    const conf = document.getElementById('reset-pass-conf').value;

    if (!pass || !conf) {
        alert('Preencha todos os campos.');
        return;
    }

    if (pass !== conf) {
        alert('As senhas nÃ£o conferem.');
        return;
    }

    if (!recoverToken) {
        alert('Token de recuperaÃ§Ã£o invÃ¡lido.');
        return;
    }


    try {

        const res = await fetch('api/auth/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: recoverToken,
                password: pass
            })
        });


        const data = await res.json();


        if (!res.ok) {
            alert(data.error || 'Erro ao alterar senha.');
            return;
        }


        alert(data.message || 'Senha alterada com sucesso.');

        window.history.replaceState({}, document.title, 'login.html');

        showCard('card-login');


    } catch(err) {

        alert('Erro de conexÃ£o.');

    }

});


document
.getElementById('back-login-reset')
.addEventListener('click', () => {

    window.history.replaceState({}, document.title, 'login.html');

    showCard('card-login');

});



/* FORÃ‡A ABERTURA CARD RESET */
const resetParams = new URLSearchParams(window.location.search);

if (resetParams.has('recover')) {
    recoverToken = resetParams.get('recover');
    showCard('card-reset');
}

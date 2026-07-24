const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { ensureUserInitialized } = require('../utils/player_init');
const { sendEmail } = require('../utils/email');


router.post('/register', async (req, res) => {
    const { login, email, password } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.execute(
            'INSERT INTO fazenda_usuarios (login, email, senha, is_admin) VALUES ($1, $2, $3, FALSE) RETURNING id',
            [login, email, hashedPassword]
        );

        const userId = result.rows[0].id;

        await ensureUserInitialized(userId);

        if (req.session) {
            req.session.userId = userId;
        }

        res.json({
            success: true,
            userId
        });

    } catch (err) {

        if (err.code === '23505') {
            return res.status(400).json({
                error: 'Login ou E-mail já estão em uso.'
            });
        }

        res.status(500).json({
            error: 'Erro interno: ' + err.message
        });
    }
});



router.post('/login', async (req, res) => {

    const { login, password } = req.body;

    console.log(`[AUTH] Tentativa de login: ${login}`);

    try {

        const result = await db.execute(
            'SELECT id, senha, is_admin FROM fazenda_usuarios WHERE LOWER(login)=LOWER($1)',
            [login]
        );


        if (result.rows.length === 0) {

            return res.status(401).json({
                error: 'Usuário não encontrado.'
            });

        }


        const user = result.rows[0];


        const match = await bcrypt.compare(
            password,
            user.senha
        );


        if (!match) {

            return res.status(401).json({
                error: 'Senha incorreta.'
            });

        }


        req.session.userId = user.id;
        req.session.isAdmin = user.is_admin;


        req.session.save(err => {

            if (err) {

                return res.status(500).json({
                    error: 'Falha ao salvar sessão.'
                });

            }


            console.log(
                `[AUTH] Login OK: ${login}`
            );


            res.json({
                success:true,
                userId:user.id,
                isAdmin:user.is_admin
            });

        });


    } catch(err){

        console.error(err);

        res.status(500).json({
            error:'Erro no banco de dados.'
        });

    }

});




router.get('/version', async (req,res)=>{

    try {

        const result = await db.execute(
            'SELECT valor FROM fazenda_config WHERE chave=$1',
            ['version']
        );


        res.json({
            version:
            result.rows.length
            ?
            result.rows[0].valor
            :
            'v5.0.1'
        });


    } catch(err){

        res.json({
            version:'v5.0.1'
        });

    }

});





// ===============================
// RECUPERAÇÃO DE SENHA
// ===============================

router.post('/recover', async (req,res)=>{

    const { login, email } = req.body;


    try {


        const result = await db.execute(
            `
            SELECT id 
            FROM fazenda_usuarios
            WHERE LOWER(login)=LOWER($1)
            AND LOWER(email)=LOWER($2)
            `,
            [
                login,
                email
            ]
        );



        if(result.rows.length === 0){

            return res.status(404).json({
                error:'Dados não encontrados.'
            });

        }



        const userId = result.rows[0].id;



        const token = crypto
            .randomBytes(32)
            .toString('hex');



        await db.execute(
            `
            UPDATE fazenda_usuarios
            SET recover_token=$1,
                recover_expires=NOW() + INTERVAL '30 minutes'
            WHERE id=$2
            `,
            [
                token,
                userId
            ]
        );



        const link =
        `http://localhost:3002/login.html?recover=${token}`;



        await sendEmail(
            email,
            'Recuperação de senha - Fazendinha Online',
            `
Olá ${login}!

Recebemos uma solicitação para trocar sua senha.

Clique no link abaixo:

${link}


Esse link expira em 30 minutos.

Se você não solicitou isso, ignore este email.
`
        );



        res.json({

            success:true,

            message:
            'Link de recuperação enviado para seu email.'

        });



    }catch(err){

        console.error(err);

        res.status(500).json({
            error:err.message
        });

    }

});






// ===============================
// NOVA SENHA
// ===============================


router.post('/reset-password', async(req,res)=>{


    const {
        token,
        password
    } = req.body;



    try {


        const result = await db.execute(
            `
            SELECT id
            FROM fazenda_usuarios
            WHERE recover_token=$1
            AND recover_expires > NOW()
            `,
            [
                token
            ]
        );



        if(result.rows.length===0){

            return res.status(400).json({

                error:
                'Link inválido ou expirado.'

            });

        }



        const userId =
        result.rows[0].id;



        const hashedPassword =
        await bcrypt.hash(password,10);



        await db.execute(
            `
            UPDATE fazenda_usuarios
            SET senha=$1,
                recover_token=NULL,
                recover_expires=NULL
            WHERE id=$2
            `,
            [
                hashedPassword,
                userId
            ]
        );



        res.json({

            success:true,

            message:
            'Senha alterada com sucesso.'

        });



    }catch(err){


        console.error(err);


        res.status(500).json({

            error:
            err.message

        });


    }


});



module.exports = router;
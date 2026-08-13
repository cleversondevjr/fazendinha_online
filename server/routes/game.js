// GET /api/game/season-pass
router.get('/season-pass', async (req, res) => {
    const userId = req.userId;
    try {
        const progRes = await db.execute(
            "SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1",
            [userId]
        );
        let prog = progRes.rows[0];
        if (!prog) {
            await db.execute(
                "INSERT INTO fazenda_season_pass_progresso (usuario_id, nivel_atual, xp_atual, claimed_levels) VALUES ($1, 0, 0, '{}') ON CONFLICT DO NOTHING",
                [userId]
            );
            prog = { nivel_atual: 0, xp_atual: 0, claimed_levels: [] };
        }

        const tiersRes = await db.execute(
            "SELECT * FROM fazenda_season_pass_template ORDER BY nivel ASC"
        );

        res.json({
            progress: prog,
            tiers: tiersRes.rows
        });
    } catch (err) {
        console.error('[GAME ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/game/action
router.post('/action', async (req, res) => {
    const { action, slotIndex, itemId, missionId, quantity, price } = req.body;
    const qty = BigInt(quantity || 1);
    const userId = req.userId;
    try {
        // ... existing code ...

        if (action === 'claim_mission') {
            const resMission = await db.execute("SELECT m.*, t.reward_type, t.reward_amount FROM fazenda_missoes_jogador m JOIN fazenda_missoes_template t ON m.template_id = t.id WHERE m.id = $1 AND m.usuario_id = $2", [missionId, userId]);
            if (!resMission.rows.length) throw new Error('Missão não disponível');
            await db.execute("UPDATE fazenda_missoes_jogador SET claimed = TRUE WHERE id = $1", [missionId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, resMission.rows[0].reward_type, resMission.rows[0].reward_amount]);
            await db.execute(`
                INSERT INTO fazenda_season_pass_progresso
                    (usuario_id, nivel_atual, xp_atual, claimed_levels)
                VALUES ($1, 0, 34, '{}')
                ON CONFLICT (usuario_id)
                DO UPDATE SET
                    xp_atual = fazenda_season_pass_progresso.xp_atual + 34,
                    updated_at = NOW()
            `, [userId]);

            const prog = (await db.execute(`
                SELECT * FROM fazenda_season_pass_progresso
                WHERE usuario_id = $1
            `, [userId])).rows[0];

            let nivelAtual = Number(prog.nivel_atual || 0);
            let xpAtual = Number(prog.xp_atual || 0);

            while (xpAtual >= 100 && nivelAtual < 30) {
                xpAtual -= 100;
                nivelAtual++;
            }

            await db.execute(`
                UPDATE fazenda_season_pass_progresso
                SET nivel_atual = $1,
                    xp_atual = $2,
                    updated_at = NOW()
                WHERE usuario_id = $3
            `, [nivelAtual, xpAtual, userId]);

            return res.json({
                success: true,
                xpGanho: 34,
                nivelAtual,
                xpAtual,
                xpNecessario: 100,
                nivelMaximo: 30
            });
        }

        if (action === 'claim_pass_reward') {
            const level = parseInt(missionId); // Reutilizando campo missionId para o nível do passe
            const progRes = await db.execute("SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1", [userId]);
            const prog = progRes.rows[0];
            if (!prog || prog.nivel_atual < level || prog.claimed_levels.includes(level)) throw new Error("Recompensa não disponível");

            const tier = (await db.execute("SELECT * FROM fazenda_season_pass_template WHERE nivel = $1", [level])).rows[0];
            if (!tier) throw new Error('Nível do passe não encontrado');
            await db.execute("UPDATE fazenda_season_pass_progresso SET claimed_levels = array_append(claimed_levels, $1) WHERE usuario_id = $2", [level, userId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, tier.recompensa_tipo, tier.recompensa_quantidade]);
        }

        // ... existing code ...

    res.json({ success: true });
    } catch (err) {
        console.error('[GAME ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/game/checkin
router.get('/checkin', async (req,res)=>{
    const userId=req.userId;

    try{
        const progresso=await db.execute(
            "SELECT * FROM fazenda_checkin_progresso WHERE usuario_id=$1",
            [userId]
        );

        const recompensas=await db.execute(
            "SELECT * FROM fazenda_checkin_recompensas ORDER BY dia"
        );

        const diaReal = getCheckinDiaAtual();

        const dadosProgresso = progresso.rows[0] || {
            dia_atual:0,
            ciclo:1,
            recompensas_coletadas:[]
        };

        dadosProgresso.recompensas_coletadas = dadosProgresso.recompensas_coletadas || [];

        const diaJogo = diaReal || 0;
        dadosProgresso.dia_atual = diaJogo;
        const coletados = dadosProgresso.recompensas_coletadas || [];

        const diasStatus = recompensas.rows.map(r => ({
            ...r,
            status:
                coletados.includes(r.dia)
                    ? "collected"
                    : r.dia === diaJogo
                        ? "available"
                        : r.dia < diaJogo
                            ? "missed"
                            : "locked"
        }));

        const bonusSemanais = [
            { semana: 1, liberado: [1,2,3,4,5,6,7].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_1, coletado: !!dadosProgresso.bonus_semana_1 },
            { semana: 2, liberado: [8,9,10,11,12,13,14].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_2, coletado: !!dadosProgresso.bonus_semana_2 },
            { semana: 3, liberado: [15,16,17,18,19,20,21].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_3, coletado: !!dadosProgresso.bonus_semana_3 },
            { semana: 4, liberado: [22,23,24,25,26,27,28].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_4, coletado: !!dadosProgresso.bonus_semana_4 }
        ];

        const bonusMensal = {
            liberado: Array.from({ length: 28 }, (_, i) => i + 1).every(d => coletados.includes(d)) && !dadosProgresso.bonus_mensal,
            coletado: !!dadosProgresso.bonus_mensal
        };

        res.json({
            bonusSemanais,
            bonusMensal,
            progresso: dadosProgresso,
            recompensas: diasStatus,
        });

    }catch(err){
        res.status(500).json({
            error:err.message
        });
    }
});

// POST /api/game/checkin
router.post('/checkin', async (req, res) => {
    const userId = req.userId;
    const diaSolicitado = Number(req.body?.dia);

    try {
        const check = await isFeatureEnabled('CHECKIN_DIARIO');

        if (!check.ativa) {
            throw new Error(check.mensagem || 'Check-in diário ainda não disponível');
        }

        let progresso = await db.execute(
            "SELECT * FROM fazenda_checkin_progresso WHERE usuario_id=$1",
            [userId]
        );

        if (!progresso.rows.length) {
            await db.execute(
                `INSERT INTO fazenda_checkin_progresso
                    (usuario_id,dia_atual,ciclo,ultima_data,recompensas_coletadas)
                 VALUES($1,0,1,NULL,'[]'::jsonb)`,
                [userId]
            );

            progresso = await db.execute(
                "SELECT * FROM fazenda_checkin_progresso WHERE usuario_id=$1",
                [userId]
            );
        }

        const dados = progresso.rows[0];

        const coletadas = Array.isArray(dados.recompensas_coletadas)
            ? dados.recompensas_coletadas.map(Number)
            : [];

        const tipo = req.body?.tipo;

        const semanas = {
            1: [1,2,3,4,5,6,7],
            2: [8,9,10,11,12,13,14],
            3: [15,16,17,18,19,20,21],
            4: [22,23,24,25,26,27,28]
        };

        const semanasCompletas = {
            1: semanas[1].every(d => coletadas.includes(d)),
            2: semanas[2].every(d => coletadas.includes(d)),
            3: semanas[3].every(d => coletadas.includes(d)),
            4: semanas[4].every(d => coletadas.includes(d))
        };

        const bonusMensalCompleto =
            semanasCompletas[1] &&
            semanasCompletas[2] &&
            semanasCompletas[3] &&
            semanasCompletas[4];

        if (tipo === 'bonus_semanal') {
            const semana = Number(req.body?.semana);

            if (!Number.isInteger(semana) || semana < 1 || semana > 4) {
                throw new Error('Bônus semanal inválido.');
            }

            if (!semanasCompletas[semana]) {
                throw new Error(`O bônus da Semana ${semana} ainda não está liberado.`);
            }

            const coluna = `bonus_semana_${semana}`;

            if (dados[coluna]) {
                throw new Error(`O bônus da Semana ${semana} já foi coletado.`);
            }

            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'diamante', 50) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + 50", [userId]);
            await db.execute(
                `UPDATE fazenda_checkin_progresso
                 SET ${coluna}=TRUE,
                     updated_at=NOW()
                 WHERE usuario_id=$1`,
                [userId]
            );

            return res.json({
                success: true,
                tipo: 'bonus_semanal',
                semana,
                message: `Bônus da Semana ${semana} coletado!`
            });
        }

        if (tipo === 'bonus_mensal') {
            if (!bonusMensalCompleto) {
                throw new Error('O bônus mensal ainda não está liberado.');
            }

            if (dados.bonus_mensal) {
                throw new Error('O bônus mensal já foi coletado.');
            }

            await db.execute(
                `UPDATE fazenda_checkin_progresso
                 SET bonus_mensal=TRUE,
                     updated_at=NOW()
                 WHERE usuario_id=$1`,
                [userId]
            );

            return res.json({
                success: true,
                tipo: 'bonus_mensal',
                message: 'Bônus mensal coletado!'
            });
        }

        const diaAtual = getCheckinDiaAtual();

        if (!diaAtual) {
            throw new Error('Check-in encerrado neste período.');
        }

        if (!Number.isInteger(diaSolicitado) || diaSolicitado < 1 || diaSolicitado > 28) {
            throw new Error('Dia de check-in inválido.');
        }

        if (diaSolicitado > diaAtual) {
            throw new Error('Este dia ainda não está disponível.');
        }

        if (coletadas.includes(diaSolicitado)) {
            throw new Error(`O Dia ${diaSolicitado} já foi coletado.`);
        }

        const recompensa = await db.execute(
            "SELECT * FROM fazenda_checkin_recompensas WHERE dia=$1",
            [diaSolicitado]
        );

        if (!recompensa.rows.length) {
            throw new Error('Recompensa não encontrada.');
        }

        const r = recompensa.rows[0];

        if (r.tipo_recompensa !== 'bonus' && r.item_id) {
            await db.execute(
                `INSERT INTO fazenda_inventario
                    (usuario_id,item_id,quantidade)
                 VALUES($1,$2,$3)
                 ON CONFLICT(usuario_id,item_id)
                 DO UPDATE SET quantidade =
                    fazenda_inventario.quantidade + $3`,
                [userId, r.item_id, r.quantidade]
            );
        }

        const novasColetadas = [...new Set([...coletadas, diaSolicitado])];

        const semana1CompletaAposColeta = [1,2,3,4,5,6,7].every(d => novasColetadas.includes(d));

        const semana2CompletaAposColeta = [8,9,10,11,12,13,14].every(d => novasColetadas.includes(d));

        const semana3CompletaAposColeta = [15,16,17,18,19,20,21].every(d => novasColetadas.includes(d));

        const semana4CompletaAposColeta = [22,23,24,25,26,27,28].every(d => novasColetadas.includes(d));

        const bonusMensalCompletoAposColeta = semana1CompletaAposColeta && semana2CompletaAposColeta && semana3CompletaAposColeta && semana4CompletaAposColeta;

        const bonusLiberados = {
            semana1: semana1CompletaAposColeta && !dados.bonus_semana_1,
            semana2: semana2CompletaAposColeta && !dados.bonus_semana_2,
            semana3: semana3CompletaAposColeta && !dados.bonus_semana_3,
            semana4: semana4CompletaAposColeta && !dados.bonus_semana_4,
            mensal: bonusMensalCompletoAposColeta && !dados.bonus_mensal
        };

        await db.execute(
            `UPDATE fazenda_checkin_progresso
             SET dia_atual=GREATEST(COALESCE(dia_atual,0),$1),
                 ultima_data=CURRENT_DATE,
                 recompensas_coletadas=
                    COALESCE(recompensas_coletadas,'[]'::jsonb)
                    || jsonb_build_array($1),
                 updated_at=NOW()
             WHERE usuario_id=$2`,
            [
                diaSolicitado,
                userId
            ]
        );

        res.json({
            success: true,
            dia: diaSolicitado,
            totalDias: 28,
            recompensa: r,
            message: r.tipo_recompensa === 'bonus'
                ? `${r.titulo} coletado!`
                : `Recompensa do Dia ${diaSolicitado} coletada!`,
            bonusLiberados
        });

    } catch (err) {
        console.error('[CHECKIN ERROR]', err);
        res.status(500).json({
            error: err.message
        });
    }
});

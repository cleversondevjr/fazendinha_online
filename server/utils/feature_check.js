const db = require('../db');

/**
 * Verifica se uma funcionalidade está ativa e dentro da data de lançamento.
 * @param {string} chave A chave da feature (ex: 'SLOTS_PREMIUM')
 * @returns {Promise<{ativa: boolean, mensagem: string}>}
 */
async function isFeatureEnabled(chave) {
    try {
        const res = await db.execute('SELECT ativa, data_lancamento, mensagem_bloqueio FROM fazenda_features WHERE chave = $1', [chave]);
        if (res.rows.length === 0) return { ativa: true, mensagem: '' }; // Se não existir, permite por padrão (ou bloqueia se preferir)

        const feature = res.rows[0];
        const now = new Date();
        const launchDate = new Date(feature.data_lancamento);

        if (!feature.ativa) {
            return { ativa: false, mensagem: feature.mensagem_bloqueio || 'Esta função está temporariamente desativada.' };
        }

        if (now < launchDate) {
            return { ativa: false, mensagem: feature.mensagem_bloqueio || 'Esta função será liberada em breve!' };
        }

        return { ativa: true, mensagem: '' };
    } catch (err) {
        console.error('[FEATURE CHECK ERROR]', err);
        return { ativa: false, mensagem: 'Erro ao validar funcionalidade.' };
    }
}

/**
 * Middleware Express para proteger rotas baseado em Feature Flags
 */
const featureGuard = (chave) => {
    return async (req, res, next) => {
        const check = await isFeatureEnabled(chave);
        if (!check.ativa) {
            return res.status(403).json({ error: check.mensagem });
        }
        next();
    };
};

module.exports = { isFeatureEnabled, featureGuard };

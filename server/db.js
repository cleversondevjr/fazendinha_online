const { Pool } = require('pg');
// Substitua: require('dotenv').config();
// Por:
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT || 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Aumentado para lidar com possíveis lentidões no Raspberry
});

// Tratamento de erro na conexão inicial do pool
pool.on('error', (err, client) => {
  console.error('[DATABASE POOL ERROR] Erro inesperado em um cliente ocioso:', err);
});

module.exports = {
  pool,
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error('[DATABASE QUERY ERROR]', { text, error: err.message });
      throw err;
    }
  },
  execute: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error('[DATABASE EXECUTE ERROR]', { text, error: err.message });
      throw err;
    }
  }, // Compatibility wrapper
};

// api/config.js — config publique du site (nom, logo)
const { supabaseAdmin, respond, handler } = require('./_supabase');

module.exports = handler(async (req, res) => {
  if (req.method !== 'GET') return respond(res, 405, { error: 'Méthode non autorisée' });

  const { data, error } = await supabaseAdmin
    .from('site_config')
    .select('key, value');

  if (error) throw error;

  const config = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  respond(res, 200, config);
});

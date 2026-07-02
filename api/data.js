// api/data.js — charger et sauvegarder la collection d'un utilisateur
const { supabaseAdmin, requireAuth, respond, handler } = require('./_supabase');

module.exports = handler(async (req, res) => {
  const user = await requireAuth(req);

  // ── GET : charger sa collection ───────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('user_data')
      .select('categories')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

    respond(res, 200, { categories: data?.categories || [] });
    return;
  }

  // ── PUT : sauvegarder sa collection ──────────────────
  if (req.method === 'PUT') {
    const { categories } = req.body;
    if (!Array.isArray(categories)) return respond(res, 400, { error: 'Format invalide' });

    // Validation légère
    for (const cat of categories) {
      if (!cat.id || !cat.name || !Array.isArray(cat.columns) || !Array.isArray(cat.entries)) {
        return respond(res, 400, { error: 'Structure invalide' });
      }
    }

    const json = JSON.stringify(categories);
    if (Buffer.byteLength(json, 'utf8') > 10 * 1024 * 1024) {
      return respond(res, 413, { error: 'Données trop volumineuses (max 10 Mo)' });
    }

    const { error } = await supabaseAdmin
      .from('user_data')
      .upsert({ user_id: user.id, categories, updated_at: new Date().toISOString() },
               { onConflict: 'user_id' });

    if (error) throw error;
    respond(res, 200, { ok: true });
    return;
  }

  respond(res, 405, { error: 'Méthode non autorisée' });
});

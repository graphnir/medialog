// api/me.js — profil de l'utilisateur connecté
const { supabaseAdmin, requireAuth, respond, handler } = require('./_supabase');

module.exports = handler(async (req, res) => {
  const user = await requireAuth(req);

  // ── GET /api/me ───────────────────────────────────────
  if (req.method === 'GET') {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, role, share_token, share_enabled, avatar_url, created_at, last_login')
      .eq('id', user.id)
      .single();
    if (error) return respond(res, 404, { error: 'Profil introuvable' });
    await supabaseAdmin.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    return respond(res, 200, profile);
  }

  // ── PUT /api/me — mettre à jour le profil ─────────────
  if (req.method === 'PUT') {
    const { username, avatar_url } = req.body;
    if (username !== undefined) {
      if (!username || username.trim().length < 2) return respond(res, 400, { error: 'Pseudo trop court (2 car. min.)' });
      const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('username', username.trim()).neq('id', user.id).single();
      if (existing) return respond(res, 409, { error: 'Ce pseudo est déjà pris' });
    }
    const updates = {};
    if (username !== undefined) updates.username = username.trim();
    if (avatar_url !== undefined) updates.avatar_url = avatar_url.trim() || null;
    if (!Object.keys(updates).length) return respond(res, 400, { error: 'Rien à mettre à jour' });
    const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
    return respond(res, 200, { ok: true });
  }

  respond(res, 405, { error: 'Méthode non autorisée' });
});

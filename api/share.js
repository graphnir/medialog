// api/share.js — partage public (fix token alphanumérique complet)
const { supabaseAdmin, requireAuth, respond, handler } = require('./_supabase');
const { randomUUID } = require('crypto');

module.exports = handler(async (req, res) => {

  if (req.method === 'GET' && req.query?.token) {
    // Fix: autoriser tous les caractères alphanumériques et tirets
    const token = String(req.query.token).replace(/[^a-zA-Z0-9-]/g, '');
    if (!token) return respond(res,400,{error:'Token invalide'});

    const {data:profile,error} = await supabaseAdmin.from('profiles')
      .select('id,username,share_enabled').eq('share_token',token).single();

    if(error||!profile||!profile.share_enabled)
      return respond(res,404,{error:'Collection introuvable ou partage désactivé'});

    const {data:userData} = await supabaseAdmin.from('user_data')
      .select('categories').eq('user_id',profile.id).single();

    return respond(res,200,{username:profile.username,categories:userData?.categories||[]});
  }

  const user = await requireAuth(req);

  if (req.method === 'POST' && req.query?.action === 'toggle') {
    const {data:profile} = await supabaseAdmin.from('profiles')
      .select('share_enabled,share_token').eq('id',user.id).single();
    const newEnabled = !profile?.share_enabled;
    let token = profile?.share_token;
    if(newEnabled && !token) token = randomUUID().replace(/-/g,'');
    await supabaseAdmin.from('profiles').update({share_enabled:newEnabled,share_token:token}).eq('id',user.id);
    return respond(res,200,{share_enabled:newEnabled,share_token:newEnabled?token:null});
  }

  if (req.method === 'POST' && req.query?.action === 'regenerate') {
    const token = randomUUID().replace(/-/g,'');
    await supabaseAdmin.from('profiles').update({share_enabled:true,share_token:token}).eq('id',user.id);
    return respond(res,200,{share_enabled:true,share_token:token});
  }

  respond(res,405,{error:'Méthode non autorisée'});
});

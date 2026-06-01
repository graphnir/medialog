// api/news.js — articles de news style journal
const { supabaseAdmin, requireAdmin, respond, handler } = require('./_supabase');

module.exports = handler(async (req, res) => {

  // ── GET — public ──────────────────────────────────────
  if (req.method === 'GET') {
    const {data,error} = await supabaseAdmin.from('news')
      .select('id,title,content,image_url,pinned,created_at')
      .order('pinned',{ascending:false})
      .order('created_at',{ascending:false})
      .limit(20);
    if(error) throw error;
    return respond(res,200,data||[]);
  }

  await requireAdmin(req);

  // ── POST — créer un article ───────────────────────────
  if (req.method === 'POST') {
    const {title,content,image_url,pinned} = req.body;
    if(!title?.trim()) return respond(res,400,{error:'Titre obligatoire'});
    const {data,error} = await supabaseAdmin.from('news')
      .insert({title:title.trim(),content:content?.trim()||null,image_url:image_url?.trim()||null,pinned:!!pinned})
      .select().single();
    if(error) throw error;
    return respond(res,201,data);
  }

  // ── PUT — modifier un article ─────────────────────────
  if (req.method === 'PUT') {
    const {id,title,content,image_url,pinned} = req.body;
    if(!id) return respond(res,400,{error:'id manquant'});
    const {error} = await supabaseAdmin.from('news')
      .update({title:title?.trim(),content:content?.trim()||null,image_url:image_url?.trim()||null,pinned:!!pinned})
      .eq('id',id);
    if(error) throw error;
    return respond(res,200,{ok:true});
  }

  // ── DELETE ────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const {id} = req.query;
    if(!id) return respond(res,400,{error:'id manquant'});
    const {error} = await supabaseAdmin.from('news').delete().eq('id',id);
    if(error) throw error;
    return respond(res,200,{ok:true});
  }

  respond(res,405,{error:'Méthode non autorisée'});
});

// api/admin.js
const { supabaseAdmin, requireAdmin, respond, handler } = require('./_supabase');

module.exports = handler(async (req, res) => {
  const adminUser = await requireAdmin(req);
  const action = req.query?.action || '';

  if (req.method === 'GET' && action === 'stats') {
    const { count: total }  = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true});
    const { count: admins } = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).eq('role','admin');
    const { count: shared } = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).eq('share_enabled',true);
    const weekAgo = new Date(Date.now()-7*24*60*60*1000).toISOString();
    const { count: recent } = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).gte('created_at',weekAgo);
    return respond(res,200,{total_users:total,admins,sharing_enabled:shared,new_last_7_days:recent});
  }

  if (req.method === 'GET' && action === 'users') {
    const page=Math.max(1,parseInt(req.query.page)||1), limit=50, from=(page-1)*limit;
    const {data:users,error,count} = await supabaseAdmin.from('profiles')
      .select('id,username,email,role,share_enabled,created_at,last_login',{count:'exact'})
      .order('created_at',{ascending:false}).range(from,from+limit-1);
    if(error) throw error;
    return respond(res,200,{users:users||[],total:count,page,pages:Math.ceil(count/limit)});
  }

  if (req.method === 'GET' && action === 'config') {
    const {data} = await supabaseAdmin.from('site_config').select('key,value');
    return respond(res,200,Object.fromEntries((data||[]).map(r=>[r.key,r.value])));
  }

  if (req.method === 'PUT' && action === 'config') {
    const allowed = ['site_name','site_logo','site_subtitle','site_logo_url'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const val = String(req.body[key]).slice(0,300).trim();
        await supabaseAdmin.from('site_config').upsert({key,value:val},{onConflict:'key'});
      }
    }
    return respond(res,200,{ok:true});
  }

  if (req.method === 'DELETE' && action === 'delete-user') {
    const {user_id} = req.body;
    if(!user_id) return respond(res,400,{error:'user_id manquant'});
    if(user_id===adminUser.id) return respond(res,400,{error:'Impossible de supprimer son propre compte'});
    const {data:target} = await supabaseAdmin.from('profiles').select('role').eq('id',user_id).single();
    if(target?.role==='admin') return respond(res,403,{error:'Impossible de supprimer un admin'});
    const {error} = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if(error) throw error;
    return respond(res,200,{ok:true});
  }

  if (req.method === 'PUT' && action === 'set-role') {
    const {user_id,role} = req.body;
    if(!['user','admin'].includes(role)) return respond(res,400,{error:'Rôle invalide'});
    if(user_id===adminUser.id) return respond(res,400,{error:'Ne peut pas modifier son propre rôle'});
    await supabaseAdmin.from('profiles').update({role}).eq('id',user_id);
    return respond(res,200,{ok:true});
  }

  // ── Tutoriel steps (admin) ────────────────────────────
  if (req.method === 'GET' && action === 'tutorial') {
    const {data} = await supabaseAdmin.from('tutorial_steps').select('*').order('position');
    return respond(res,200,data||[]);
  }
  if (req.method === 'PUT' && action === 'tutorial') {
    const {steps} = req.body;
    if(!Array.isArray(steps)) return respond(res,400,{error:'Format invalide'});
    await supabaseAdmin.from('tutorial_steps').delete().neq('id','00000000-0000-0000-0000-000000000000');
    if(steps.length>0) {
      const rows = steps.map((s,i)=>({title:String(s.title||'').slice(0,100),content:String(s.content||'').slice(0,500),icon:String(s.icon||'📌').slice(0,8),position:i}));
      await supabaseAdmin.from('tutorial_steps').insert(rows);
    }
    return respond(res,200,{ok:true});
  }

  respond(res,405,{error:'Méthode non autorisée'});
});

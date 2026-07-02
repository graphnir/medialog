// api/tutorial.js — étapes du tutoriel (public en lecture)
const { supabaseAdmin, respond, handler } = require('./_supabase');

module.exports = handler(async (req, res) => {
  if (req.method === 'GET') {
    const {data,error} = await supabaseAdmin.from('tutorial_steps')
      .select('id,title,content,icon,position').order('position');
    if(error) throw error;
    return respond(res,200,data||[]);
  }
  respond(res,405,{error:'Méthode non autorisée'});
});

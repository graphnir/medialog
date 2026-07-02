// public/api.js v4
const API = (() => {
  const sb = supabase.createClient(window.ENV_SUPABASE_URL, window.ENV_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken:true, persistSession:true, storageKey:'medialog_session' }
  });

  sb.auth.onAuthStateChange(event => {
    if (event==='SIGNED_OUT') window.dispatchEvent(new Event('ml:session-expired'));
  });

  async function apiFetch(method, path, body) {
    const { data:{session} } = await sb.auth.getSession();
    const headers = { 'Content-Type':'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(`/api${path}`, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
    return data;
  }

  return {
    isLoggedIn() { 
      const key=Object.keys(localStorage).find(k=>k.includes('medialog_session'));
      if(!key)return false;
      try{const v=JSON.parse(localStorage.getItem(key));return !!(v?.access_token||v?.session?.access_token);}
      catch{return false;}
    },
    clearTokens() { sb.auth.signOut(); },
    async login(email,pw) { const {data,error}=await sb.auth.signInWithPassword({email,password:pw}); if(error)throw new Error(error.message); return data; },
    async register(username,email,pw) { const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{username},emailRedirectTo:`${location.origin}/confirm`}}); if(error)throw new Error(error.message); return data; },
    async logout() { await sb.auth.signOut(); },
    async resetPassword(email) { const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/confirm?type=recovery`}); if(error)throw new Error(error.message); },
    async updatePassword(pw) { const {error}=await sb.auth.updateUser({password:pw}); if(error)throw new Error(error.message); },
    async verifyOtp(token_hash, type) {
      const {data,error}=await sb.auth.verifyOtp({token_hash,type});
      if(error) throw error;
      return data;
    },
    async me()                   { return apiFetch('GET','/me'); },
    async updateProfile(d)       { return apiFetch('PUT','/me',d); },
    async getData()              { return apiFetch('GET','/data'); },
    async saveData(cats)         { return apiFetch('PUT','/data',{categories:cats}); },
    async getConfig()            { return apiFetch('GET','/config'); },
    async getShareData(token)    { const r=await fetch(`/api/share?token=${encodeURIComponent(token)}`); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Erreur'); return d; },
    async toggleShare()          { return apiFetch('POST','/share?action=toggle'); },
    async regenToken()           { return apiFetch('POST','/share?action=regenerate'); },
    async getNews()              { return apiFetch('GET','/news'); },
    async addNews(item)          { return apiFetch('POST','/news',item); },
    async updateNews(item)       { return apiFetch('PUT','/news',item); },
    async deleteNews(id)         { return apiFetch('DELETE',`/news?id=${id}`); },
    async getTutorial()          { return apiFetch('GET','/tutorial'); },
    async adminGetStats()        { return apiFetch('GET','/admin?action=stats'); },
    async adminGetUsers(p=1)     { return apiFetch('GET',`/admin?action=users&page=${p}`); },
    async adminGetConfig()       { return apiFetch('GET','/admin?action=config'); },
    async adminSaveConfig(cfg)   { return apiFetch('PUT','/admin?action=config',cfg); },
    async adminDeleteUser(id)    { return apiFetch('DELETE','/admin?action=delete-user',{user_id:id}); },
    async adminSetRole(id,role)  { return apiFetch('PUT','/admin?action=set-role',{user_id:id,role}); },
    async adminGetTutorial()     { return apiFetch('GET','/admin?action=tutorial'); },
    async adminSaveTutorial(steps){ return apiFetch('PUT','/admin?action=tutorial',{steps}); },
    async getHelpTexts()                          { return apiFetch('GET','/admin?action=help-texts'); },
    async adminGetHelpTexts()                     { return apiFetch('GET','/admin?action=help-texts'); },
    async adminSaveHelpText(id,title,cont)        { return apiFetch('PUT','/admin?action=help-texts',{id,title,content:cont}); },
    async wikiSearch(q,lang='fr',mediaType='generic'){ return apiFetch('GET',`/wikipedia?action=search&q=${encodeURIComponent(q)}&lang=${lang}&mediaType=${mediaType}`); },
    async wikiExtract(title,lang,fields,mediaType){ return apiFetch('GET',`/wikipedia?action=extract&title=${encodeURIComponent(title)}&lang=${lang}&fields=${encodeURIComponent(fields)}&mediaType=${mediaType}`); },
  };
})();

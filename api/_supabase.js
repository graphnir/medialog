// api/_supabase.js — client Supabase partagé côté serveur
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  throw new Error('Variables Supabase manquantes (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)');
}

// Client avec la clé service (admin, bypass RLS) — uniquement côté serveur
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Client avec la clé anon — pour vérifier le token JWT d'un utilisateur
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Vérifie le Bearer token de la requête et retourne l'utilisateur Supabase
async function requireAuth(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Non authentifié'); err.status = 401; throw err;
  }
  const token = header.slice(7);
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) {
    const err = new Error('Token invalide ou expiré'); err.status = 401; throw err;
  }
  return user;
}

// Vérifie que l'utilisateur est admin (via user_metadata)
async function requireAdmin(req) {
  const user = await requireAuth(req);
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    const err = new Error('Accès réservé aux admins'); err.status = 403; throw err;
  }
  return user;
}

// Helper pour répondre proprement
function respond(res, status, data) {
  res.status(status).json(data);
}

// Wrapper qui gère les erreurs communes
function handler(fn) {
  return async (req, res) => {
    // CORS pour Vercel dev
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`[API Error] ${err.message}`);
      respond(res, err.status || 500, { error: err.message || 'Erreur serveur' });
    }
  };
}

module.exports = { supabaseAdmin, supabaseAnon, requireAuth, requireAdmin, respond, handler };

-- ============================================================
--  MediaLog — Schéma v3
--  À exécuter dans Supabase > SQL Editor > New query
-- ============================================================

-- ── 1. Table news enrichie ────────────────────────────────────
DROP TABLE IF EXISTS public.news CASCADE;
CREATE TABLE public.news (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  content    TEXT,
  image_url  TEXT,
  pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_select_public" ON public.news FOR SELECT USING (true);

-- ── 2. Table étapes tutoriel ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutorial_steps (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title    TEXT NOT NULL,
  content  TEXT NOT NULL,
  icon     TEXT NOT NULL DEFAULT '📌',
  position INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.tutorial_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutorial_select_public" ON public.tutorial_steps FOR SELECT USING (true);

-- Étapes par défaut
INSERT INTO public.tutorial_steps (title,content,icon,position) VALUES
  ('Catégories',     'Clique sur ⊕ dans le header pour créer une catégorie (Jeux, Films, Mangas…). Chaque catégorie a ses propres colonnes.','📂',0),
  ('Ajouter une entrée', 'Clique sur le bouton + en bas à droite pour ajouter une œuvre. Remplis les champs et sauvegarde.','➕',1),
  ('Modifier rapidement', 'En vue cartes, clique sur n''importe quelle valeur pour la modifier directement. En vue tableur, les textes et nombres sont éditables en place.','✏️',2),
  ('Favoris & filtres', 'Clique sur ☆ pour mettre en favori. La barre de filtres permet de voir uniquement tes favoris, les œuvres à voir, ou celles déjà vues.','⭐',3),
  ('Vues & tri', 'Choisis entre liste, grille, compact ou tableur. Trie par n''importe quelle colonne avec le sélecteur en haut.','🔀',4),
  ('Roulette', 'Clique sur la roulette dans le header pour laisser le hasard choisir une œuvre parmi tes "à voir".','🎰',5),
  ('Partage', 'Dans le menu utilisateur → Partage, active un lien public pour que d''autres puissent consulter ta collection en lecture seule.','🔗',6),
  ('Graphiques', 'Clique sur 📊 dans le header pour voir les statistiques visuelles de ta collection.','📊',7)
ON CONFLICT DO NOTHING;

-- ── 3. Config logo_url ────────────────────────────────────────
INSERT INTO public.site_config (key,value) VALUES ('site_logo_url','')
ON CONFLICT (key) DO NOTHING;

-- ── 4. Colonne avatar_url sur profiles ────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ── 5. Vérification ──────────────────────────────────────────
SELECT 'Schema v3 appliqué avec succès ✓' as status;

-- ── Fix policies partage ──────────────────────────────────────
-- S'assurer que les profiles sont lisibles publiquement (pour le partage)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select'
  ) THEN
    CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
  END IF;
END
$$;

-- S'assurer que user_data est accessible pour le partage (via service role dans l'API)
-- La policy suivante permet la lecture de ses propres données
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_data' AND policyname='user_data_all'
  ) THEN
    CREATE POLICY "user_data_all" ON public.user_data FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

SELECT 'Policies vérifiées ✓' as status;

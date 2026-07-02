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

-- ── Help texts (boutons ?) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.help_texts (
  id       TEXT PRIMARY KEY,  -- ex: 'roulette', 'graphiques', 'colonnes', 'import', 'partage', 'filtres', 'wikipedia'
  title    TEXT NOT NULL,
  content  TEXT NOT NULL
);
ALTER TABLE public.help_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_texts_select" ON public.help_texts FOR SELECT USING (true);

-- Textes par défaut
INSERT INTO public.help_texts (id, title, content) VALUES
  ('roulette',   'Roulette', 'Laisse le hasard choisir une œuvre pour toi ! Le bouton principal pioche parmi tes œuvres non vues. Les critères avancés te permettent de filtrer par colonne, note, date, statut, etc. Plusieurs critères s''additionnent (ET logique).'),
  ('graphiques', 'Graphiques', 'Visualise tes données sous forme de camembert, barres ou courbe. Tu peux créer tes propres graphiques en choisissant librement les colonnes à utiliser sur chaque axe. Les graphiques automatiques s''adaptent aux colonnes de ta catégorie.'),
  ('colonnes',   'Colonnes', 'Chaque catégorie a ses propres colonnes. Tu peux ajouter, supprimer, réordonner (glisser ⠿), changer le type (texte, nombre, date, note, liste, texte long). Les colonnes conditionnelles permettent de n''afficher un champ que si une autre colonne a une valeur spécifique.'),
  ('import',     'Import', 'Importe des données depuis Google Sheets (via un lien CSV publié) ou en collant directement des cellules copiées (Ctrl+C dans Sheets). La 1re ligne doit contenir les noms de colonnes — ils seront associés automatiquement à tes colonnes existantes.'),
  ('partage',    'Partage', 'Génère un lien public pour que d''autres puissent consulter ta collection en lecture seule, sans avoir de compte. Le lien est unique et révocable à tout moment. La page de partage inclut les mêmes options de tri, filtres et layouts que l''app.'),
  ('filtres',    'Filtres', 'Filtre tes entrées par favoris (⭐), par statut (à voir / vus seulement), ou combine les deux. La barre de recherche cherche dans toutes les colonnes simultanément. Le tri s''applique à toutes les colonnes, en ordre ascendant ou descendant.'),
  ('wikipedia',  'Suggestions Wikipedia', 'Active les suggestions Wikipedia pour une catégorie dans la gestion des colonnes. Associe chaque colonne à un champ Wikipedia (réalisateur, genre, date de sortie, etc.). Lors de l''ajout d''une entrée, un bouton "Rechercher sur Wikipedia" apparaît après avoir saisi le titre. Les données trouvées sont proposées à la validation — rien n''est importé automatiquement sans ton accord. Fiabilité : les données Wikipedia peuvent être incomplètes ou inexactes, vérifie toujours les informations importées.')
ON CONFLICT (id) DO NOTHING;

SELECT 'Help texts créés ✓' as status;

-- ── Colonnes thème utilisateur ────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'nuit';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_vars TEXT DEFAULT '{}';

SELECT 'Colonnes thème ajoutées ✓' as status;

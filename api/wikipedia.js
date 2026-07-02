// api/wikipedia.js — recherche Wikipedia multilingue
const { requireAuth, respond, handler } = require('./_supabase');

const LANGS = ['fr', 'en', 'es', 'de', 'ja'];

// Mots-clés par type de média pour filtrer les résultats de recherche
const MEDIA_KEYWORDS = {
  film:    ['film','cinéma','movie','long métrage','comédie','drame','thriller','animation'],
  serie:   ['série','série télévisée','saison','sitcom','feuilleton','drama'],
  jeu:     ['jeu vidéo','video game','jeu','nintendo','playstation','xbox','steam'],
  manga:   ['manga','manhwa','manhua','shōnen','seinen','shojo','seinen'],
  livre:   ['roman','livre','littérature','auteur','ouvrage','essai','biographie'],
  comics:  ['comics','bande dessinée','bd','superhéros','marvel','dc comics'],
  musique: ['musique','album','single','groupe','chanteur','artiste','discographie'],
  generic: [],
};

// Types de données attendus par champ (pour conversion)
const FIELD_TYPES = {
  'durée':          'number',   // en minutes
  'saisons':        'number',
  'épisodes':       'number',
  'volumes':        'number',
  'pages':          'number',
  'année de sortie':'number',
  'date de sortie': 'date',     // YYYY-MM-DD
};

// Champs Wikipedia par type de média
const MEDIA_FIELDS = {
  film:    ['réalisateur','genre','durée','année de sortie','pays','langue','série','producteur','scénariste'],
  serie:   ['créateur','genre','chaîne','saisons','épisodes','année de sortie','pays','langue','franchise'],
  jeu:     ['développeur','éditeur','genre','plateforme','année de sortie','série','mode de jeu'],
  manga:   ['auteur','dessinateur','genre','éditeur','volumes','année de sortie','magazine'],
  livre:   ['auteur','genre','éditeur','année de sortie','pages','série','langue originale'],
  comics:  ['auteur','dessinateur','genre','éditeur','numéros','univers','collection'],
  musique: ['artiste','genre','label','année de sortie','album','producteur'],
  generic: ['créateur','genre','année de sortie','pays','langue','série'],
};

const WIKI_HEADERS = {
  'User-Agent': 'MediaLog/1.0 (https://github.com/graphnir/medialog) Node.js',
  'Accept': 'application/json',
};

// Nettoyage wikitext complet
function cleanWikitext(str, field) {
  if (!str) return '';
  let val = str
    // [[Lien|texte]] → texte, [[Lien]] → Lien
    .replace(/\[\[([^\|\]]+)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // {{film date|YYYY|MM|DD}} → YYYY
    .replace(/\{\{(?:film date|date de sortie|start date)[^\}]*?(\d{4})[^\}]*\}\}/gi, '$1')
    // {{Unité|valeur|unité}} → valeur
    .replace(/\{\{[Uu]nit[eé]\|([^\|\}]+)\|?[^\}]*\}\}/g, '$1')
    // {{Nb|valeur}} → valeur
    .replace(/\{\{[Nn]b\|([^\}]+)\}\}/g, '$1')
    // {{lang-xx|texte}} → texte
    .replace(/\{\{(?:lang|langue|language)-[a-z]+\|([^\}]+)\}\}/gi, '$1')
    // {{nobr|texte}} → texte
    .replace(/\{\{nobr\|([^\}]+)\}\}/gi, '$1')
    // Tous les autres templates → vide
    .replace(/\{\{[^\}]{0,120}\}\}/g, '')
    // Balises HTML
    .replace(/<[^>]*>/g, '')
    // Gras/italique wiki
    .replace(/'{2,3}/g, '')
    // Commentaires wiki
    .replace(/<!--[^>]*-->/g, '')
    // Ref wiki
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
    // Nettoyages spécifiques films : "série de films" à la fin
    .replace(/\s*séri[ée]s?\s*de\s*films?\s*$/i, '')
    .replace(/\s*film\s*series\s*$/i, '')
    // Doubles espaces, tirets orphelins
    .replace(/\s*,\s*,/g, ',')
    .replace(/^\s*[,\-•·]\s*/, '')
    .replace(/\[\[/g, '') // [[résiduels
    .replace(/\]\]/g, '') // ]]résiduels
    .replace(/\s+/g, ' ')
    .trim();

  // Conversion par type de donnée
  const ftype = FIELD_TYPES[field];
  if (ftype === 'number') {
    // Extraire le premier nombre
    const m = val.match(/(\d+)/);
    return m ? m[1] : '';
  }
  if (ftype === 'date') {
    // Extraire YYYY ou YYYY-MM-DD
    const mFull = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (mFull) return `${mFull[1]}-${mFull[2]}-${mFull[3]}`;
    const mYear = val.match(/\b(19|20)\d{2}\b/);
    return mYear ? mYear[0] : val;
  }
  if (field === 'année de sortie') {
    const m = val.match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : val;
  }
  if (field === 'durée') {
    // Extraire les minutes : "152 min" → "152"
    const m = val.match(/(\d+)\s*(?:min|mn|minutes?)?/i);
    return m ? m[1] : val;
  }

  return val;
}

const fieldMap = {
  'réalisateur':     ['réalisateur','director','réalisateurs','directed by'],
  'genre':           ['genre','genres'],
  'durée':           ['durée','runtime','duration','temps'],
  'date de sortie':  ['date de sortie','date sortie','release date','released','date_de_publication'],
  'année de sortie': ['année','year','date de sortie','date sortie','release date','released','date_de_publication','annee'],
  'pays':            ['pays','country','countries','nationalité'],
  'langue':          ['langue','language','langue originale','original language'],
  'série':           ['série','series','franchise','collection','universe'],
  'franchise':       ['franchise','univers','universe','series'],
  'auteur':          ['auteur','author','auteurs','scénariste','writer','writers'],
  'dessinateur':     ['dessinateur','artist','illustrateur','penciler','penciller'],
  'développeur':     ['développeur','developer','développeurs','developers'],
  'éditeur':         ['éditeur','publisher','editor','publishers'],
  'plateforme':      ['plateforme','platform','platforms','plateformes'],
  'créateur':        ['créateur','creator','créateurs','created by','showrunner'],
  'artiste':         ['artiste','artist','interprète','performer'],
  'label':           ['label','maison de disques','record label'],
  'volumes':         ['volumes','tomes','tankobon','nb_volumes'],
  'saisons':         ['saisons','seasons','nb_saisons','number of seasons'],
  'épisodes':        ['épisodes','episodes','nb_épisodes','number of episodes'],
  'pages':           ['pages','nb_pages','nombre de pages','number of pages'],
  'producteur':      ['producteur','producer','producers','producteurs'],
  'album':           ['album','albums'],
  'magazine':        ['magazine','revue','published in'],
  'chaîne':          ['chaîne','network','channel','diffuseur'],
  'mode de jeu':     ['mode de jeu','game modes','modes'],
  'scénariste':      ['scénariste','screenplay','screenwriter','writer'],
  'langue originale':['langue originale','original language','langue'],
  'numéros':         ['numéros','issues','number of issues'],
  'univers':         ['univers','universe','franchise'],
  'collection':      ['collection','series','imprint'],
};

async function wikiSearch(query, lang, mediaType = 'generic') {
  // Ajouter le type de média à la recherche pour filtrer
  const keywords = MEDIA_KEYWORDS[mediaType] || [];
  const searchQuery = mediaType !== 'generic' && keywords.length
    ? `${query} ${keywords[0]}`  // ex: "Dune film"
    : query;

  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&utf8=1&srlimit=8&srprop=snippet|titlesnippet&origin=*`;
  const r = await fetch(url, { headers: WIKI_HEADERS });
  if (!r.ok) return [];
  const data = await r.json();

  // Récupérer aussi les images des pages trouvées
  const results = data.query?.search || [];
  if (!results.length) return [];

  // Récupérer les images en batch
  const pageIds = results.map(r => r.pageid).join('|');
  const imgUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages&pithumbsize=80&format=json&utf8=1&origin=*`;
  const imgR = await fetch(imgUrl, { headers: WIKI_HEADERS });
  const imgData = imgR.ok ? await imgR.json() : {};
  const imgPages = imgData.query?.pages || {};

  return results.map(item => ({
    title: item.title,
    snippet: item.snippet?.replace(/<[^>]*>/g, '').slice(0, 150) || '',
    lang,
    pageid: item.pageid,
    thumbnail: imgPages[item.pageid]?.thumbnail?.source || null,
  }));
}

async function wikiExtract(title, lang, fields) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=revisions|pageimages&rvprop=content&rvslots=main&pithumbsize=300&format=json&utf8=1&origin=*`;
  const r = await fetch(url, { headers: WIKI_HEADERS });
  if (!r.ok) return {};
  const data = await r.json();
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page || page.missing) return {};

  const content = page.revisions?.[0]?.slots?.main?.['*'] || '';
  const thumbnail = page.thumbnail?.source || null;
  const result = { _thumbnail: thumbnail, _wikiTitle: title };

  for (const field of fields) {
    const aliases = fieldMap[field] || [field];
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      // 1. Essai sur une seule ligne (plus précis)
      const reSingle = new RegExp(`\\|\\s*${escaped}\\s*=\\s*([^\\|\\}\\n]+)`, 'i');
      // 2. Fallback multiligne pour les templates comme {{Film date|...\n|df=yes}}
      const reMulti = new RegExp(`\\|\\s*${escaped}\\s*=\\s*([\\s\\S]{1,300}?)(?=\\n\\s*\\||\\n\\}\\})`, 'i');

      let rawVal = null;
      const m1 = content.match(reSingle);
      if (m1) rawVal = m1[1];
      // Si la valeur contient un template non fermé ({{...) on essaie le multiligne
      if (!rawVal || (rawVal.includes('{{') && !rawVal.includes('}}'))) {
        const m2 = content.match(reMulti);
        if (m2) rawVal = m2[1];
      }

      if (rawVal) {
        const val = cleanWikitext(rawVal, field);
        if (val && val.length > 0 && val.length < 200) {
          result[field] = val;
          break;
        }
      }
    }
  }

  return result;
}

module.exports = handler(async (req, res) => {
  await requireAuth(req);

  if (req.method === 'GET' && req.query?.action === 'search') {
    const { q, lang = 'fr', mediaType = 'generic' } = req.query;
    if (!q?.trim()) return respond(res, 400, { error: 'Paramètre q manquant' });
    try {
      const results = await wikiSearch(q.trim(), lang, mediaType);
      return respond(res, 200, { results });
    } catch (e) {
      return respond(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && req.query?.action === 'extract') {
    const { title, lang = 'fr', fields: fieldsParam, mediaType = 'generic' } = req.query;
    if (!title?.trim()) return respond(res, 400, { error: 'title manquant' });

    const requestedFields = fieldsParam
      ? fieldsParam.split(',').map(f => f.trim()).filter(Boolean)
      : (MEDIA_FIELDS[mediaType] || MEDIA_FIELDS.generic);

    const result = {};

    try {
      const data = await wikiExtract(title.trim(), lang, requestedFields);
      Object.assign(result, data);

      const missingFields = requestedFields.filter(f => !result[f]);
      if (missingFields.length > 0 && lang !== 'en') {
        const iwUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=langlinks&lllang=en&format=json&utf8=1&origin=*`;
        const iwR = await fetch(iwUrl, { headers: WIKI_HEADERS });
        if (iwR.ok) {
          const iwData = await iwR.json();
          const pages = iwData.query?.pages || {};
          const page = Object.values(pages)[0];
          const enTitle = page?.langlinks?.[0]?.['*'];
          if (enTitle) {
            const enData = await wikiExtract(enTitle, 'en', missingFields);
            for (const f of missingFields) {
              if (enData[f]) result[f] = enData[f];
            }
          }
        }
      }

      const stillMissing = requestedFields.filter(f => !result[f] && f !== '_thumbnail' && f !== '_wikiTitle');
      if (stillMissing.length > 0) {
        for (const cascadeLang of ['es', 'de', 'ja']) {
          if (cascadeLang === lang) continue;
          const remaining = stillMissing.filter(f => !result[f]);
          if (!remaining.length) break;
          const searchRes = await wikiSearch(title.trim(), cascadeLang, mediaType);
          if (searchRes.length > 0) {
            const cascadeData = await wikiExtract(searchRes[0].title, cascadeLang, remaining);
            for (const f of remaining) {
              if (cascadeData[f]) result[f] = cascadeData[f];
            }
          }
        }
      }

      return respond(res, 200, {
        found: Object.keys(result).filter(k => !k.startsWith('_')).length > 0,
        data: result,
        missingFields: requestedFields.filter(f => !result[f]),
      });
    } catch (e) {
      return respond(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && req.query?.action === 'fields') {
    const { mediaType = 'generic' } = req.query;
    return respond(res, 200, {
      fields: MEDIA_FIELDS[mediaType] || MEDIA_FIELDS.generic,
      fieldTypes: FIELD_TYPES,
      mediaTypes: Object.keys(MEDIA_FIELDS),
    });
  }

  respond(res, 405, { error: 'Méthode non autorisée' });
});

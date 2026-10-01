/**
 * OpenSubtitles ES — addon de función para Nuvio Light
 *
 * El player hereda: imdb_id, type (movie|series), season, episode
 * Este script rellena la URL de opensubtitles-v3, filtra lang=spa
 * y normaliza a: { subtitles: [ { url, lang, label, id } ] }
 */

const BASE = 'https://opensubtitles-v3.strem.io';

function buildUrl(ctx) {
  const imdb = (ctx.imdb_id || ctx.imdbId || '').toString().trim();
  if (!imdb) throw new Error('imdb_id requerido');

  const type = (ctx.type || 'movie').toString().toLowerCase();
  const isSeries =
    type === 'series' ||
    type === 'tv' ||
    type === 'episode' ||
    (ctx.season != null && ctx.episode != null);

  if (isSeries) {
    const s = ctx.season;
    const e = ctx.episode;
    if (s == null || e == null) {
      throw new Error('series requiere season y episode');
    }
    return `${BASE}/subtitles/series/${imdb}:${s}:${e}.json`;
  }
  return `${BASE}/subtitles/movie/${imdb}.json`;
}

/**
 * Normaliza y expande la lista de idiomas permitidos.
 * Incluye variaciones comunes de español (spa, es, spanish, es-es, es-419, lat).
 */
function allowedLangs(config) {
  const raw = (config && (config.languages || config.langFilter)) || 'spa';
  const inputLangs = String(raw)
    .split(/[,|]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const spanishVariants = ['spa', 'es', 'spanish', 'es-es', 'es-419', 'lat'];
  const hasSpanish = inputLangs.some((l) => spanishVariants.includes(l));

  if (hasSpanish) {
    return Array.from(new Set([...inputLangs, ...spanishVariants]));
  }

  return inputLangs;
}

/**
 * Normaliza un ítem de la API Stremio OpenSubtitles-v3
 * al formato único del player Nuvio.
 */
function normalizeItem(item, addonId) {
  const url = item.url || item.SubtitleUrl || item.link || '';
  const lang = (item.lang || item.language || item.langCode || 'und')
    .toString()
    .toLowerCase();

  // Prioriza movieReleaseName sobre el resto de propiedades
  const label =
    item.movieReleaseName ||
    item.subtitleFileName ||
    item.label ||
    `Subtítulo (${lang.toUpperCase()})`;

  return {
    id: String(item.id || url),
    url: String(url),
    lang: lang,
    language: lang,
    label: String(label),
    addonId: addonId || 'opensubtitles-es',
    // extras útiles (el player puede ignorarlos)
    releaseGroup: item.releaseGroup || null,
    releaseFormat: item.releaseFormat || null,
    season: item.season != null ? Number(item.season) : null,
    episode: item.episode != null ? Number(item.episode) : null,
  };
}

/**
 * getSubtitles(ctx, config)
 * ctx: { imdb_id, type, season?, episode?, title? }
 * config: { languages: "spa" }
 *
 * @returns {Promise<{ subtitles: Array }>}
 */
async function getSubtitles(ctx, config) {
  const args = ctx || {};
  const cfg = config || {};
  const langs = allowedLangs(cfg);
  const url = buildUrl(args);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OpenSubtitles HTTP ${res.status} — ${url}`);
  }
  const data = await res.json();

  let list = [];
  if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.subtitles)) list = data.subtitles;
  else if (data && Array.isArray(data.data)) list = data.data;

  const filtered = list
    .map((item) => normalizeItem(item, 'opensubtitles-es'))
    .filter((s) => s.url && langs.includes(String(s.lang).toLowerCase()));

  return { subtitles: filtered };
}

// Exports CommonJS + global (runtime Nuvio / Stremio-like)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSubtitles,
    buildUrl,
    normalizeItem,
  };
}
if (typeof globalThis !== 'undefined') {
  globalThis.getSubtitles = getSubtitles;
}
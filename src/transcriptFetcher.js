function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseCaptionTracks(html) {
  const match = html.match(/"captionTracks":(\[.*?\])/s);
  if (!match) {
    return null;
  }
  const raw = match[1]
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u002f/g, '/');
  return JSON.parse(raw);
}

function extractTranscript(xml) {
  const lines = [];
  const regex = /<text[^>]*>(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(xml))) {
    lines.push(decodeEntities(match[1]));
  }
  return lines.join(' ');
}

async function fetchYouTubeTranscript(url, preferredLanguage = 'en') {
  if (!url) {
    return { ok: false, reason: 'Missing URL.' };
  }
  const res = await fetch(url);
  if (!res.ok) {
    return { ok: false, reason: `Failed to fetch YouTube page (${res.status}).` };
  }
  const html = await res.text();
  let tracks;
  try {
    tracks = parseCaptionTracks(html);
  } catch {
    return { ok: false, reason: 'Failed to parse caption tracks.' };
  }
  if (!tracks || tracks.length === 0) {
    return { ok: false, reason: 'No captions available.' };
  }

  const preferred = tracks.find((track) => track.languageCode && track.languageCode.startsWith(preferredLanguage));
  const selected = preferred || tracks[0];
  const baseUrl = selected.baseUrl;
  if (!baseUrl) {
    return { ok: false, reason: 'Caption track missing baseUrl.' };
  }

  const transcriptRes = await fetch(baseUrl);
  if (!transcriptRes.ok) {
    return { ok: false, reason: `Failed to fetch transcript (${transcriptRes.status}).` };
  }
  const xml = await transcriptRes.text();
  const transcript = extractTranscript(xml).trim();
  if (!transcript) {
    return { ok: false, reason: 'Transcript empty.' };
  }
  return { ok: true, transcript, language: selected.languageCode || 'unknown' };
}

module.exports = {
  fetchYouTubeTranscript,
};

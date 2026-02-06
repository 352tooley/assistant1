const { fetchYouTubeTranscript } = require('./transcriptFetcher');

async function main() {
  try {
    const url = process.env.YOUTUBE_TRANSCRIPT_URL || '';
    const language = process.env.YOUTUBE_TRANSCRIPT_LANG || 'en';
    const result = await fetchYouTubeTranscript(url, language);
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, reason: String(err.message || err) }));
  }
}

if (require.main === module) {
  main();
}

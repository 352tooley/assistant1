const fs = require('fs');
const path = require('path');

const templatesDir = path.resolve(__dirname, '..', 'templates');

function loadTemplates() {
  if (!fs.existsSync(templatesDir)) {
    return [];
  }
  return fs
    .readdirSync(templatesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
      return JSON.parse(content);
    });
}

function normalizeText(text) {
  return String(text || '').toLowerCase();
}

function scoreTemplate(template, text) {
  const haystack = normalizeText(`${template.label} ${template.description} ${template.id}`);
  const tokens = normalizeText(text).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return 0;
  }
  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += 1;
    }
  });
  return score / tokens.length;
}

function extractInputs(template, text) {
  const extracted = {};
  const missing = [];
  const lower = normalizeText(text);

  Object.keys(template.inputs || {}).forEach((key) => {
    if (key === 'idea') {
      if (text && text.trim().length > 0) {
        extracted.idea = text.trim();
      }
    }

    if (key === 'answers') {
      if (lower.includes('answers:')) {
        const match = text.split(/answers:/i)[1];
        if (match && match.trim().length > 0) {
          extracted.answers = match.trim();
        }
      }
    }

    if (key === 'url') {
      const match = text.match(/https?:\/\/\S+/);
      if (match) {
        extracted.url = match[0];
      }
    }

    if (key === 'source') {
      if (lower.includes('http')) {
        const match = text.match(/https?:\/\/\S+/);
        if (match) {
          extracted.source = match[0];
        }
      }
    }

    if (key === 'siteName') {
      const match = text.match(/site\s+named\s+"([^"]+)"/i);
      if (match) {
        extracted.siteName = match[1];
      }
    }

    if (key === 'focus') {
      const match = text.match(/focus\s+on\s+([\w\s]+)/i);
      if (match) {
        extracted.focus = match[1].trim();
      }
    }

    if (key === 'theme') {
      const match = text.match(/theme\s+([\w\s]+)/i);
      if (match) {
        extracted.theme = match[1].trim();
      }
    }

    if (key === 'length') {
      const match = text.match(/(short|medium|long)/i);
      if (match) {
        extracted.length = match[1].toLowerCase();
      }
    }
  });

  Object.keys(template.inputs || {}).forEach((key) => {
    if (template.inputs[key].required && !extracted[key]) {
      missing.push(key);
    }
  });

  return { extracted, missing };
}

function resolveTemplate(naturalLanguage) {
  const templates = loadTemplates();
  if (templates.length === 0) {
    return {
      template: null,
      confidence: 0,
      extractedInputs: {},
      missingInputs: [],
    };
  }

  const scores = templates.map((template) => ({
    template,
    score: scoreTemplate(template, naturalLanguage),
  }));

  scores.sort((a, b) => b.score - a.score);
  let best = scores[0];
  if (best.score === 0 && normalizeText(naturalLanguage).length > 0) {
    const fallback = scores.find((entry) => entry.template && entry.template.id === 'open_ended_idea');
    if (fallback) {
      best = { template: fallback.template, score: 0.1 };
    }
  }
  const confidence = Math.round(best.score * 100);
  const { extracted, missing } = extractInputs(best.template, naturalLanguage);

  return {
    template: best.template,
    confidence,
    extractedInputs: extracted,
    missingInputs: missing,
  };
}

module.exports = {
  resolveTemplate,
};

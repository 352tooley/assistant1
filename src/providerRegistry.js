module.exports = {
  openai: {
    label: 'OpenAI',
    auth: ['apiKey'],
    roles: ['auto', 'coder', 'planner'],
    models: ['gpt-5.1-codex', 'gpt-5.1-codex-mini'],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    auth: ['apiKey'],
    roles: ['claude', 'reviewer'],
    models: ['claude-3-5-sonnet-20240620'],
  },
  custom: {
    label: 'Custom / Local AI',
    auth: ['apiKey', 'oauth'],
    roles: ['custom'],
    models: [],
  },
};

module.exports = {
  openai: {
    label: 'OpenAI',
    auth: ['apiKey'],
    roles: ['auto', 'coder', 'planner'],
    models: ['gpt-4.1', 'gpt-4.1-mini'],
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

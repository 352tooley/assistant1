const fs = require('fs');
const path = require('path');

const templatesDir = path.resolve(__dirname, '..', 'templates');

function loadTemplate(templateId) {
  const filePath = path.join(templatesDir, `${templateId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isMissingRequired(value, definition) {
  if (!definition.required) {
    return false;
  }
  const type = definition.type || 'string';
  if (type === 'multi-select') {
    return !Array.isArray(value) || value.length === 0;
  }
  if (type === 'enum') {
    return value === undefined || value === null || value === '';
  }
  if (type === 'url') {
    return !isNonEmptyString(value) || !/^https?:\/\//i.test(value.trim());
  }
  return !isNonEmptyString(value);
}

function validateInputType(value, definition) {
  const type = definition.type || 'string';
  if (type === 'string') {
    return isNonEmptyString(value);
  }
  if (type === 'url') {
    return isNonEmptyString(value) && /^https?:\/\//i.test(value.trim());
  }
  if (type === 'enum') {
    return Array.isArray(definition.options) && definition.options.includes(value);
  }
  if (type === 'multi-select') {
    return Array.isArray(value) && value.length > 0;
  }
  return true;
}

function hasProvidedValue(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function validateTaskRequest(taskRequest) {
  if (!taskRequest || typeof taskRequest !== 'object') {
    return { ok: false, reason: 'TaskRequest missing or invalid.' };
  }

  const templateId = String(taskRequest.templateId || '');
  if (!templateId) {
    return { ok: false, reason: 'templateId required.' };
  }

  const template = loadTemplate(templateId);
  if (!template) {
    return { ok: false, reason: 'templateId not found.' };
  }

  if (String(taskRequest.requestedAgentRole || '') !== String(template.agentRole || '')) {
    return { ok: false, reason: 'requestedAgentRole mismatch.' };
  }

  const inputs = taskRequest.inputs || {};
  const missing = [];
  const typeErrors = [];

  Object.keys(template.inputs || {}).forEach((key) => {
    const def = template.inputs[key];
    const value = inputs[key];
    if (isMissingRequired(value, def)) {
      missing.push(key);
      return;
    }
    if (hasProvidedValue(value) && !validateInputType(value, def)) {
      typeErrors.push(key);
    }
  });

  if (missing.length > 0) {
    return { ok: false, reason: `Missing required inputs: ${missing.join(', ')}` };
  }

  if (typeErrors.length > 0) {
    return { ok: false, reason: `Input type mismatch: ${typeErrors.join(', ')}` };
  }

  const limits = taskRequest.limits || {};
  if (Number.isFinite(limits.maxCycles) && limits.maxCycles > template.maxCycles) {
    return { ok: false, reason: 'maxCycles exceeds template limit.' };
  }

  if (taskRequest.allowsClaude && !template.allowsClaude) {
    return { ok: false, reason: 'Claude not allowed for this template.' };
  }

  return { ok: true, template };
}

module.exports = {
  validateTaskRequest,
};

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const allowedPrefixes = ['src/', 'docs/'];
const forbiddenFiles = new Set(['docs/AGENT_CONTRACT.md', 'docs/ACCEPTANCE.md']);
const allowedStrategies = new Set(['fix-task-definition']);

/**
 * Fix Packet shape:
 * { diagnosis: string, proposedFix: { description: string, filesToChange: string[], strategy: string } }
 */
function normalize(filePath) {
  return filePath.replace(/\\/g, '/');
}

function fileExists(relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  return fs.existsSync(absolute);
}

function validateFixPacket(packet) {
  const reasons = [];

  if (!packet || typeof packet !== 'object') {
    return { ok: false, reasons: ['Fix packet must be an object.'] };
  }
  if (typeof packet.diagnosis !== 'string' || packet.diagnosis.trim() === '') {
    reasons.push('Diagnosis must be a non-empty string.');
  }
  if (!packet.proposedFix || typeof packet.proposedFix !== 'object') {
    reasons.push('Proposed fix must be an object.');
  }

  const proposedFix = packet.proposedFix || {};
  if (typeof proposedFix.description !== 'string' || proposedFix.description.trim() === '') {
    reasons.push('Proposed fix description must be a non-empty string.');
  }
  if (!Array.isArray(proposedFix.filesToChange) || proposedFix.filesToChange.length === 0) {
    reasons.push('filesToChange must be a non-empty array.');
  }
  if (typeof proposedFix.strategy !== 'string' || proposedFix.strategy.trim() === '') {
    reasons.push('strategy must be a non-empty string.');
  }

  if (proposedFix.strategy && !allowedStrategies.has(proposedFix.strategy)) {
    reasons.push('strategy is not allowed.');
  }

  if (Array.isArray(proposedFix.filesToChange)) {
    proposedFix.filesToChange.forEach((filePath) => {
      if (typeof filePath !== 'string' || filePath.trim() === '') {
        reasons.push('filesToChange entries must be non-empty strings.');
        return;
      }
      const normalized = normalize(filePath);
      const inAllowed = allowedPrefixes.some((prefix) => normalized.startsWith(prefix));
      if (!inAllowed) {
        reasons.push(`File outside allowed scope: ${normalized}`);
      }
      if (forbiddenFiles.has(normalized)) {
        reasons.push(`Forbidden file targeted: ${normalized}`);
      }
      if (inAllowed && !fileExists(normalized)) {
        reasons.push(`File does not exist: ${normalized}`);
      }
    });
  }

  if (Array.isArray(proposedFix.filesToChange) && proposedFix.filesToChange.length > 2) {
    reasons.push('Fix changes too many files for a minimal patch.');
  }

  return { ok: reasons.length === 0, reasons };
}

module.exports = {
  validateFixPacket,
};

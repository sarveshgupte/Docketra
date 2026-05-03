#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();

// Historical archives are intentionally excluded from strict validation to avoid
// failing CI on legacy snapshots that are not maintained as current operating docs.
const EXPLICITLY_IGNORED_PREFIXES = ['docs/archive/', 'docs/features/pr-history/'];
const EXPLICITLY_IGNORED_FILES = [
  'docs/features/DOCUMENTATION_INDEX.md',
  'docs/features/DOCUMENTATION_AUDIT_SUMMARY.md',
  'docs/features/FIRM_SCOPED_ROUTING_COMPLETE.md',
];

function getMarkdownFiles() {
  const output = execSync("rg --files -g '*.md'", { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isExternalLink(target) {
  return /^(https?:\/\/|mailto:|tel:)/i.test(target);
}

function isIgnoredMarkdownFile(filePath) {
  return (
    EXPLICITLY_IGNORED_PREFIXES.some((prefix) => filePath.startsWith(prefix)) ||
    EXPLICITLY_IGNORED_FILES.includes(filePath)
  );
}

function normalizeTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  const noAnchor = trimmed.split('#')[0];
  const noQuery = noAnchor.split('?')[0];
  return noQuery;
}

function extractLinks(markdownText) {
  const links = [];
  const inlineLinkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  const refDefRegex = /^\s*\[[^\]]+\]:\s+(\S+)/gm;

  let match;
  while ((match = inlineLinkRegex.exec(markdownText)) !== null) {
    links.push(match[1]);
  }
  while ((match = refDefRegex.exec(markdownText)) !== null) {
    links.push(match[1]);
  }

  return links;
}

function main() {
  const markdownFiles = getMarkdownFiles();
  const missingTargets = [];
  const externalWarnings = [];
  const ignoredFiles = [];

  for (const markdownFile of markdownFiles) {
    if (isIgnoredMarkdownFile(markdownFile)) {
      ignoredFiles.push(markdownFile);
      continue;
    }

    const absoluteFilePath = path.resolve(repoRoot, markdownFile);
    const markdownText = fs.readFileSync(absoluteFilePath, 'utf8');
    const linkTargets = extractLinks(markdownText);

    for (const target of linkTargets) {
      const cleanedTarget = normalizeTarget(target);
      if (!cleanedTarget || cleanedTarget.startsWith('#')) {
        continue;
      }

      if (isExternalLink(cleanedTarget)) {
        externalWarnings.push(`${markdownFile} -> ${cleanedTarget}`);
        continue;
      }

      if (cleanedTarget.startsWith('<') && cleanedTarget.endsWith('>')) {
        continue;
      }

      const resolvedPath = path.resolve(path.dirname(absoluteFilePath), cleanedTarget);
      if (!fs.existsSync(resolvedPath)) {
        missingTargets.push(`${markdownFile} -> ${target}`);
      }
    }
  }

  if (ignoredFiles.length) {
    console.log('ℹ️ Ignored archived markdown scopes (documented):');
    for (const file of ignoredFiles) {
      console.log(`  - ${file}`);
    }
  }

  if (externalWarnings.length) {
    console.log(`⚠️ External links found (not CI-failing): ${externalWarnings.length}`);
  }

  if (missingTargets.length) {
    console.error('❌ Broken markdown links found:');
    for (const missing of missingTargets) {
      console.error(`  - ${missing}`);
    }
    process.exit(1);
  }

  console.log(`✅ Markdown relative link check passed for ${markdownFiles.length - ignoredFiles.length} files.`);
}

main();

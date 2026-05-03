#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

// Historical archives are intentionally excluded from strict validation to avoid
// failing CI on legacy snapshots that are not maintained as current operating docs.
const EXPLICITLY_IGNORED_PREFIXES = ['docs/archive/', 'docs/features/pr-history/'];
const EXPLICITLY_IGNORED_FILES = [
  'docs/features/DOCUMENTATION_INDEX.md',
  'docs/features/DOCUMENTATION_AUDIT_SUMMARY.md',
  'docs/features/FIRM_SCOPED_ROUTING_COMPLETE.md',
];
const WALKER_IGNORED_DIRS = new Set(['node_modules', '.git', 'dist']);

function collectMarkdownFiles(currentDir, files = [], rootDir = currentDir) {
  const entries = fs.readdirSync(currentDir);
  for (const entry of entries) {
    if (WALKER_IGNORED_DIRS.has(entry)) {
      continue;
    }

    const absoluteEntryPath = path.join(currentDir, entry);
    const stat = fs.statSync(absoluteEntryPath);
    if (stat.isDirectory()) {
      collectMarkdownFiles(absoluteEntryPath, files, rootDir);
      continue;
    }

    if (stat.isFile() && entry.toLowerCase().endsWith('.md')) {
      files.push(path.relative(rootDir, absoluteEntryPath).replaceAll(path.sep, '/'));
    }
  }
  return files;
}

function getMarkdownFiles() {
  return collectMarkdownFiles(repoRoot, [], repoRoot);
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

if (require.main === module) {
  main();
}

module.exports = {
  collectMarkdownFiles,
  getMarkdownFiles,
  normalizeTarget,
  isExternalLink,
  isIgnoredMarkdownFile,
  EXPLICITLY_IGNORED_PREFIXES,
};

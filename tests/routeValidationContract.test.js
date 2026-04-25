#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');
const SCHEMAS_DIR = path.join(__dirname, '..', 'src', 'schemas');

/**
 * Phased rollout model:
 * - Routes using applyRouteValidation are strictly enforced.
 * - Routes not using applyRouteValidation must be intentionally listed here with a migration reason.
 */
const ALLOWLIST_NO_VALIDATION = {
  'routeGroups.js': 'Utility middleware grouping module; does not define Express route handlers.',
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function parseRouteKeys(routeSource) {
  const keys = new Set();
  const routeRegex = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = routeRegex.exec(routeSource)) !== null) {
    const method = String(match[1]).toUpperCase();
    const routePath = match[2];
    keys.add(`${method} ${routePath}`);
  }
  return keys;
}

function parseSchemaFileName(routeSource) {
  const schemaRequireRegex = /require\(\s*['"]\.\.\/schemas\/([^'"]+\.routes\.schema(?:\.js)?)['"]\s*\)/;
  const match = routeSource.match(schemaRequireRegex);
  if (!match) return null;
  return match[1].endsWith('.js') ? match[1] : `${match[1]}.js`;
}

function printSummary({ validatedRouteFiles, legacyAllowlistedRouteFiles, missingSchemaErrors, staleSchemaErrors, keyFormatErrors, missingAllowlistErrors }) {
  console.log('Route validation contract summary');
  console.log(`- validated route files (${validatedRouteFiles.length}): ${validatedRouteFiles.join(', ') || '(none)'}`);
  console.log(`- legacy allowlisted route files (${legacyAllowlistedRouteFiles.length}): ${legacyAllowlistedRouteFiles.join(', ') || '(none)'}`);
  console.log(`- missing schema failures: ${missingSchemaErrors.length}`);
  console.log(`- stale schema failures: ${staleSchemaErrors.length}`);
  console.log(`- invalid schema-key format failures: ${keyFormatErrors.length}`);
  console.log(`- non-allowlisted legacy route failures: ${missingAllowlistErrors.length}`);
}

function run() {
  const routeFiles = fs.readdirSync(ROUTES_DIR).filter((name) => name.endsWith('.js')).sort();
  const schemaRouteKeys = new Map();

  const validatedRouteFiles = [];
  const legacyAllowlistedRouteFiles = [];

  const missingSchemaErrors = [];
  const staleSchemaErrors = [];
  const keyFormatErrors = [];
  const missingAllowlistErrors = [];

  for (const routeFile of routeFiles) {
    const routePath = path.join(ROUTES_DIR, routeFile);
    const source = fs.readFileSync(routePath, 'utf8');
    const usesRouter = source.includes('express.Router(');

    if (!usesRouter) {
      if (ALLOWLIST_NO_VALIDATION[routeFile]) {
        legacyAllowlistedRouteFiles.push(routeFile);
      }
      continue;
    }

    const usesApplyRouteValidation = source.includes('applyRouteValidation(');

    if (!usesApplyRouteValidation) {
      if (ALLOWLIST_NO_VALIDATION[routeFile]) {
        legacyAllowlistedRouteFiles.push(routeFile);
      } else {
        missingAllowlistErrors.push(
          `[Validation Contract] ${routeFile} defines routes without applyRouteValidation. Add Zod + applyRouteValidation or explicitly allowlist with a migration reason.`
        );
      }
      continue;
    }

    validatedRouteFiles.push(routeFile);

    const schemaFile = parseSchemaFileName(source);
    if (!schemaFile) {
      missingSchemaErrors.push(
        `[Validation Contract] ${routeFile} uses applyRouteValidation but no schema file import was found.`
      );
      continue;
    }

    const schemaPath = path.join(SCHEMAS_DIR, schemaFile);
    if (!fs.existsSync(schemaPath)) {
      missingSchemaErrors.push(
        `[Validation Contract] Missing schema file for ${routeFile}: expected src/schemas/${schemaFile}`
      );
      continue;
    }

    const routeKeys = parseRouteKeys(source);
    if (!schemaRouteKeys.has(schemaFile)) {
      schemaRouteKeys.set(schemaFile, new Set());
    }
    const unionKeys = schemaRouteKeys.get(schemaFile);
    for (const routeKey of routeKeys) {
      unionKeys.add(routeKey);
    }
  }

  for (const [schemaFile, routeKeys] of schemaRouteKeys.entries()) {
    const schemaPath = path.join(SCHEMAS_DIR, schemaFile);
    const schema = require(schemaPath);
    const schemaKeys = new Set(Object.keys(schema));

    for (const routeKey of routeKeys) {
      if (!schemaKeys.has(routeKey)) {
        missingSchemaErrors.push(`[Validation Contract] Missing schema key "${routeKey}" in src/schemas/${schemaFile}.`);
      }
    }

    for (const schemaKey of schemaKeys) {
      if (!routeKeys.has(schemaKey)) {
        staleSchemaErrors.push(`[Validation Contract] Stale schema key "${schemaKey}" in src/schemas/${schemaFile} (route no longer exists).`);
      }

      const [method, ...pathParts] = schemaKey.split(' ');
      if (!HTTP_METHODS.includes(String(method || '').toLowerCase()) || pathParts.length === 0 || !String(pathParts.join(' ')).startsWith('/')) {
        keyFormatErrors.push(`[Validation Contract] Invalid schema key format in ${schemaFile}: "${schemaKey}". Expected "<METHOD> /path".`);
      }
    }
  }

  printSummary({
    validatedRouteFiles,
    legacyAllowlistedRouteFiles,
    missingSchemaErrors,
    staleSchemaErrors,
    keyFormatErrors,
    missingAllowlistErrors,
  });

  const errors = [
    ...missingAllowlistErrors,
    ...missingSchemaErrors,
    ...staleSchemaErrors,
    ...keyFormatErrors,
  ];

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

try {
  run();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}

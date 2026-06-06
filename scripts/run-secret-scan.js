#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GITLEAKS_VERSION = '8.24.2';
const GITLEAKS_IMAGE = `zricethezav/gitleaks:v${GITLEAKS_VERSION}`;
const repoRoot = path.resolve(__dirname, '..');

function npmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function commandExists(command) {
  const probe = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [command] : ['-v', command];
  const result = spawnSync(probe, args, { stdio: 'ignore', shell: process.platform !== 'win32' });
  return result.status === 0;
}

function run(label, command, args, options = {}) {
  console.log(`[secret-scan] Running gitleaks via ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`[secret-scan] ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: options.encoding || 'utf8',
    stdio: options.stdio || 'pipe',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function copyFilePreservingPath(sourceRoot, targetRoot, relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function createTrackedSnapshot() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docketra-secret-scan-'));
  const output = runGit(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'buffer' });
  const files = Buffer.from(output).toString('utf8').split('\0').filter(Boolean);
  for (const file of files) {
    const absolute = path.join(repoRoot, file);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      copyFilePreservingPath(repoRoot, tmpDir, file);
    }
  }
  return tmpDir;
}

function download(url, destination, redirectCount = 0) {
  if (redirectCount > 5) throw new Error('Too many redirects while downloading gitleaks');
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        download(response.headers.location, destination, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(30000, () => request.destroy(new Error('Download timed out')));
  });
}

async function installGitleaks(tmpDir) {
  const platformMap = {
    linux: ['linux', 'x64', 'tar.gz'],
    darwin: ['darwin', process.arch === 'arm64' ? 'arm64' : 'x64', 'tar.gz'],
    win32: ['windows', process.arch === 'arm64' ? 'arm64' : 'x64', 'zip'],
  };
  const platform = platformMap[process.platform];
  if (!platform) throw new Error(`Unsupported platform for automatic gitleaks install: ${process.platform}`);

  const [osName, archName, extension] = platform;
  const archiveName = `gitleaks_${GITLEAKS_VERSION}_${osName}_${archName}.${extension}`;
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${archiveName}`;
  const archivePath = path.join(tmpDir, archiveName);
  console.log(`[secret-scan] Downloading pinned gitleaks ${GITLEAKS_VERSION} for ${osName}/${archName}`);
  await download(url, archivePath);

  if (extension === 'zip') {
    const result = spawnSync('powershell', ['-NoProfile', '-Command', 'Expand-Archive', '-LiteralPath', archivePath, '-DestinationPath', tmpDir, '-Force'], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Failed to extract gitleaks zip archive');
    return path.join(tmpDir, 'gitleaks.exe');
  }

  const result = spawnSync('tar', ['-xzf', archivePath, '-C', tmpDir], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Failed to extract gitleaks tar archive');
  const binary = path.join(tmpDir, 'gitleaks');
  fs.chmodSync(binary, 0o755);
  return binary;
}

async function main() {
  const scanRoot = createTrackedSnapshot();
  const cleanup = () => fs.rmSync(scanRoot, { recursive: true, force: true });
  process.on('exit', cleanup);

  const configPath = path.join(repoRoot, '.gitleaks.toml');
  fs.copyFileSync(configPath, path.join(scanRoot, '.gitleaks.toml'));
  const args = ['dir', scanRoot, '--redact', '-c', path.join(scanRoot, '.gitleaks.toml')];

  if (commandExists('gitleaks') && run('local binary', 'gitleaks', args)) return;

  if (process.env.GITHUB_ACTIONS === 'true' && commandExists('docker')) {
    const dockerArgs = ['run', '--rm', '-v', `${scanRoot}:/repo`, '-w', '/repo', GITLEAKS_IMAGE, 'dir', '/repo', '--redact', '-c', '/repo/.gitleaks.toml'];
    if (run(`docker image ${GITLEAKS_IMAGE}`, 'docker', dockerArgs)) return;
  }

  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docketra-gitleaks-'));
  try {
    const binary = await installGitleaks(installDir);
    if (run('downloaded binary', binary, args)) return;
  } catch (error) {
    console.error(`[secret-scan] ${error.message}`);
  } finally {
    fs.rmSync(installDir, { recursive: true, force: true });
  }

  console.error('[secret-scan] ERROR: Unable to run gitleaks automatically.');
  console.error(`[secret-scan] Install gitleaks manually and rerun: ${npmCmd()} run security:secrets`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`[secret-scan] ${error.message}`);
  process.exit(1);
});

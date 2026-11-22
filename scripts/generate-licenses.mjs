#!/usr/bin/env node
/**
 * Walk the production dependency graph and write src/legal/licenses.json.
 * Strips author/email/url fields — no personal metadata in the artifact.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/legal/licenses.json');
const requireFromRoot = createRequire(join(root, 'package.json'));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function licenseTextFor(pkgDir) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
    const path = join(pkgDir, name);
    if (!existsSync(path)) {
      continue;
    }
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      // Try the next candidate filename.
    }
  }
  return undefined;
}

function pnpmVirtualDir(name, version) {
  // Isolated pnpm layouts keep each instance under .pnpm/<name>@<version>_<peers>/.
  // `nodeLinker: hoisted` (what this repo uses) usually resolves through the top
  // level, but a differently-resolved peer set only exists here.
  const virtualDir = join(root, 'node_modules', '.pnpm');
  if (!version || !existsSync(virtualDir)) {
    return null;
  }
  const prefix = `${name.replace('/', '+')}@${version}`;
  let entries;
  try {
    entries = readdirSync(virtualDir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry !== prefix && !entry.startsWith(`${prefix}_`)) {
      continue;
    }
    const dir = join(virtualDir, entry, 'node_modules', ...name.split('/'));
    if (existsSync(join(dir, 'package.json'))) {
      return realpathSync(dir);
    }
  }
  return null;
}

function resolvePkgDir(name, version) {
  // Prefer the install path the package manager reported (when present).
  // Fall back to a hoisted node_modules layout, then the pnpm virtual store,
  // then require.resolve.
  const candidates = [join(root, 'node_modules', ...name.split('/'))];
  for (const dir of candidates) {
    const pkgJson = join(dir, 'package.json');
    if (!existsSync(pkgJson)) {
      continue;
    }
    try {
      const pkg = readJson(pkgJson);
      if (!version || pkg.version === version) {
        return realpathSync(dir);
      }
    } catch {
      // keep looking
    }
  }
  const virtual = pnpmVirtualDir(name, version);
  if (virtual) {
    return virtual;
  }
  try {
    return dirname(realpathSync(requireFromRoot.resolve(`${name}/package.json`)));
  } catch {
    return null;
  }
}

function walk(deps, seen, out) {
  if (!deps || typeof deps !== 'object') {
    return;
  }
  for (const [name, node] of Object.entries(deps)) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    const version = typeof node.version === 'string' ? node.version : '';
    const key = version ? `${name}@${version}` : name;
    if (!seen.has(key)) {
      seen.add(key);
      const pkgDir =
        typeof node.path === 'string' && node.path
          ? node.path
          : resolvePkgDir(name, version || undefined);
      let license = 'UNKNOWN';
      let licenseText;
      if (pkgDir) {
        try {
          const pkg = readJson(join(pkgDir, 'package.json'));
          const raw = pkg.license;
          if (typeof raw === 'string') {
            license = raw;
          } else if (raw && typeof raw === 'object' && typeof raw.type === 'string') {
            license = raw.type;
          }
          licenseText = licenseTextFor(pkgDir);
        } catch {
          // Keep UNKNOWN when package.json is unreadable.
        }
      }
      /** @type {{ name: string; version: string; license: string; licenseText?: string }} */
      const entry = { name, version: version || 'unknown', license };
      if (licenseText) {
        entry.licenseText = licenseText;
      }
      out.push(entry);
    }
    walk(node.dependencies, seen, out);
  }
}

function parseTree(raw) {
  try {
    const parsed = JSON.parse(raw);
    // `pnpm list --json` prints one entry per project.
    const project = Array.isArray(parsed) ? parsed[0] : parsed;
    const dependencies = project && project.dependencies;
    return dependencies && typeof dependencies === 'object' ? dependencies : null;
  } catch {
    return null;
  }
}

function readDependencyTree() {
  try {
    const raw = execFileSync('pnpm', ['list', '--prod', '--depth=Infinity', '--json'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseTree(raw);
  } catch (error) {
    // A non-zero exit can still leave usable JSON on stdout.
    const raw = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : '';
    return raw ? parseTree(raw) : null;
  }
}

// `pnpm list` reports every node as { version, path, dependencies }, which is
// exactly what walk() wants. `npm ls` is not an option any more: against a
// pnpm-installed tree it flags every hoisted package as extraneous and prints
// no usable graph.
const dependencies = readDependencyTree();

if (!dependencies) {
  console.error(
    'Could not read the production dependency tree via `pnpm list`. Run `pnpm install` first — ' +
      'refusing to write an empty or partial license inventory.',
  );
  process.exit(1);
}

const out = [];
walk(dependencies, new Set(), out);

// Fonts ship as assets, not packages, so `npm ls` never sees them. Their
// licence has to travel with the binary all the same.
const fontNoticePath = join(root, 'assets/fonts/OFL-GoogleSans.txt');
if (existsSync(fontNoticePath)) {
  out.push({
    name: 'Google Sans',
    version: '14.0',
    license: 'OFL-1.1',
    licenseText: readFileSync(fontNoticePath, 'utf8').trim(),
  });
}

out.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const known = out.filter(e => e.license !== 'UNKNOWN' && e.version !== 'unknown');
if (known.length === 0) {
  console.error('Refusing to overwrite licenses.json: no resolved production licenses.');
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${out.length} licenses (${known.length} known) → src/legal/licenses.json`);

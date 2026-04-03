#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

const DEFAULT_ENTRIES = [
  'index.html',
  'app.js',
  'data-generator.js',
  'plugin-registry.js',
  'sample-data.js',
  'js',
  'tabs',
  'docs/wasm-explainer.html',
];

const { sourceDir, outputDir } = parseArgs(process.argv.slice(2));
const sourceRoot = path.resolve(sourceDir ?? process.cwd());
const targetRoot = path.resolve(outputDir ?? path.join(process.cwd(), '.pages-artifact'));

prepareArtifact(sourceRoot, targetRoot);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return {
    sourceDir: args.source,
    outputDir: args.output,
  };
}

function prepareArtifact(sourceRoot, targetRoot) {
  if (!existsSync(sourceRoot)) {
    throw new Error(`Source directory not found: ${sourceRoot}`);
  }

  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });

  for (const entry of DEFAULT_ENTRIES) {
    const sourcePath = path.join(sourceRoot, entry);
    if (!existsSync(sourcePath)) {
      throw new Error(`Required frontend entry not found: ${entry}`);
    }

    const targetPath = path.join(targetRoot, entry);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath, { recursive: true });
  }

  writeFileSync(path.join(targetRoot, '.nojekyll'), '');
}

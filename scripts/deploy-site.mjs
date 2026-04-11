#!/usr/bin/env node

import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

const TARGET_REGION = 'us-west-2';
const DEFAULT_DATA_PREFIX = 'data';
const DEFAULT_BASE_URL = 'mullmania.com';

function resolveDeploymentTarget(baseUrl) {
  // Handle the mikesendpoint.com bucket naming exception
  // mikesendpoint.com stores EVERYTHING in mikesendpoint-sites (no separate data bucket)
  if (baseUrl === 'mikesendpoint.com') {
    return {
      hostingBucket: 'mikesendpoint-sites',
      dataBucket: 'mikesendpoint-sites',  // Same bucket for metadata
      archiveBucket: 'mikesendpoint-sites',  // Same bucket for archives
    };
  }
  
  // Standard pattern for other domains (mullmania.com, etc.)
  return {
    hostingBucket: baseUrl,
    dataBucket: `${baseUrl}-data`,
    archiveBucket: `${baseUrl}-archive`,
  };
}

async function main() {
  const { mode, options } = parseArgs(process.argv.slice(2));
  const config = loadConfig(options.configPath);
  const resolved = await resolveOptions(config, options);
  const plan = await buildPlan(resolved);

  if (mode === 'plan') {
    printPlan(plan);
    return;
  }

  await applyPlan(plan);
  printApplySummary(plan);
}

function parseArgs(argv) {
  const mode = argv[0] ?? 'plan';
  if (!['plan', 'apply'].includes(mode)) {
    throw new Error(`Unsupported mode "${mode}". Use "plan" or "apply".`);
  }

  const options = {
    exclude: [],
    dataExclude: [],
    tags: [],
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--delete') {
      options.deleteHosting = true;
      continue;
    }

    if (arg === '--no-delete') {
      options.deleteHosting = false;
      continue;
    }

    if (arg === '--data-delete') {
      options.deleteData = true;
      continue;
    }

    if (arg === '--no-data-delete') {
      options.deleteData = false;
      continue;
    }

    if (arg === '--tag') {
      index += 1;
      options.tags.push(requireValue(arg, argv[index]));
      continue;
    }

    if (arg === '--exclude') {
      index += 1;
      options.exclude.push(requireValue(arg, argv[index]));
      continue;
    }

    if (arg === '--data-exclude') {
      index += 1;
      options.dataExclude.push(requireValue(arg, argv[index]));
      continue;
    }

    const [flag, inlineValue] = arg.split('=', 2);
    const value = inlineValue ?? argv[index + 1];

    switch (flag) {
      case '--config':
        options.configPath = requireValue(flag, value);
        if (inlineValue === undefined) {
          index += 1;
        }
        break;
      case '--base-url':
        options.baseUrl = requireValue(flag, value);
        if (inlineValue === undefined) {
          index += 1;
        }
        break;
      case '--site':
        options.siteId = requireValue(flag, value);
        if (inlineValue === undefined) {
          index += 1;
        }
        break;
      case '--source':
        options.sourceDir = requireValue(flag, value);
        if (inlineValue === undefined) {
          index += 1;
        }
        break;
      case '--data':
        options.dataDir = requireValue(flag, value);
        if (inlineValue === undefined) {
          index += 1;
        }
        break;
      case '--data-prefix':
        options.dataPrefix = requireValue(flag, value);
        if (inlineValue === undefined) {
          index += 1;
        }
        break;
      case '--note':
        options.note = requireValue(flag, value);
        if (inlineValue === undefined) {
          index += 1;
        }
        break;
      default:
        throw new Error(`Unknown argument "${arg}".`);
    }
  }

  return { mode, options };
}

function requireValue(flag, value) {
  if (value === undefined || value === '') {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function loadConfig(explicitPath) {
  const configPath = explicitPath
    ? path.resolve(explicitPath)
    : discoverConfigPath();

  if (!configPath) {
    return {
      configPath: null,
      configDir: process.cwd(),
      config: {},
    };
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  return {
    configPath,
    configDir: path.dirname(configPath),
    config,
  };
}

function discoverConfigPath() {
  const candidates = [
    path.resolve(process.cwd(), 'mullmania.site.json'),
    path.resolve(process.cwd(), 'site.json'),
    path.resolve(process.cwd(), '.mullmania', 'site.json'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function resolveOptions(loadedConfig, options) {
  const config = loadedConfig.config;
  
  // Resolve base URL from CLI, environment, or default
  const baseUrl = options.baseUrl || process.env.DEPLOY_BASE_URL || DEFAULT_BASE_URL;
  const deploymentTarget = resolveDeploymentTarget(baseUrl);
  
  const siteId = resolveSiteId(options.siteId ?? config.siteId);
  if (!siteId) {
    throw new Error(`A site id is required. Provide --site or set siteId in mullmania.site.json or site.json.`);
  }

  const sourceDirValue = options.sourceDir ?? config.publishDir ?? config.sourceDir;
  if (!sourceDirValue) {
    throw new Error(`A publish directory is required. Provide --source or set publishDir in mullmania.site.json or site.json.`);
  }

  const sourceDir = resolveMaybeRelative(sourceDirValue, loadedConfig.configDir);
  ensureDirectoryExists(sourceDir, 'source');

  const dataDirValue = options.dataDir ?? config.dataDir ?? null;
  const dataDir = dataDirValue ? resolveMaybeRelative(dataDirValue, loadedConfig.configDir) : null;
  if (dataDir) {
    ensureDirectoryExists(dataDir, 'data');
  }

  const deleteHosting = options.deleteHosting ?? (config.delete !== false);
  const deleteData = options.deleteData ?? (config.dataDelete === true);
  const dataPrefix = normalizePlanningPath(options.dataPrefix ?? config.dataPrefix ?? DEFAULT_DATA_PREFIX)
    .replace(/^\/+|\/+$/g, '');
  const exclude = Array.from(new Set([...(config.exclude ?? []), ...options.exclude]));
  const dataExclude = Array.from(new Set([...(config.dataExclude ?? []), ...options.dataExclude]));

  const tags = Array.from(new Set([...(config.tags ?? []), ...(options.tags ?? [])])).filter(Boolean);
  const notes = Array.from(new Set([...(config.notes ? [config.notes] : []), ...(options.note ? [options.note] : [])]));
  const publishContext = await detectPublishContext(sourceDir);
  const cacheControlRules = normalizeCacheControlRules(config.cacheControl);
  const cloudfront = normalizeCloudFrontConfig(config.cloudfront);

  return {
    configPath: loadedConfig.configPath,
    configDir: loadedConfig.configDir,
    rawConfig: config,
    baseUrl,
    hostingBucket: deploymentTarget.hostingBucket,
    dataBucket: deploymentTarget.dataBucket,
    archiveBucket: deploymentTarget.archiveBucket,
    siteId,
    host: siteId === '_root' ? baseUrl : `${siteId}.${baseUrl}`,
    sourceDir,
    dataDir,
    dataPrefix,
    deleteHosting,
    deleteData,
    exclude,
    dataExclude,
    tags,
    notes,
    publishContext,
    cacheControlRules,
    cloudfront,
  };
}

function normalizeCacheControlRules(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([pattern, cacheControl]) => typeof pattern === 'string' && pattern.trim() && typeof cacheControl === 'string' && cacheControl.trim())
    .map(([pattern, cacheControl]) => ({
      pattern: pattern.trim(),
      cacheControl: cacheControl.trim(),
    }));
}

function normalizeCloudFrontConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const distributionId = value.distributionId ?? value.distribution ?? null;
  const invalidate = value.invalidate === true;
  const paths = Array.isArray(value.paths) && value.paths.length > 0 
    ? value.paths 
    : ['/*'];

  if (!distributionId || !invalidate) {
    return null;
  }

  return {
    distributionId: distributionId.trim(),
    paths,
  };
}

function resolveMaybeRelative(value, baseDir) {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function ensureDirectoryExists(directoryPath, label) {
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
    throw new Error(`The ${label} directory does not exist: ${directoryPath}`);
  }
}

async function detectPublishContext(sourceDir) {
  const candidates = [
    sourceDir,
    process.cwd(),
  ];

  let gitRoot = null;
  for (const candidate of candidates) {
    try {
      gitRoot = (await execAndTrim('git', ['rev-parse', '--show-toplevel'], candidate));
      if (gitRoot) {
        break;
      }
    } catch {
      // Ignore and keep looking.
    }
  }

  let github = process.env.GITHUB_ACTIONS === 'true'
    ? {
        actions: true,
        repository: process.env.GITHUB_REPOSITORY ?? null,
        ref: process.env.GITHUB_REF ?? null,
        sha: process.env.GITHUB_SHA ?? null,
        runId: process.env.GITHUB_RUN_ID ?? null,
        runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
      }
    : null;

  if (!gitRoot) {
    return {
      github,
      git: null,
    };
  }

  const git = {
    root: gitRoot,
    branch: await tryExecAndTrim('git', ['rev-parse', '--abbrev-ref', 'HEAD'], gitRoot),
    commit: await tryExecAndTrim('git', ['rev-parse', 'HEAD'], gitRoot),
    remote: await tryExecAndTrim('git', ['remote', 'get-url', 'origin'], gitRoot),
  };

  const derivedRepository = parseGitHubRepository(git.remote);
  if (github) {
    github = {
      ...github,
      repository: github.repository ?? derivedRepository,
      sha: github.sha ?? git.commit,
    };
  } else if (derivedRepository) {
    github = {
      actions: false,
      repository: derivedRepository,
      ref: null,
      sha: git.commit,
      runId: null,
      runNumber: null,
    };
  }

  return { github, git };
}

function parseGitHubRepository(remoteUrl) {
  if (!remoteUrl) {
    return null;
  }

  const trimmed = String(remoteUrl).trim();
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i,
    /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function tryExecAndTrim(command, args, cwd) {
  try {
    return await execAndTrim(command, args, cwd);
  } catch {
    return null;
  }
}

async function execAndTrim(command, args, cwd) {
  const { stdout } = await execFileAsync(command, args, {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
  });

  return stdout.trim();
}

async function buildPlan(options) {
  const sourceFiles = listFiles(options.sourceDir);
  const dataFiles = options.dataDir ? listFiles(options.dataDir) : [];
  const existingCatalog = await readRemoteJsonIfExists(options.dataBucket, '_catalog/sites.json', []);
  const existingEntry = existingCatalog.find((entry) => entry.siteId === options.siteId) ?? null;
  const publishedAt = new Date().toISOString();

  const metadata = {
    siteId: options.siteId,
    host: options.host,
    publishedAt,
    target: {
      region: TARGET_REGION,
      hostingBucket: options.hostingBucket,
      dataBucket: options.dataBucket,
      hostedPrefix: `${options.siteId}/`,
      dataPrefix: `${options.siteId}/${options.dataPrefix}/`,
    },
    source: {
      sourceDir: options.sourceDir,
      dataDir: options.dataDir,
      deleteHosting: options.deleteHosting,
      deleteData: options.deleteData,
      exclude: options.exclude,
      dataExclude: options.dataExclude,
      cacheControlRules: options.cacheControlRules,
    },
    tags: options.tags,
    notes: options.notes,
    publishContext: options.publishContext,
    counts: {
      hostingFiles: sourceFiles.length,
      hostingBytes: sumBytes(sourceFiles),
      dataFiles: dataFiles.length,
      dataBytes: sumBytes(dataFiles),
    },
  };

  return {
    ...options,
    publishedAt,
    existingEntry,
    sourceFiles,
    dataFiles,
    metadata,
  };
}

function listFiles(rootDir) {
  const files = [];
  walk(rootDir, rootDir, files);
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return files;
}

function walk(rootDir, currentDir, files) {
  const entries = readdirSync(currentDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      walk(rootDir, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = statSync(absolutePath);
    files.push({
      absolutePath,
      relativePath: normalizePlanningPath(path.relative(rootDir, absolutePath)),
      size: stats.size,
    });
  }
}

async function applyPlan(plan) {
  await syncDirectory(
    plan.sourceDir,
    `s3://${plan.hostingBucket}/${plan.siteId}/`,
    plan.deleteHosting,
    plan.exclude,
    plan.cacheControlRules
  );

  if (plan.dataDir) {
    await syncDirectory(
      plan.dataDir,
      `s3://${plan.dataBucket}/${plan.siteId}/${plan.dataPrefix}/`,
      plan.deleteData,
      plan.dataExclude,
      []
    );
  }

  await putRemoteJson(plan.dataBucket, `${plan.siteId}/site.json`, plan.metadata);
  await putRemoteJson(plan.hostingBucket, `${plan.siteId}/.publish.json`, {
    siteId: plan.siteId,
    host: plan.host,
    publishedAt: plan.publishedAt,
    sourceDir: plan.sourceDir,
    counts: plan.metadata.counts,
  });

  const catalogEntries = await readRemoteJsonIfExists(plan.dataBucket, '_catalog/sites.json', []);
  const mergedCatalog = upsertCatalogEntry(catalogEntries, plan);
  await putRemoteJson(plan.dataBucket, '_catalog/sites.json', mergedCatalog);
  await putRemoteJson(
    plan.dataBucket,
    '_catalog/summary.json',
    buildCatalogSummary(mergedCatalog, plan.publishedAt, plan.siteId, plan.hostingBucket, plan.dataBucket, plan.archiveBucket)
  );

  // Invalidate CloudFront cache if configured
  if (plan.cloudfront) {
    await invalidateCloudFront(plan.cloudfront);
  }
}

async function syncDirectory(sourceDir, targetUri, deleteExtraneous, excludePatterns, cacheControlRules) {
  const args = ['s3', 'sync', `${sourceDir}/`, targetUri, '--only-show-errors'];
  if (deleteExtraneous) {
    args.push('--delete');
  }

  for (const pattern of excludePatterns ?? []) {
    args.push('--exclude', pattern);
  }

  await aws(args);

  if (deleteExtraneous && (excludePatterns ?? []).length > 0) {
    await pruneExcludedTargets(targetUri, excludePatterns);
  }

  if ((cacheControlRules ?? []).length > 0) {
    await applyCacheControlRules(sourceDir, targetUri, excludePatterns, cacheControlRules);
  }
}

async function pruneExcludedTargets(targetUri, excludePatterns) {
  for (const pattern of new Set(excludePatterns ?? [])) {
    await aws([
      's3',
      'rm',
      targetUri,
      '--recursive',
      '--only-show-errors',
      '--exclude',
      '*',
      '--include',
      pattern,
    ]);
  }
}

async function applyCacheControlRules(sourceDir, targetUri, excludePatterns, rules) {
  for (const rule of rules) {
    const includePattern = rule.pattern === 'default' || rule.pattern === '*' || rule.pattern === 'all'
      ? '*'
      : rule.pattern;
    const args = [
      's3',
      'cp',
      `${sourceDir}/`,
      targetUri,
      '--recursive',
      '--only-show-errors',
      '--exclude',
      '*',
      '--include',
      includePattern,
    ];

    for (const pattern of excludePatterns ?? []) {
      args.push('--exclude', pattern);
    }

    args.push('--cache-control', rule.cacheControl);
    await aws(args);
  }
}

function upsertCatalogEntry(entries, plan) {
  const entry = {
    ...(plan.existingEntry ?? {}),
    siteId: plan.siteId,
    host: plan.host,
    currentHostedSite: plan.existingEntry?.currentHostedSite ?? false,
    hasHostedSite: true,
    hasData: Boolean(plan.dataDir) || Boolean(plan.existingEntry?.hasData),
    dataNamespace: Boolean(plan.dataDir) || Boolean(plan.existingEntry?.hasData) ? plan.siteId : null,
    syntheticIndex: false,
    tags: Array.from(new Set([...(plan.existingEntry?.tags ?? []), ...plan.tags])),
    notes: Array.from(new Set([...(plan.existingEntry?.notes ?? []), ...plan.notes])),
    managedBy: 'publish-site',
    lastPublishedAt: plan.publishedAt,
    publishContext: plan.publishContext,
  };

  const withoutCurrent = entries.filter((candidate) => candidate.siteId !== plan.siteId);
  return [...withoutCurrent, entry].sort((left, right) => left.siteId.localeCompare(right.siteId));
}

function buildCatalogSummary(entries, publishedAt, siteId, hostingBucket, dataBucket, archiveBucket) {
  const hostedCount = entries.filter((entry) => entry.hasHostedSite).length;
  const dataCount = entries.filter((entry) => entry.hasData).length;
  const syntheticCount = entries.filter((entry) => entry.syntheticIndex).length;
  const frameworkEntries = entries.filter((entry) => isFrameworkSite(entry));

  return {
    generatedAt: publishedAt,
    updatedAt: publishedAt,
    hostedBucket: hostingBucket,
    dataBucket: dataBucket,
    archiveBucket: archiveBucket,
    stats: {
      catalogSiteCount: entries.length,
      hostedSiteCount: hostedCount,
      dataNamespaceCount: dataCount,
      syntheticSiteCount: syntheticCount,
    },
    frameworkSiteCount: frameworkEntries.length,
    frameworkBuckets: countBy(frameworkEntries, (entry) => entry.frameworkBucket || 'unbucketed'),
    frameworkCriticality: countBy(frameworkEntries, (entry) => entry.criticality || 'unspecified'),
    frameworkTestStatuses: countBy(frameworkEntries, (entry) => entry.testStatus || 'unknown'),
    frameworkHealthStatuses: countBy(frameworkEntries, (entry) => entry.healthStatus || 'unknown'),
    lastPublishedSite: siteId,
    visibleHostedSites: entries.filter((entry) => entry.siteId !== '_root' && entry.hasHostedSite).length,
  };
}

function isFrameworkSite(entry) {
  return entry.frameworkSite === true || (entry.tags ?? []).includes('framework');
}

function countBy(entries, pickKey) {
  return entries.reduce((accumulator, entry) => {
    const key = pickKey(entry);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

async function readRemoteJsonIfExists(bucket, key, fallbackValue) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'site-publish-read-'));
  const tempFile = path.join(tempDir, 'payload.json');

  try {
    await execFileAsync('aws', ['s3', 'cp', `s3://${bucket}/${key}`, tempFile, '--only-show-errors'], {
      maxBuffer: 16 * 1024 * 1024,
    });
    return JSON.parse(readFileSync(tempFile, 'utf8'));
  } catch {
    return fallbackValue;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function putRemoteJson(bucket, key, payload) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'site-publish-write-'));
  const tempFile = path.join(tempDir, 'payload.json');

  try {
    writeFileSync(tempFile, `${JSON.stringify(payload, null, 2)}\n`);
    await aws([
      's3api',
      'put-object',
      '--bucket',
      bucket,
      '--key',
      key,
      '--body',
      tempFile,
      '--content-type',
      'application/json; charset=utf-8',
      '--cache-control',
      'no-cache',
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function aws(args) {
  await execFileAsync('aws', args, {
    maxBuffer: 128 * 1024 * 1024,
  });
}

async function invalidateCloudFront(cloudfront) {
  const args = [
    'cloudfront',
    'create-invalidation',
    '--distribution-id',
    cloudfront.distributionId,
    '--paths',
    ...cloudfront.paths,
  ];

  try {
    await aws(args);
  } catch (error) {
    console.warn(`Warning: CloudFront invalidation failed: ${error.message}`);
  }
}

function printPlan(plan) {
  console.log(`Publish plan ready.`);
  console.log(`Base URL: ${plan.baseUrl}`);
  console.log(`Site: ${plan.siteId}`);
  console.log(`Host: https://${plan.host}/`);
  console.log(`Source: ${plan.sourceDir}`);
  console.log(`Hosting files: ${plan.sourceFiles.length} (${formatBytes(sumBytes(plan.sourceFiles))})`);
  console.log(`Hosting target: s3://${plan.hostingBucket}/${plan.siteId}/`);
  console.log(`Delete stale hosted files: ${plan.deleteHosting ? 'yes' : 'no'}`);
  if (plan.exclude.length > 0) {
    console.log(`Hosting excludes: ${plan.exclude.join(', ')}`);
  }

  if (plan.dataDir) {
    console.log(`Data source: ${plan.dataDir}`);
    console.log(`Data files: ${plan.dataFiles.length} (${formatBytes(sumBytes(plan.dataFiles))})`);
    console.log(`Data target: s3://${plan.dataBucket}/${plan.siteId}/${plan.dataPrefix}/`);
    console.log(`Delete stale data files: ${plan.deleteData ? 'yes' : 'no'}`);
    if (plan.dataExclude.length > 0) {
      console.log(`Data excludes: ${plan.dataExclude.join(', ')}`);
    }
  } else {
    console.log(`Data source: none`);
  }

  if (plan.tags.length > 0) {
    console.log(`Tags: ${plan.tags.join(', ')}`);
  }

  if (plan.notes.length > 0) {
    console.log(`Notes: ${plan.notes.join(' | ')}`);
  }

  if (plan.cacheControlRules.length > 0) {
    console.log(`Cache rules: ${plan.cacheControlRules.map((rule) => `${rule.pattern} => ${rule.cacheControl}`).join(' | ')}`);
  }

  if (plan.existingEntry) {
    console.log(`Catalog: existing entry will be updated`);
  } else {
    console.log(`Catalog: new entry will be created`);
  }

  if (plan.cloudfront) {
    console.log(`CloudFront: invalidation enabled for ${plan.cloudfront.distributionId}`);
    console.log(`CloudFront paths: ${plan.cloudfront.paths.join(', ')}`);
  }
}

function printApplySummary(plan) {
  console.log(`Publish complete.`);
  console.log(`Live URL: https://${plan.host}/`);
  console.log(`Hosted prefix: s3://${plan.hostingBucket}/${plan.siteId}/`);
  console.log(`Site metadata: s3://${plan.dataBucket}/${plan.siteId}/site.json`);
  if (plan.dataDir) {
    console.log(`Data prefix: s3://${plan.dataBucket}/${plan.siteId}/${plan.dataPrefix}/`);
  }
  if (plan.cacheControlRules.length > 0) {
    console.log(`Cache metadata refreshed for: ${plan.cacheControlRules.map((rule) => rule.pattern).join(', ')}`);
  }
  console.log(`Catalog updated: s3://${plan.dataBucket}/_catalog/sites.json`);
  if (plan.cloudfront) {
    console.log(`CloudFront cache invalidated for distribution: ${plan.cloudfront.distributionId}`);
    console.log(`Invalidation paths: ${plan.cloudfront.paths.join(', ')}`);
    console.log(`Note: Cache propagation takes 30-60 seconds`);
  }
}

function normalizeSiteId(value) {
  if (!value) {
    return '';
  }

  return normalizePlanningPath(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveSiteId(value) {
  if (value === '_root') {
    return '_root';
  }

  return normalizeSiteId(value);
}

function normalizePlanningPath(value) {
  return value.replaceAll('\\', '/');
}

function sumBytes(files) {
  return files.reduce((sum, file) => sum + file.size, 0);
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

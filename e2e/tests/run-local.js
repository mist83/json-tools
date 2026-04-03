#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNNER = path.join(__dirname, 'run.js');
const PROJECT = path.join('src', 'JsonUtilitiesDemo', 'JsonUtilitiesDemo.csproj');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5968';
const HEALTH_URL = new URL('/api/health', BASE_URL).toString();
const HOST_ARGS = ['run', '--no-build', '--project', PROJECT, '--urls', BASE_URL];
const BUILD_ARGS = ['build', PROJECT, '-v', 'minimal'];
const SERVER_READY_TIMEOUT_MS = Number.parseInt(process.env.SERVER_READY_TIMEOUT_MS || '120000', 10);
const SERVER_READY_POLL_MS = Number.parseInt(process.env.SERVER_READY_POLL_MS || '1000', 10);

async function main() {
    await runCommand('dotnet', BUILD_ARGS, { cwd: ROOT });

    const host = spawn('dotnet', HOST_ARGS, {
        cwd: ROOT,
        env: process.env,
        stdio: ['ignore', 'inherit', 'inherit']
    });

    try {
        await waitForServer(HEALTH_URL, SERVER_READY_TIMEOUT_MS, SERVER_READY_POLL_MS, host);
        await runCommand(process.execPath, [RUNNER], {
            cwd: ROOT,
            env: { ...process.env, BASE_URL }
        });
    } finally {
        await stopProcess(host);
    }
}

function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env || process.env,
            stdio: 'inherit'
        });

        child.on('error', reject);
        child.on('exit', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} ${args.join(' ')} exited with ${signal || code}`));
        });
    });
}

function waitForServer(url, timeoutMs, pollMs, child) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const poll = () => {
            if (child && (child.exitCode !== null || child.signalCode !== null)) {
                reject(new Error(`Local demo host exited before ${url} became ready`));
                return;
            }

            requestOk(url)
                .then((ok) => {
                    if (ok) {
                        resolve();
                        return;
                    }

                    if (Date.now() >= deadline) {
                        reject(new Error(`Timed out waiting for ${url}`));
                        return;
                    }

                    setTimeout(poll, pollMs);
                })
                .catch((error) => {
                    if (Date.now() >= deadline) {
                        reject(new Error(`Timed out waiting for ${url}: ${error.message}`));
                        return;
                    }

                    setTimeout(poll, pollMs);
                });
        };

        poll();
    });
}

function requestOk(url) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            response.resume();
            resolve(response.statusCode >= 200 && response.statusCode < 400);
        });

        request.on('error', () => resolve(false));
    });
}

async function stopProcess(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        return;
    }

    child.kill('SIGTERM');
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});

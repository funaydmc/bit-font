/**
 * @file src/dev/server.js
 * Development server for live font preview.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { Worker } = require('worker_threads');
const chokidar = require('chokidar');
const CONFIG = require('../config');
const logger = require('../utils/logger');
const {
    VARIANTS,
    getFontFileName,
    getVariantById,
    normalizeCustomText
} = require('../core/build-service');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const WORKER_PATH = path.join(__dirname, 'build-worker.js');
const WATCH_DIRS = [CONFIG.paths.src];
const WATCH_EXTENSIONS = new Set(['.js', '.json', '.png']);
const WATCH_DEBOUNCE_MS = 500;

const clients = new Set();
const selectedVariantIds = new Set(['custom-normal']);
let customText = 'Xin chào Việt Nam';
const variantState = new Map(VARIANTS.map((variant) => [
    variant.id,
    {
        status: 'idle',
        fileName: getFontFileName(variant.charset, variant.type),
        durationMs: null,
        builtAt: null,
        error: null,
        customCharCount: null
    }
]));

let buildWorker = null;
let activeBuild = null;
let nextJobId = 1;
let rebuildTimer = null;
let lastChange = null;

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

function sendError(res, statusCode, message) {
    sendJson(res, statusCode, { error: message });
}

function setsEqual(left, right) {
    if (left.size !== right.size) {
        return false;
    }

    for (const value of left) {
        if (!right.has(value)) {
            return false;
        }
    }

    return true;
}

function hasSelectedCustomVariant() {
    return Array.from(selectedVariantIds).some((variantId) => variantId.startsWith('custom-'));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
        });

        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
    });
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.woff2': 'font/woff2'
    };

    return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(res, filePath, cacheControl = 'no-store') {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            sendError(res, error.code === 'ENOENT' ? 404 : 500, 'File not found');
            return;
        }

        res.writeHead(200, {
            'Content-Type': getMimeType(filePath),
            'Cache-Control': cacheControl
        });
        res.end(data);
    });
}

function resolvePublicPath(urlPath) {
    const relativePath = urlPath === '/' ? 'index.html' : urlPath.slice(1);
    const requestedPath = path.resolve(PUBLIC_DIR, relativePath);

    if (requestedPath !== PUBLIC_DIR && !requestedPath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
        return null;
    }

    return requestedPath;
}

function getState() {
    const normalizedCustomText = normalizeCustomText(customText);

    return {
        variants: VARIANTS.map((variant) => {
            const state = variantState.get(variant.id);
            const version = state.builtAt ? new Date(state.builtAt).getTime() : Date.now();

            return {
                ...variant,
                selected: selectedVariantIds.has(variant.id),
                status: state.status,
                fileName: state.fileName,
                url: `/fonts/${state.fileName}?v=${version}`,
                durationMs: state.durationMs,
                builtAt: state.builtAt,
                error: state.error,
                customCharCount: state.customCharCount
            };
        }),
        customText,
        normalizedCustomText,
        customCharCount: Array.from(normalizedCustomText).length,
        lastChange
    };
}

function broadcast(event, payload) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const res of clients) {
        res.write(frame);
    }
}

function markSelected(status, error = null) {
    for (const variantId of selectedVariantIds) {
        const state = variantState.get(variantId);
        state.status = status;
        state.error = error;
    }
}

function ensureWorker() {
    if (buildWorker) {
        return buildWorker;
    }

    buildWorker = new Worker(WORKER_PATH);

    buildWorker.on('message', (message) => {
        if (!activeBuild || message.jobId !== activeBuild.jobId) {
            return;
        }

        if (message.type === 'result') {
            const builtAt = new Date().toISOString();
            const state = variantState.get(message.result.id);
            state.status = 'ready';
            state.fileName = message.result.fileName;
            state.durationMs = message.result.durationMs;
            state.builtAt = builtAt;
            state.error = null;
            state.customCharCount = message.result.customCharCount;
            broadcast('state', getState());
            return;
        }

        if (message.type === 'variant-error') {
            const state = variantState.get(message.variantId);
            state.status = 'error';
            state.error = message.error;
            state.customCharCount = null;
            broadcast('state', getState());
            return;
        }

        if (message.type === 'done') {
            logger.success(`Dev rebuild complete (${activeBuild.reason}): ${activeBuild.ids.join(', ') || 'none'}`);
            activeBuild = null;
            broadcast('state', getState());
        }
    });

    buildWorker.on('error', (error) => {
        logger.error('Build worker failed:', error);
        if (activeBuild) {
            for (const variantId of activeBuild.ids) {
                const state = variantState.get(variantId);
                state.status = 'error';
                state.error = error.message;
            }
            activeBuild = null;
            broadcast('state', getState());
        }
    });

    buildWorker.on('exit', (code) => {
        buildWorker = null;
        if (code !== 0 && activeBuild) {
            logger.error(`Build worker exited with code ${code}`);
        }
    });

    return buildWorker;
}

async function terminateWorker() {
    if (!buildWorker) {
        return;
    }

    const worker = buildWorker;
    buildWorker = null;
    await worker.terminate();
}

function resetUnselectedBuildingStates() {
    for (const [variantId, state] of variantState.entries()) {
        if (!selectedVariantIds.has(variantId) && state.status === 'building') {
            state.status = 'idle';
            state.error = null;
        }
    }
}

async function startBuild(reason, options = {}) {
    const ids = Array.from(selectedVariantIds);

    if (options.interrupt && activeBuild) {
        logger.warn(`Interrupting build (${activeBuild.reason}) for ${reason}`);
        activeBuild = null;
        await terminateWorker();
    }

    resetUnselectedBuildingStates();

    if (ids.length === 0) {
        broadcast('state', getState());
        return;
    }

    if (options.invalidate) {
        if (activeBuild) {
            activeBuild = null;
            await terminateWorker();
        } else if (buildWorker) {
            buildWorker.postMessage({ type: 'invalidate', scope: options.invalidate });
        }
    }

    markSelected('building');
    broadcast('state', getState());

    const jobId = nextJobId++;
    activeBuild = { jobId, ids, reason };

    ensureWorker().postMessage({
        type: 'build',
        jobId,
        variantIds: ids,
        customText
    });
}

function scheduleRebuild(filePath) {
    if (!WATCH_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        return;
    }

    lastChange = path.relative(CONFIG.paths.root, filePath);

    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
        startBuild(`changed ${lastChange}`, { interrupt: true, invalidate: 'all' });
    }, WATCH_DEBOUNCE_MS);
}

async function handleApi(req, res, pathname) {
    if (req.method === 'GET' && pathname === '/api/state') {
        sendJson(res, 200, getState());
        return;
    }

    if (req.method === 'POST' && pathname === '/api/selection') {
        try {
            const body = await readBody(req);
            const nextSelected = Array.isArray(body.selected) ? body.selected : [];
            const invalidIds = nextSelected.filter((variantId) => !getVariantById(variantId));

            if (invalidIds.length > 0) {
                sendError(res, 400, `Unknown variants: ${invalidIds.join(', ')}`);
                return;
            }

            const nextSelectedIds = new Set(nextSelected);
            const selectionChanged = !setsEqual(selectedVariantIds, nextSelectedIds);
            let customChanged = false;

            if (typeof body.customText === 'string') {
                const nextCustomText = body.customText;
                if (normalizeCustomText(nextCustomText) !== normalizeCustomText(customText)) {
                    customChanged = true;
                }
                customText = nextCustomText;
            }

            selectedVariantIds.clear();
            nextSelectedIds.forEach((variantId) => selectedVariantIds.add(variantId));

            sendJson(res, 200, getState());
            if (selectionChanged || (customChanged && hasSelectedCustomVariant())) {
                await startBuild('selection update', {
                    interrupt: true,
                    invalidate: customChanged ? 'custom' : null
                });
            } else if (customChanged) {
                broadcast('state', getState());
            }
        } catch (error) {
            sendError(res, 400, error.message);
        }
        return;
    }

    if (req.method === 'POST' && pathname === '/api/rebuild') {
        try {
            const body = await readBody(req);
            let customChanged = false;
            if (typeof body.customText === 'string') {
                if (normalizeCustomText(body.customText) !== normalizeCustomText(customText)) {
                    customChanged = true;
                }
                customText = body.customText;
            }
        } catch (error) {
            sendError(res, 400, error.message);
            return;
        }

        sendJson(res, 202, getState());
        await startBuild('manual rebuild', {
            interrupt: true,
            invalidate: customChanged ? 'custom' : null
        });
        return;
    }

    sendError(res, 404, 'API route not found');
}

function handleEvents(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive'
    });

    clients.add(res);
    res.write(`event: state\ndata: ${JSON.stringify(getState())}\n\n`);

    req.on('close', () => {
        clients.delete(res);
    });
}

function handleFonts(res, pathname) {
    const fileName = decodeURIComponent(pathname.replace('/fonts/', ''));
    const filePath = path.resolve(CONFIG.paths.dist, fileName);

    if (filePath !== CONFIG.paths.dist && !filePath.startsWith(`${CONFIG.paths.dist}${path.sep}`)) {
        sendError(res, 403, 'Invalid font path');
        return;
    }

    serveFile(res, filePath, 'no-store');
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/events') {
        handleEvents(req, res);
        return;
    }

    if (url.pathname.startsWith('/api/')) {
        handleApi(req, res, url.pathname).catch((error) => {
            sendError(res, 500, error.message);
        });
        return;
    }

    if (url.pathname.startsWith('/fonts/')) {
        handleFonts(res, url.pathname);
        return;
    }

    const filePath = resolvePublicPath(url.pathname);
    if (!filePath) {
        sendError(res, 403, 'Invalid public path');
        return;
    }

    serveFile(res, filePath);
});

const watcher = chokidar.watch(WATCH_DIRS, {
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50
    }
});

watcher.on('change', scheduleRebuild);
watcher.on('add', scheduleRebuild);
watcher.on('unlink', scheduleRebuild);

server.listen(PORT, HOST, () => {
    logger.info(`Dev server: http://${HOST}:${PORT}`);
    setTimeout(() => startBuild('startup'), 500);
});

process.on('SIGINT', async () => {
    logger.info('Stopping dev server...');
    await watcher.close();
    server.close(() => process.exit(0));
});

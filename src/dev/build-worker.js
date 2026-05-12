/**
 * @file src/dev/build-worker.js
 * Worker thread that runs expensive font builds outside the HTTP server thread.
 */

const { parentPort } = require('worker_threads');
const { FontBuildService } = require('../core/build-service');

const buildService = new FontBuildService();

parentPort.on('message', async (message) => {
    if (message.type === 'invalidate') {
        if (message.scope === 'custom') {
            buildService.invalidateCustom();
        } else {
            buildService.invalidate();
        }
        return;
    }

    if (message.type !== 'build') {
        return;
    }

    const { jobId, variantIds, customText } = message;

    for (const variantId of variantIds) {
        try {
            const result = await buildService.buildVariant(variantId, { customText });
            parentPort.postMessage({ type: 'result', jobId, result });
        } catch (error) {
            parentPort.postMessage({
                type: 'variant-error',
                jobId,
                variantId,
                error: error.message
            });
        }
    }

    parentPort.postMessage({ type: 'done', jobId });
});

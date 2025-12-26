/**
 * @file src/build.js
 * Main entry point for the font build process.
 * Orchestrates loading, generation, building, and subsetting.
 */

const path = require('path');
const fs = require('fs');
const CONFIG = require('./config');
const logger = require('./utils/logger');

// Core Modules
const FontLoader = require('./core/font-loader');
const SvgGenerator = require('./core/svg-generator');
const FontBuilder = require('./core/font-builder');
const Subsetter = require('./core/subsetter');

async function buildVariant(charDataList, isBold) {
    const variantName = isBold ? 'BOLD' : 'REGULAR';
    const fileName = isBold ? 'MinecraftFont-Bold.woff2' : 'MinecraftFont.woff2';
    const outputPath = path.join(CONFIG.paths.dist, fileName);
    const tempTtfPath = outputPath.replace('.woff2', '.ttf');

    logger.info(`[${variantName}] Generating font data...`);

    // 1. Generate SVG
    const svgContent = SvgGenerator.generate(charDataList, isBold);

    // 2. Create Font Object
    const fontObj = FontBuilder.createFont(svgContent);
    FontBuilder.setMetadata(fontObj, isBold);

    // 3. Write WOFF2
    FontBuilder.writeWOFF2(fontObj, outputPath);

    // 4. Create Subsets (Requires TTF)
    // We generate a temp TTF, create subsets, then delete it.
    FontBuilder.writeTTF(fontObj, tempTtfPath);

    try {
        await Subsetter.createSubsets(tempTtfPath, path.dirname(outputPath));
    } finally {
        if (fs.existsSync(tempTtfPath)) {
            fs.unlinkSync(tempTtfPath);
            logger.info(`[${variantName}] Cleaned up temp TTF.`);
        }
    }
}

async function main() {
    logger.info('--- STARTING BUILD PROCESS ---');

    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.paths.dist)) {
        fs.mkdirSync(CONFIG.paths.dist, { recursive: true });
    }

    try {
        // Initialize dependencies
        await FontBuilder.init();

        // 1. Load Data
        const charDataList = await FontLoader.loadAll();
        if (!charDataList || charDataList.length === 0) {
            throw new Error('No character data loaded.');
        }

        // Apply Limits if configured
        if (CONFIG.limit && charDataList.length > CONFIG.limit) {
            logger.warn(`Limit applied: ${CONFIG.limit} chars.`);
            // Note: Array is already sorted by FontLoader
            charDataList.length = CONFIG.limit;
        }

        // 2. Build Variants in Parallel
        logger.info('Starting parallel builds...');
        await Promise.all([
            buildVariant(charDataList, false),
            buildVariant(charDataList, true)
        ]);

        logger.info('--- BUILD COMPLETE ---');

    } catch (error) {
        logger.error('Build failed:', error);
        process.exit(1);
    }
}

main();

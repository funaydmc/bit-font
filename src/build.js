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

/**
 * Generate SVG content for a variant.
 * Safe to run in parallel as it's pure JS CPU work.
 */
async function generateSvgTask(charDataList, isBold) {
    const variantName = isBold ? 'BOLD' : 'REGULAR';
    logger.info(`[${variantName}] Generating SVG path data...`);
    const start = Date.now();
    
    // CPU intensive task
    const svgContent = SvgGenerator.generate(charDataList, isBold);
    
    logger.info(`[${variantName}] SVG generated in ${(Date.now() - start) / 1000}s`);
    return { svgContent, isBold };
}

/**
 * Build font from SVG and create subsets.
 * MUST run sequentially due to WASM constraints in fonteditor-core.
 */
async function buildFontTask({ svgContent, isBold }) {
    const variantName = isBold ? 'BOLD' : 'REGULAR';
    const fileName = isBold ? 'MinecraftFont-Bold.woff2' : 'MinecraftFont.woff2';
    const outputPath = path.join(CONFIG.paths.dist, fileName);
    const tempTtfPath = outputPath.replace('.woff2', '.ttf');

    logger.info(`[${variantName}] Building font file (WASM)...`);

    // 1. Create Font Object
    // This parses the SVG string. It's heavy but must be sequential.
    const fontObj = FontBuilder.createFont(svgContent);
    FontBuilder.setMetadata(fontObj, isBold);

    // 2. Write WOFF2
    FontBuilder.writeWOFF2(fontObj, outputPath);

    // 3. Create Subsets (Requires TTF)
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
    const totalStart = Date.now();

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
            charDataList.length = CONFIG.limit;
        }

        // 2. Generate SVGs in PARALLEL (CPU bound)
        logger.info('Starting parallel SVG generation...');
        const svgResults = await Promise.all([
            generateSvgTask(charDataList, false),
            generateSvgTask(charDataList, true)
        ]);

        // 3. Build Fonts SEQUENTIALLY (WASM bound)
        logger.info('Starting sequential font building...');
        for (const result of svgResults) {
            await buildFontTask(result);
        }

        const duration = (Date.now() - totalStart) / 1000;
        logger.info(`--- BUILD COMPLETE in ${duration}s ---`);

    } catch (error) {
        logger.error('Build failed:', error);
        process.exit(1);
    }
}

main();
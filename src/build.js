/**
 * @file src/build.js
 * Main entry point for the font build process.
 * Orchestrates loading, generation, and building with charset filtering.
 * 
 * Usage: node build.js [--charset=full|vi] [--type=normal|bold]
 * Examples:
 *   node build.js --charset=vi --type=normal
 *   node build.js --charset=full --type=bold
 *   node build.js  // defaults: charset=full, type=normal
 */

const path = require('path');
const fs = require('fs');
const CONFIG = require('./config');
const logger = require('./utils/logger');

// Core Modules
const FontLoader = require('./core/font-loader');
const SvgGenerator = require('./core/svg-generator');
const FontBuilder = require('./core/font-builder');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        charset: 'full', // default
        type: 'normal'  // default
    };

    // Check for help
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    args.forEach(arg => {
        if (arg.startsWith('--charset=')) {
            const charset = arg.split('=')[1];
            if (['full', 'vi'].includes(charset)) {
                options.charset = charset;
            } else {
                logger.error(`Invalid charset: ${charset}. Valid options: full, vi`);
                showHelp();
                process.exit(1);
            }
        } else if (arg.startsWith('--type=')) {
            const type = arg.split('=')[1];
            if (['normal', 'bold'].includes(type)) {
                options.type = type;
            } else {
                logger.error(`Invalid type: ${type}. Valid options: normal, bold`);
                showHelp();
                process.exit(1);
            }
        } else if (arg.startsWith('-')) {
            logger.error(`Unknown option: ${arg}`);
            showHelp();
            process.exit(1);
        }
    });

    return options;
}

/**
 * Show available build tasks
 */
function showBuildTasks() {
    console.log(`
Available build tasks:
  npm run build:vi-normal   - Vietnamese charset, normal weight
  npm run build:vi-bold     - Vietnamese charset, bold weight
  npm run build:full-normal - Full charset, normal weight
  npm run build:full-bold   - Full charset, bold weight
  npm run build:all         - All variants

Use --help for more info: node src/build.js --help
`);
}

/**
 * Show help information
 */
function showHelp() {
    console.log(`
Bit Font Builder

Usage: node src/build.js [options]

Options:
  --charset=<value>    Charset to use (default: full)
                       full: Include all available characters
                       vi:   Vietnamese character subset only

  --type=<value>       Font type to build (default: normal)
                       normal: Regular font weight
                       bold:   Bold font weight

  --help, -h           Show this help message

Examples:
  node src/build.js                              # Build full chars, normal weight
  node src/build.js --charset=vi                 # Vietnamese chars, normal weight
  node src/build.js --type=bold                  # Full chars, bold weight
  node src/build.js --charset=vi --type=bold     # Vietnamese chars, bold weight

NPM Scripts:
  npm run build:vi-normal          # Vietnamese charset, normal weight
  npm run build:vi-bold            # Vietnamese charset, bold weight
  npm run build:full-normal        # Full charset, normal weight
  npm run build:full-bold          # Full charset, bold weight
  npm run build:all                # All variants
`);
}

/**
 * Parse command line arguments
 * @returns {{charset: string, type: string}} Parsed options
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        charset: 'full', // default
        type: 'normal'  // default
    };

    // Check for help
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    args.forEach(arg => {
        if (arg.startsWith('--charset=')) {
            const charset = arg.split('=')[1];
            if (['full', 'vi'].includes(charset)) {
                options.charset = charset;
            } else {
                logger.error(`Invalid charset: ${charset}. Valid options: full, vi`);
                showHelp();
                process.exit(1);
            }
        } else if (arg.startsWith('--type=')) {
            const type = arg.split('=')[1];
            if (['normal', 'bold'].includes(type)) {
                options.type = type;
            } else {
                logger.error(`Invalid type: ${type}. Valid options: normal, bold`);
                showHelp();
                process.exit(1);
            }
        } else if (arg.startsWith('-')) {
            logger.error(`Unknown option: ${arg}`);
            showHelp();
            process.exit(1);
        }
    });

    return options;
}

/**
 * Generate SVG content for a variant.
 * Safe to run in parallel as it's pure JS CPU work.
 * @param {Array} charDataList - List of character data
 * @param {boolean} isBold - Whether to generate bold variant
 * @returns {Promise<{svgContent: string, isBold: boolean}>} Generated SVG data
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
 * Build font from SVG without subsetting.
 * MUST run sequentially due to WASM constraints in fonteditor-core.
 * @param {Object} params - Build parameters
 * @param {string} params.svgContent - SVG content
 * @param {boolean} params.isBold - Whether this is bold variant
 * @param {string} params.charset - Charset being built
 */
async function buildFontTask({ svgContent, isBold, charset }) {
    const variantName = isBold ? 'BOLD' : 'REGULAR';
    
    // Generate filename based on naming convention:
    // MinecraftFont_CHARSET_TYPE.woff2
    // - Skip _CHARSET if charset is 'full'
    // - Skip _TYPE if type is 'normal' (not bold)
    let fileName = 'MinecraftFont';
    
    if (charset !== 'full') {
        fileName += `_${charset.toUpperCase()}`;
    }
    
    if (isBold) {
        fileName += '_Bold';
    }
    
    fileName += '.woff2';
    
    const outputPath = path.join(CONFIG.paths.dist, fileName);

    logger.info(`[${variantName}] Building font file (WASM)...`);
    logger.info(`[${variantName}] Output: ${fileName}`);

    // 1. Create Font Object
    const fontObj = FontBuilder.createFont(svgContent);
    FontBuilder.setMetadata(fontObj, isBold);

    // 2. Write WOFF2 directly - no subsetting needed
    FontBuilder.writeWOFF2(fontObj, outputPath);

    logger.info(`[${variantName}] Font build complete.`);
}

async function main() {
    // Parse command line arguments
    const options = parseArgs();
    
    // If no arguments provided, show available build tasks
    if (process.argv.length === 2) {
        showBuildTasks();
        return;
    }
    
    logger.info('--- STARTING BUILD PROCESS ---');
    logger.info(`Charset: ${options.charset}`);
    logger.info(`Type: ${options.type}`);
    const totalStart = Date.now();

    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.paths.dist)) {
        fs.mkdirSync(CONFIG.paths.dist, { recursive: true });
    }

    try {
        // Initialize dependencies
        await FontBuilder.init();

        // Load Data with charset filtering
        const fontLoader = new FontLoader(options.charset);
        const charDataList = await fontLoader.loadAll();
        if (!charDataList || charDataList.length === 0) {
            throw new Error('No character data loaded.');
        }

        // Generate SVG based on type option
        logger.info('Starting SVG generation...');
        
        const isBold = options.type === 'bold';
        const svgResult = await generateSvgTask(charDataList, isBold);
        
        // Build Font
        logger.info('Starting font building...');
        await buildFontTask({ ...svgResult, charset: options.charset });

        const duration = (Date.now() - totalStart) / 1000;
        logger.info(`--- BUILD COMPLETE in ${duration}s ---`);

    } catch (error) {
        logger.error('Build failed:', error);
        process.exit(1);
    }
}

main();
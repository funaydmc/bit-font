/**
 * @file src/build.js
 * CLI entry point for the font build process.
 *
 * Usage: node src/build.js [--charset=full|vi] [--type=normal|bold]
 */

const logger = require('./utils/logger');
const { FontBuildService } = require('./core/build-service');

function showBuildTasks() {
    console.log(`
Available build tasks:
  pnpm run build:vi-normal   - Vietnamese charset, normal weight
  pnpm run build:vi-bold     - Vietnamese charset, bold weight
  pnpm run build:full-normal - Full charset, normal weight
  pnpm run build:full-bold   - Full charset, bold weight
  pnpm run build:all         - All variants

Use --help for more info: node src/build.js --help
`);
}

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

pnpm scripts:
  pnpm run build:vi-normal          # Vietnamese charset, normal weight
  pnpm run build:vi-bold            # Vietnamese charset, bold weight
  pnpm run build:full-normal        # Full charset, normal weight
  pnpm run build:full-bold          # Full charset, bold weight
  pnpm run build:all                # All variants
`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        charset: 'full',
        type: 'normal'
    };

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    args.forEach((arg) => {
        if (arg.startsWith('--charset=')) {
            const charset = arg.split('=')[1];
            if (['full', 'vi'].includes(charset)) {
                options.charset = charset;
                return;
            }

            logger.error(`Invalid charset: ${charset}. Valid options: full, vi`);
            showHelp();
            process.exit(1);
        }

        if (arg.startsWith('--type=')) {
            const type = arg.split('=')[1];
            if (['normal', 'bold'].includes(type)) {
                options.type = type;
                return;
            }

            logger.error(`Invalid type: ${type}. Valid options: normal, bold`);
            showHelp();
            process.exit(1);
        }

        if (arg.startsWith('-')) {
            logger.error(`Unknown option: ${arg}`);
            showHelp();
            process.exit(1);
        }
    });

    return options;
}

async function main() {
    if (process.argv.length === 2) {
        showBuildTasks();
        return;
    }

    const options = parseArgs();
    const variantId = `${options.charset}-${options.type}`;
    const totalStart = Date.now();

    logger.info('--- STARTING BUILD PROCESS ---');
    logger.info(`Charset: ${options.charset}`);
    logger.info(`Type: ${options.type}`);

    try {
        const buildService = new FontBuildService();
        await buildService.buildVariant(variantId);

        const duration = (Date.now() - totalStart) / 1000;
        logger.info(`--- BUILD COMPLETE in ${duration}s ---`);
    } catch (error) {
        logger.error('Build failed:', error);
        process.exit(1);
    }
}

main();

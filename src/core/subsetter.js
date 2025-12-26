/**
 * @module core/subsetter
 * Handles creating subset fonts (e.g., Vietnamese, ASCII).
 */

const fs = require('fs');
const path = require('path');
const Fontmin = require('fontmin');
const CONFIG = require('../config');
const logger = require('../utils/logger');

class Subsetter {
    /**
     * Create subsets for a given font file.
     * @param {string} sourceFontPath - Path to the source TTF file.
     * @param {string} outputDir - Directory to save subsets.
     * @returns {Promise<void>}
     */
    static async createSubsets(sourceFontPath, outputDir) {
        if (!fs.existsSync(sourceFontPath)) {
            logger.error(`Source font not found for subsetting: ${sourceFontPath}`);
            return;
        }

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        logger.info(`Starting subset generation for: ${path.basename(sourceFontPath)}`);

        const promises = Object.keys(CONFIG.subsets).map(mode => this.createSingleSubset(sourceFontPath, outputDir, mode));
        await Promise.all(promises);

        logger.success(`Subset generation complete.`);
    }

    /**
     * Create a single subset.
     * @param {string} sourcePath 
     * @param {string} outputDir 
     * @param {string} mode - Subset mode/key (e.g., 'vi').
     * @returns {Promise<string>} Path to the generated subset file.
     */
    static createSingleSubset(sourcePath, outputDir, mode) {
        return new Promise((resolve, reject) => {
            const fontmin = new Fontmin()
                .src(sourcePath)
                .use(Fontmin.glyph({
                    text: CONFIG.subsets[mode],
                    hinting: false
                }))
                .use(Fontmin.ttf2woff2());

            fontmin.run((err, files) => {
                if (err) {
                    logger.error(`Error creating subset ${mode}:`, err);
                    reject(err);
                    return;
                }

                const woff2File = files.find(f => path.extname(f.relative) === '.woff2');
                if (!woff2File) {
                    logger.error(`No WOFF2 output for subset ${mode}`);
                    reject(new Error('No output'));
                    return;
                }

                const baseName = path.basename(sourcePath, '.ttf');
                const finalName = `${baseName}_${mode.toUpperCase()}.woff2`;
                const finalPath = path.join(outputDir, finalName);

                try {
                    fs.writeFileSync(finalPath, woff2File.contents);
                    logger.success(`Generated subset: ${finalName}`);
                    resolve(finalPath);
                } catch (e) {
                    logger.error(`Error saving subset file ${mode}:`, e);
                    reject(e);
                }
            });
        });
    }
}

module.exports = Subsetter;

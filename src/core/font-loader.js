/**
 * @module core/font-loader
 * Handles loading of font data from JSON configuration and PNG textures.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const CONFIG = require('../config');
const BitmapProcessor = require('./bitmap-processor');
const processUnifont = require('./unifont');
const logger = require('../utils/logger');

class FontLoader {
    constructor() {
        this.charList = [];
        this.processedCodes = new Set();
    }

    /**
     * Main entry point to load all font data.
     * @returns {Promise<Array<Object>>} List of character data objects.
     */
    async loadAll() {
        logger.info('Starting font loading...');
        this.charList = [];
        this.processedCodes.clear();

        try {
            await this.processReference('minecraft:default');

            // Sort by Unicode
            this.charList.sort((a, b) => a.unicode.localeCompare(b.unicode));

            logger.success(`Loaded ${this.charList.length} characters.`);
            return this.charList;
        } catch (error) {
            logger.error('Error loading font data:', error);
            return [];
        }
    }

    /**
     * Process a reference ID (e.g., 'minecraft:default').
     * @param {string} id 
     */
    async processReference(id) {
        if (id === 'minecraft:include/unifont') {
            await processUnifont(this);
            return;
        }

        const filename = id.split(':')[1] + '.json';
        const filePath = path.join(CONFIG.paths.fontDir, filename);

        if (!fs.existsSync(filePath)) {
            logger.warn(`File not found: ${filePath} (ID: ${id})`);
            return;
        }

        await this.processFile(filePath);
    }

    /**
     * Process a specific JSON file.
     * @param {string} filePath 
     */
    async processFile(filePath) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (content.providers) {
            for (const provider of content.providers) {
                await this.processProvider(provider);
            }
        }
    }

    /**
     * Process a single provider object.
     * @param {Object} provider 
     */
    async processProvider(provider) {
        switch (provider.type) {
            case 'bitmap':
                await this.processBitmapProvider(provider);
                break;
            case 'space':
                this.processSpaceProvider(provider);
                break;
            case 'reference':
                await this.processReference(provider.id);
                break;
        }
    }

    /**
     * Process a bitmap provider.
     * @param {Object} provider 
     */
    async processBitmapProvider(provider) {
        const file = provider.file.replace('minecraft:font/', '');
        const imagePath = path.join(CONFIG.paths.textureDir, file);

        const image = await this.parsePng(imagePath);
        if (!image) {
            logger.warn(`Texture not found: ${imagePath}`);
            return;
        }

        const rows = provider.chars.length;
        const cols = provider.chars[0].length;
        const chunkWidth = Math.floor(image.width / cols);
        const chunkHeight = Math.floor(image.height / rows);
        const height = provider.height || CONFIG.fontHeight;
        const ascent = provider.ascent !== undefined ? provider.ascent : CONFIG.defaultAscent;

        for (let y = 0; y < rows; y++) {
            const rowChars = provider.chars[y];
            for (let x = 0; x < cols; x++) {
                const char = rowChars[x];
                if (char === '\u0000') continue;

                const charData = BitmapProcessor.extractBitmap(image, x * chunkWidth, y * chunkHeight, chunkWidth, chunkHeight);

                if (!charData.isEmpty) {
                    this.addChar({
                        unicode: char,
                        type: 'bitmap',
                        width: charData.width,
                        height: height,
                        ascent: ascent,
                        bitmap: charData.pixels,
                        xOffset: charData.xOffset
                    });
                }
            }
        }
    }

    /**
     * Process a space provider.
     * @param {Object} provider 
     */
    processSpaceProvider(provider) {
        for (const [char, advance] of Object.entries(provider.advances)) {
            this.addChar({
                unicode: char,
                type: 'space',
                width: advance
            });
        }
    }



    /**
     * Helper to parse PNG file.
     * @param {string} imagePath 
     * @returns {Promise<Object>}
     */
    parsePng(imagePath) {
        return new Promise((resolve) => {
            if (!fs.existsSync(imagePath)) {
                resolve(null);
                return;
            }
            fs.createReadStream(imagePath)
                .pipe(new PNG({ filterType: 4 }))
                .on('parsed', function () {
                    resolve({ width: this.width, height: this.height, data: this.data });
                })
                .on('error', (err) => {
                    logger.error(`Error parsing PNG ${imagePath}:`, err);
                    resolve(null);
                });
        });
    }

    /**
     * Add a character to the list if valid.
     * @param {Object} charData 
     */
    addChar(charData) {
        if (!charData.unicode || charData.unicode === '\u0000' || charData.unicode.codePointAt(0) === 0) return;

        if (charData.type === 'bitmap') {
            if (!charData.bitmap || charData.bitmap.length === 0) return;
            // Quick check for all-zero bitmap
            if (!charData.bitmap.some(row => row.includes(1))) return;
        }

        if (!this.processedCodes.has(charData.unicode)) {
            this.processedCodes.add(charData.unicode);
            this.charList.push(charData);
        }
    }
}

module.exports = new FontLoader(); // Export singleton instance

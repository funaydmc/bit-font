/**
 * @module core/unifont
 * Handles loading of Unifont data.
 */

const path = require('path');
const CONFIG = require('../config');
const BitmapProcessor = require('./bitmap-processor');

/**
 * Process Unifont provider.
 * @param {Object} loader - The FontLoader instance.
 */
async function processUnifont(loader) {
    for (let i = 0; i < 256; i++) {
        const page = i.toString(16).padStart(2, '0');
        const filename = `unicode_page_${page}.png`;
        const imagePath = path.join(CONFIG.paths.textureDir, filename);

        const image = await loader.parsePng(imagePath);
        if (image) {
            const tileWidth = 16;
            const tileHeight = 16;

            for (let cy = 0; cy < 16; cy++) {
                for (let cx = 0; cx < 16; cx++) {
                    const charCode = (i * 256) + (cy * 16) + cx;
                    const char = String.fromCharCode(charCode);

                    if (loader.processedCodes.has(char)) continue;

                    const charData = BitmapProcessor.extractBitmap(image, cx * tileWidth, cy * tileHeight, tileWidth, tileHeight);
                    if (!charData.isEmpty) {
                        loader.addChar({
                            unicode: char,
                            type: 'bitmap',
                            width: charData.width,
                            height: CONFIG.unifontHeight,
                            ascent: CONFIG.unifontAscent,
                            bitmap: charData.pixels,
                            xOffset: charData.xOffset
                        });
                    }
                }
            }
        }
    }
}

module.exports = processUnifont;

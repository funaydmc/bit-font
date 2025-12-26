/**
 * @module core/font-builder
 * Wraps fonteditor-core to create and save font files.
 */

const fs = require('fs');
const { Font, woff2 } = require('fonteditor-core');
const CONFIG = require('../config');
const logger = require('../utils/logger');

class FontBuilder {
    /**
     * Initialize dependencies (WOFF2).
     */
    static async init() {
        await woff2.init();
    }

    /**
     * Create a Font object from SVG content.
     * @param {string} svgContent 
     * @returns {BitFont.FontEditorFont} Font object.
     */
    static createFont(svgContent) {
        return Font.create(svgContent, {
            type: 'svg',
            hinting: true
        });
    }

    /**
     * Set standard metadata for the font.
     * @param {BitFont.FontEditorFont} fontObj 
     * @param {boolean} isBold 
     */
    static setMetadata(fontObj, isBold) {
        const fontData = fontObj.get();
        fontData.name.fontFamily = CONFIG.fontFamily;
        fontData.name.fontSubfamily = isBold ? 'Bold' : 'Regular';
        fontData.name.fullName = `${CONFIG.fontFamily} ${isBold ? 'Bold' : ''}`;
        fontData.name.version = 'Version 1.0';
        fontObj.set(fontData);
    }

    /**
     * Write WOFF2 file.
     * @param {BitFont.FontEditorFont} fontObj 
     * @param {string} outputPath 
     */
    static writeWOFF2(fontObj, outputPath) {
        try {
            const buffer = fontObj.write({ type: 'woff2' });
            fs.writeFileSync(outputPath, buffer);
            logger.success(`Saved WOFF2: ${outputPath}`);
        } catch (error) {
            logger.error(`Error saving WOFF2 ${outputPath}:`, error);
            throw error;
        }
    }

    /**
     * Write TTF file (helper for subsetting).
     * @param {BitFont.FontEditorFont} fontObj 
     * @param {string} outputPath 
     */
    static writeTTF(fontObj, outputPath) {
        try {
            const buffer = fontObj.write({ type: 'ttf' });
            fs.writeFileSync(outputPath, buffer);
            logger.info(`Saved Temp TTF: ${outputPath}`);
        } catch (error) {
            logger.error(`Error saving TTF ${outputPath}:`, error);
            throw error;
        }
    }
}

module.exports = FontBuilder;

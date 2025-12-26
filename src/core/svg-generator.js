/**
 * @module core/svg-generator
 * Generates SVG content for the font based on character data.
 */

const CONFIG = require('../config');
const BitmapProcessor = require('./bitmap-processor');

class SvgGenerator {
    /**
     * Generate the complete SVG content for a font variant.
     * @param {Array<Object>} charDataList - List of character data.
     * @param {boolean} isBold - Whether to generate bold variant.
     * @returns {string} The complete SVG string.
     */
    static generate(charDataList, isBold = false) {
        let glyphsXML = '';
        const usedCodePoints = new Set();

        for (const charData of charDataList) {
            const codePoint = charData.unicode.codePointAt(0);
            if (!codePoint || usedCodePoints.has(codePoint)) continue;
            usedCodePoints.add(codePoint);

            glyphsXML += this.createGlyphXML(charData, isBold);
        }

        return this.createFontXML(glyphsXML, isBold);
    }

    /**
     * Create the XML string for a single glyph.
     * @param {Object} charData 
     * @param {boolean} isBold 
     * @returns {string}
     */
    static createGlyphXML(charData, isBold) {
        let d = '';
        let visualWidth = charData.width || 0;
        let xOffset = charData.xOffset || 0;
        let bitmapToUse = charData.bitmap;

        // Scale Logic
        const providerHeight = charData.height || CONFIG.fontHeight;
        let heightScale = 1.0;
        if (providerHeight === CONFIG.unifontHeight) {
            heightScale = 0.5;
        }

        // Bold Logic
        if (isBold) {
            if (charData.type === 'bitmap') {
                bitmapToUse = BitmapProcessor.transformBold(charData.bitmap);
                if (bitmapToUse.length > 0) {
                    visualWidth = bitmapToUse[0].length;
                }
            } else if (charData.type === 'space') {
                visualWidth += 1;
            }
        }

        const effectiveScale = CONFIG.scale * heightScale;

        // Calculate Advance Width
        // Default spacing: xOffset + Width + 1px spacing
        let horizAdvX = (xOffset + visualWidth + 1) * effectiveScale;

        if (charData.type === 'bitmap' && bitmapToUse && bitmapToUse.length > 0) {
            const rawPath = BitmapProcessor.toSVGPath(bitmapToUse);
            if (rawPath) {
                const ascent = charData.ascent !== undefined ? charData.ascent : (charData.height - 1);
                d = this.transformPathToFontCoords(rawPath, effectiveScale, ascent, xOffset);
            }
        } else if (charData.type === 'space') {
            horizAdvX = visualWidth * effectiveScale;
        }

        const unicodeHex = `&#x${charData.unicode.codePointAt(0).toString(16).toUpperCase()};`;
        const glyphName = `uni${charData.unicode.codePointAt(0).toString(16).toUpperCase()}`;

        if (d) {
            return `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" d="${d}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        } else {
            return `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        }
    }

    /**
     * Transform SVG path coordinates from pixel space to font space.
     * @param {string} d - SVG path data.
     * @param {number} scale - Scaling factor.
     * @param {number} ascentPixel - Ascent in pixels.
     * @param {number} xOffsetPixel - X offset in pixels.
     * @returns {string} Transformed path data.
     */
    static transformPathToFontCoords(d, scale, ascentPixel, xOffsetPixel) {
        return d.replace(/([ML])\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (match, command, x, y) => {
            const pixelX = parseFloat(x);
            const pixelY = parseFloat(y);
            const fontX = (pixelX + xOffsetPixel) * scale;
            const fontY = (ascentPixel - pixelY) * scale;
            return `${command}${Math.round(fontX)} ${Math.round(fontY)}`;
        });
    }

    /**
     * Wrap glyphs in the font text structure.
     * @param {string} glyphsXML 
     * @param {boolean} isBold 
     * @returns {string}
     */
    static createFontXML(glyphsXML, isBold) {
        return `<?xml version="1.0" standalone="no"?>
        <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
        <svg xmlns="http://www.w3.org/2000/svg">
            <defs>
                <font id="MinecraftFont${isBold ? 'Bold' : ''}" horiz-adv-x="${Math.round(8 * CONFIG.scale)}">
                    <font-face 
                        font-family="${CONFIG.fontFamily}" 
                        font-weight="${isBold ? 'bold' : 'normal'}"
                        units-per-em="${CONFIG.unitsPerEm}" 
                        ascent="${CONFIG.unitsPerEm}" 
                        descent="0" 
                    />
                    <glyph glyph-name=".notdef" horiz-adv-x="${Math.round(8 * CONFIG.scale)}" />
                    ${glyphsXML}
                </font>
            </defs>
        </svg>`;
    }
}

module.exports = SvgGenerator;

const fs = require('fs');
const path = require('path');
const { Font, woff2 } = require('fonteditor-core');
const fontProcess = require('./font');
const { bitmapToSVGPath } = require('./convert');
const { createSubsets } = require('./subset');

const CONFIG = {
    unitsPerEm: 1024,
    pixelSize: 8,
    fontFamily: 'Minecraft Custom',
    limit: 53790
};

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, '../dist');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const SCALE = CONFIG.unitsPerEm / CONFIG.pixelSize;

function transformPathToFontCoords(d, scale, ascentPixel, xOffsetPixel) {
    return d.replace(/([ML])\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (match, command, x, y) => {
        const pixelX = parseFloat(x);
        const pixelY = parseFloat(y);
        const fontX = (pixelX + xOffsetPixel) * scale;
        const fontY = (ascentPixel - pixelY) * scale;
        return `${command}${Math.round(fontX)} ${Math.round(fontY)}`;
    });
}

/**
 * Apply pseudo-bold effect: "Smear" pixels to the right.
 * If pixel (x, y) is 1, then (x, y) and (x+1, y) become 1.
 * This increases the width of the bitmap by 1 pixel.
 */
function transformBitmapBold(bitmap) {
    if (!bitmap || bitmap.length === 0) return bitmap;

    const rows = bitmap.length;
    const cols = bitmap[0].length;
    const newCols = cols + 1;

    const newBitmap = [];

    for (let r = 0; r < rows; r++) {
        const row = bitmap[r];
        const newRow = new Array(newCols).fill(0);
        for (let c = 0; c < newCols; c++) {
            // Current pixel OR Previous pixel
            const curr = (c < cols) ? row[c] : 0;
            const prev = (c > 0) ? row[c - 1] : 0;
            newRow[c] = (curr === 1 || prev === 1) ? 1 : 0;
        }
        newBitmap.push(newRow);
    }
    return newBitmap;
}

/**
 * Generate a font file based on options
 * @param {Array} charDataList - List of character data
 * @param {Object} options - { outputFile, isBold }
 */
async function generateFont(charDataList, options) {
    const { outputFile, isBold } = options;
    console.log(`\n=== Generating ${isBold ? 'BOLD' : 'REGULAR'} Font: ${outputFile} ===`);

    let glyphsXML = '';
    let count = 0;
    const usedCodePoints = new Set();
    // Scale remains constant; we modify the geometry itself for bold
    const currentScale = SCALE;

    for (const charData of charDataList) {
        const codePoint = charData.unicode.codePointAt(0);
        if (codePoint === undefined || isNaN(codePoint) || codePoint === 0) continue;
        if (usedCodePoints.has(codePoint)) continue;
        usedCodePoints.add(codePoint);

        let d = '';
        let visualWidth = charData.width || 0;
        let xOffset = charData.xOffset || 0;
        let bitmapToUse = charData.bitmap;

        // Calculate height-based scale factor
        // Only scale Unifont (height=16) down to 8px. 
        // Accented chars (height=12) should use scale 1.0 to preserve body size (they are just taller).
        const providerHeight = charData.height || 8;
        let heightScale = 1.0;

        if (providerHeight === 16) {
            heightScale = 0.5; // Normalize 16px (Unifont) to 8px
        }
        // else: keep 1.0 (for 8px, 12px, etc)

        // Apply Bold Transformation
        if (isBold && charData.type === 'bitmap') {
            bitmapToUse = transformBitmapBold(charData.bitmap);
            // Re-calculate width from the new bitmap
            if (bitmapToUse.length > 0) {
                visualWidth = bitmapToUse[0].length;
            }
            // xOffset does NOT scale, but the glyph visually gets wider by 1px
            // which handles itself in the bitmap. 
        } else if (isBold && charData.type === 'space') {
            // For space, we probably just widen it by 1px or keep same?
            // "Doubling pixels" for space (empty) -> 0 -> 0 0. 
            // So width increases by 1px.
            visualWidth += 1;
        }

        // Apply height scale to effective SCALE
        const effectiveScale = SCALE * heightScale;

        // Calculate Advance Width with height scaling
        // Default spacing logic: (xOffset + Width + 1px spacing)
        let horizAdvX = (xOffset + visualWidth + 1) * effectiveScale;

        if (charData.type === 'bitmap' && bitmapToUse && bitmapToUse.length > 0) {
            const rawPath = bitmapToSVGPath(bitmapToUse);
            if (rawPath) {
                // Do NOT scale ascent/xOffset here. They are in coordinate space of bitmap/rawPath.
                // The scaling happens in transformPathToFontCoords via effectiveScale.
                const ascent = charData.ascent !== undefined ? charData.ascent : (charData.height - 1);
                d = transformPathToFontCoords(rawPath, effectiveScale, ascent, xOffset);
            }
        } else if (charData.type === 'space') {
            horizAdvX = visualWidth * effectiveScale;
        }

        const unicodeHex = `&#x${codePoint.toString(16).toUpperCase()};`;
        const glyphName = `uni${codePoint.toString(16).toUpperCase()}`;

        if (d) {
            glyphsXML += `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" d="${d}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        } else {
            glyphsXML += `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        }

        count++;
        if (count % 2000 === 0) process.stdout.write(`.`);
    }

    console.log(`\nProcessed ${count} glyphs.`);

    const svgContent = `<?xml version="1.0" standalone="no"?>
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
    <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
            <font id="MinecraftFont${isBold ? 'Bold' : ''}" horiz-adv-x="${Math.round(8 * SCALE)}">
                <font-face 
                    font-family="${CONFIG.fontFamily}" 
                    font-weight="${isBold ? 'bold' : 'normal'}"
                    units-per-em="${CONFIG.unitsPerEm}" 
                    ascent="${CONFIG.unitsPerEm}" 
                    descent="0" 
                />
                <glyph glyph-name=".notdef" horiz-adv-x="${Math.round(8 * SCALE)}" />
                ${glyphsXML}
            </font>
        </defs>
    </svg>`;

    try {
        const fontObj = Font.create(svgContent, {
            type: 'svg',
            hinting: true
        });

        const fontData = fontObj.get();
        fontData.name.fontFamily = CONFIG.fontFamily;
        fontData.name.fontSubfamily = isBold ? 'Bold' : 'Regular';
        fontData.name.fullName = `${CONFIG.fontFamily} ${isBold ? 'Bold' : ''}`;
        fontData.name.version = 'Version 1.0';
        fontObj.set(fontData);

        // Write output WOFF2
        const woff2Buffer = fontObj.write({ type: 'woff2' });
        fs.writeFileSync(outputFile, woff2Buffer);
        console.log(`✅ Saved: ${outputFile}`);

        // Generate Subsets (requires TTF)
        const tempTtfPath = outputFile.replace('.woff2', '.ttf');
        const ttfBuffer = fontObj.write({ type: 'ttf' });
        fs.writeFileSync(tempTtfPath, ttfBuffer);
        console.log(`Examples temp TTF saved for subsetting: ${tempTtfPath}`);

        try {
            await createSubsets(tempTtfPath, path.dirname(outputFile));
        } finally {
            // Clean up temp TTF
            if (fs.existsSync(tempTtfPath)) {
                fs.unlinkSync(tempTtfPath);
                console.log(`🧹 Deleted temp TTF: ${tempTtfPath}`);
            }
        }

    } catch (e) {
        console.error(`❌ Error building font ${outputFile}:`, e);
        // fs.writeFileSync(`error_dump_${isBold ? 'bold' : 'reg'}.svg`, svgContent);
    }
}

async function main() {
    console.log("--- STARTING BUILD PROCESS ---");
    await woff2.init();

    console.log("1. Reading Texture Data...");
    let charDataList = await fontProcess.main();

    if (!charDataList || charDataList.length === 0) {
        console.error("Error: No character data found!");
        return;
    }

    if (CONFIG.limit && charDataList.length > CONFIG.limit) {
        console.log(`⚠️  Limit applied: ${CONFIG.limit} chars.`);
        charDataList.sort((a, b) => (a.unicode.codePointAt(0) || 0) - (b.unicode.codePointAt(0) || 0));
        charDataList = charDataList.slice(0, CONFIG.limit);
    }

    // Build Regular
    await generateFont(charDataList, {
        outputFile: path.join(OUTPUT_DIR, 'MinecraftFont.woff2'),
        isBold: false
    });

    // Build Bold
    await generateFont(charDataList, {
        outputFile: path.join(OUTPUT_DIR, 'MinecraftFont-Bold.woff2'),
        isBold: true
    });

    console.log("\n--- BUILD COMPLETE ---");
}

main();

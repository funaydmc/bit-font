const fs = require('fs');
const path = require('path');
const { Font } = require('fonteditor-core');
const CONFIG = require('./config');
const FontLoader = require('./core/font-loader');
const BitmapProcessor = require('./core/bitmap-processor');
const SvgGenerator = require('./core/svg-generator');
const logger = require('./utils/logger');

// Setup Coverage Directory
const COVERAGE_DIR = path.join(__dirname, '../coverage');
if (!fs.existsSync(COVERAGE_DIR)) {
    fs.mkdirSync(COVERAGE_DIR, { recursive: true });
}

const LOG_FILE = path.join(COVERAGE_DIR, 'debug_output.log');
// Clear log file
if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

function logToFile(args) {
    fs.appendFileSync(LOG_FILE, args.join(' ') + '\n');
}

// Override console logging for debugging capture
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function (...args) {
    originalLog.apply(console, args);
    logToFile(args);
};

console.error = function (...args) {
    originalError.apply(console, args);
    logToFile(['ERROR:', ...args]);
};

console.warn = function (...args) {
    originalWarn.apply(console, args);
    logToFile(['WARN:', ...args]);
};

/**
 * Debug and build a font containing only the characters in the target string.
 * @param {string} targetString - The string to use for debugging characters.
 */
async function debugAndBuildString(targetString) {
    console.log(`\n=== DEBUGGING STRING: '${targetString}' ===`);

    // 1. Load Data (Optimized or Full)
    // For debug, we can try to find specific chars or just load defaults
    // Here we load default to ensure we have the specific user set
    // Using FontLoader singleton

    // We can manually trigger a load if needed, or check if populated
    // Since FontLoader is a singleton, we can just call loadAll() or use specific method if we expose it
    // But FontLoader.loadAll() re-clears list.
    // Let's just call loadAll() for simplicity in this debug script version

    // Optimization: If targetString is small, maybe we only want to load relevant files? 
    // But dependencies are complex. Let's just load all for now as it takes ~few seconds.
    // Or we can try to reuse the FontLoader if it exported 'processReference'. 

    // Let's stick to full load for correctness:
    if (FontLoader.charList.length === 0) {
        console.log("Loading all font data...");
        await FontLoader.loadAll();
    }
    const charDataList = FontLoader.charList;

    // Filter duplicates
    const uniqueChars = Array.from(new Set(targetString));
    console.log(`Unique characters to process: ${uniqueChars.join('')}`);

    let glyphsXML = '';

    // Process each character
    for (const char of uniqueChars) {
        const charData = charDataList.find(c => c.unicode === char);

        if (!charData) {
            console.warn(`WARNING: Character '${char}' not found! Skipping.`);
            continue;
        }

        console.log(`\n--- PROCESSING CHAR: '${char}' ---`);
        console.log(`Ascent: ${charData.ascent}, Height: ${charData.height}, Width: ${charData.width}`);

        // Use SvgGenerator logic to create glyph XML
        // We can expose createGlyphXML from SvgGenerator or just copy the logic/use generate()
        // SvgGenerator.createGlyphXML is static, so we can use it.
        const glyphXML = SvgGenerator.createGlyphXML(charData, false); // False for regular
        glyphsXML += glyphXML;
    }

    const svgContent = SvgGenerator.createFontXML(glyphsXML, false);

    // Write output
    console.log(`\n--- BUILDING TTF ---`);
    const outputFileName = path.join(COVERAGE_DIR, `DebugFont_Mixed.ttf`);

    try {
        const fontObj = Font.create(svgContent, {
            type: 'svg',
            hinting: true
        });

        const fontData = fontObj.get();
        fontData.name.fontFamily = `Debug Mixed`;
        fontData.name.fullName = `Debug Minecraft Mixed`;
        fontObj.set(fontData);

        const ttfBuffer = fontObj.write({ type: 'ttf' });
        fs.writeFileSync(outputFileName, ttfBuffer);

        console.log(`✅ SUCCESS! Saved to: ${outputFileName}`);

    } catch (e) {
        console.error("❌ Error building font:", e);
        fs.writeFileSync(path.join(COVERAGE_DIR, 'debug_error.svg'), svgContent);
    }
}

// Entry point
const targetStr = process.argv[2] || '✦★ Nhấnđểcọsver';
debugAndBuildString(targetStr);

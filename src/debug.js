const fs = require('fs');
const { Font } = require('fonteditor-core');
const fontProcess = require('./font'); // Import font.js
const { bitmapToSVGPath } = require('./convert'); // Import convert.js

// Cấu hình
const CONFIG = {
    unitsPerEm: 1024,
    pixelSize: 16,
    outputFile: 'DebugFont.ttf', // Tên file output mặc định
    fontFamily: 'Debug Font'
};
const SCALE = CONFIG.unitsPerEm / CONFIG.pixelSize;

// Hàm in Bitmap ra console (giữ nguyên)
function printVisualBitmap(bitmap) {
    console.log("--- VISUAL BITMAP (█ = 1, . = 0) ---");
    if (!bitmap || bitmap.length === 0) {
        console.log("(Empty Bitmap)");
        return;
    }
    console.log("   " + bitmap[0].map((_, i) => i % 10).join(''));
    bitmap.forEach((row, index) => {
        const line = row.map(pixel => pixel === 1 ? '█' : '.').join('');
        console.log(`${index.toString().padStart(2, '0')} ${line}`);
    });
    console.log("------------------------------------");
}

const LOG_FILE = 'debug_output.log';
// Clear log file
if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

function log(msg) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Thay thế console.log bằng log trong các bước quan trọng (hoặc override console.log)
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function logToFile(args) {
    fs.appendFileSync(LOG_FILE, args.join(' ') + '\n');
}

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

// Hàm transform (giữ nguyên logic đã sửa)
function transformPathToFontCoords(d, scale, ascentPixel, xOffsetPixel) {
    return d.replace(/([ML])\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (match, command, x, y) => {
        const pixelX = parseFloat(x);
        const pixelY = parseFloat(y);
        const fontX = (pixelX + xOffsetPixel) * scale;
        const fontY = (ascentPixel - pixelY) * scale; // Lật trục Y
        return `${command}${Math.round(fontX)} ${Math.round(fontY)}`;
    });
}

async function debugAndBuildString(targetString) {
    console.log(`\n=== ĐANG DEBUG VÀ BUILD STRING: '${targetString}' ===`);

    // 1. Lấy dữ liệu
    // Load using the same reference as main() to ensure all characters are available
    let charDataList;
    if (fontProcess.processReference && fontProcess.charList) {
        console.log("Using optimized loading...");
        fontProcess.charList.length = 0;
        fontProcess.processedCodes.clear();
        await fontProcess.processReference('minecraft:default');
        charDataList = fontProcess.charList;
    } else {
        console.log("Using full main() loading...");
        charDataList = await fontProcess.main();
    }

    const targetChars = Array.from(targetString); // Handle unicode surrogate pairs correctly
    let glyphsXML = '';

    // Process each character
    for (const char of targetChars) {
        const charData = charDataList.find(c => c.unicode === char);

        if (!charData) {
            console.warn(`WARNING: Không tìm thấy ký tự '${char}'! Skipping.`);
            continue;
        }

        console.log(`\n--- PROCESSING CHAR: '${char}' ---`);
        console.log(`Ascent (from provider): ${charData.ascent}`);
        console.log(`Height (from provider): ${charData.height}`);

        if (charData.type === 'bitmap') {
            // Calculate bounded dimensions from bitmap
            const b_height = charData.bitmap ? charData.bitmap.length : 0;
            const b_width = charData.width || 0;

            console.log(`b_height: ${b_height}, b_width: ${b_width}, xOffset: ${charData.xOffset || 0}`);
            // printVisualBitmap(charData.bitmap); // Optional: uncomment if too noisy
        }

        // Calculate height-based scale factor (same as index.js)
        const providerHeight = charData.height || 8;
        let heightScale = 1.0;
        if (providerHeight === 16) {
            heightScale = 0.5;
        }

        console.log(`Height Scale Factor: ${heightScale} (${providerHeight}px -> ${providerHeight * heightScale / (1 / 8)}px equiv)`);

        let d = '';
        let visualWidth = charData.width || 0;
        let xOffset = charData.xOffset || 0;
        let bitmapToUse = charData.bitmap;

        // Note: Bold logic is omitted in debug for simplicity unless needed

        const effectiveScale = SCALE * heightScale;

        // Calculate Advance Width
        // Default spacing logic: (xOffset + Width + 1px spacing)
        // Space char also uses effectiveScale
        let horizAdvX;

        if (charData.type === 'space') {
            horizAdvX = visualWidth * effectiveScale;
        } else {
            horizAdvX = Math.round((xOffset + visualWidth + 1) * effectiveScale); // +1 spacing
        }

        if (charData.type === 'bitmap' && bitmapToUse && bitmapToUse.length > 0) {
            const rawPath = bitmapToSVGPath(bitmapToUse);
            if (rawPath) {
                // Do NOT scale ascent/xOffset here. They are in coordinate space of bitmap/rawPath.
                const ascent = charData.ascent !== undefined ? charData.ascent : (charData.height - 1);
                d = transformPathToFontCoords(rawPath, effectiveScale, ascent, xOffset);
            }
        }

        const codePoint = charData.unicode.codePointAt(0);
        const unicodeHex = `&#x${codePoint.toString(16).toUpperCase()};`;
        const glyphName = `uni${codePoint.toString(16).toUpperCase()}`;

        if (d) {
            glyphsXML += `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" d="${d}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        } else {
            glyphsXML += `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        }
    }

    const svgContent = `<?xml version="1.0" standalone="no"?>
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
    <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
            <font id="DebugFont" horiz-adv-x="${Math.round(8 * SCALE)}">
                <font-face 
                    font-family="${CONFIG.fontFamily}" 
                    units-per-em="${CONFIG.unitsPerEm}" 
                    ascent="${CONFIG.unitsPerEm}" 
                    descent="0" 
                />
                <glyph glyph-name=".notdef" horiz-adv-x="${Math.round(8 * SCALE)}" />
                ${glyphsXML} 
            </font>
        </defs>
    </svg>`;

    // 6. Compile ra file TTF
    console.log(`\n--- ĐANG BUILD FILE TTF ---`);
    const outputFileName = `DebugFont_Mixed.ttf`;

    try {
        const fontObj = Font.create(svgContent, {
            type: 'svg',
            hinting: true
        });

        // Đặt tên hiển thị cho font
        const fontData = fontObj.get();
        fontData.name.fontFamily = `Debug Mixed`;
        fontData.name.fullName = `Debug Minecraft Mixed`;
        fontObj.set(fontData);

        const ttfBuffer = fontObj.write({ type: 'ttf' });
        fs.writeFileSync(outputFileName, ttfBuffer);

        console.log(`✅ THÀNH CÔNG!`);
        console.log(`👉 File đã tạo: ${outputFileName}`);
        console.log(`Hãy mở file này lên để kiểm tra các ký tự: ${targetString}`);

    } catch (e) {
        console.error("❌ Lỗi khi compile font:", e);
        fs.writeFileSync('debug_error.svg', svgContent);
    }
}

// Example usage:
// Arg 1: String to debug
const targetStr = process.argv[2] || '✦★ Nhấnđểcọsver';
debugAndBuildString(targetStr);

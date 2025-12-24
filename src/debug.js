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

async function debugAndBuildOneChar(targetChar) {
    console.log(`\n=== ĐANG DEBUG VÀ BUILD KÝ TỰ: '${targetChar}' ===`);

    // 1. Lấy dữ liệu
    // OPTIMIZATION: Manually load specific parts to avoid loading entire Unifont for debugging
    // If fontProcess exposes internal methods, use them. Otherwise fallback to main()
    let charDataList;
    if (fontProcess.processReference && fontProcess.charList) {
        console.log("Using optimized loading (skipping Unifont)...");
        fontProcess.charList.length = 0;
        fontProcess.processedCodes.clear();
        await fontProcess.processReference('minecraft:include/default');
        charDataList = fontProcess.charList;
    } else {
        console.log("Using full main() loading...");
        charDataList = await fontProcess.main();
    }

    const charData = charDataList.find(c => c.unicode === targetChar);

    if (!charData) {
        console.error(`LỖI: Không tìm thấy ký tự '${targetChar}'!`);
        return;
    }

    // 2. In thông tin cơ bản
    console.log(`\n--- INFO ---`);
    console.log(`Width: ${charData.width}, Height: ${charData.height}, Ascent: ${charData.ascent}`);
    console.log(`xOffset (Padding Left): ${charData.xOffset || 0}`);

    if (charData.type !== 'bitmap') {
        console.log("Không phải Bitmap, bỏ qua.");
        return;
    }

    // 3. In Bitmap
    printVisualBitmap(charData.bitmap);

    // 4. Tạo Path và Transform
    const rawPath = bitmapToSVGPath(charData.bitmap);
    if (!rawPath) {
        console.error("Lỗi: Không tạo được SVG Path.");
        return;
    }

    const ascent = charData.ascent !== undefined ? charData.ascent : (charData.height - 1);
    const xOffset = charData.xOffset || 0;

    // Tính toán Advance Width chuẩn
    // +1 để tạo khoảng thở tự nhiên, nếu muốn khít thì bỏ +1
    const horizAdvX = Math.round((xOffset + charData.width + 1) * SCALE);

    const finalPath = transformPathToFontCoords(rawPath, SCALE, ascent, xOffset);

    // 5. Tạo SVG Content cho Font
    const codePoint = charData.unicode.codePointAt(0);
    const unicodeHex = `&#x${codePoint.toString(16).toUpperCase()};`;
    const glyphName = `uni${codePoint.toString(16).toUpperCase()}`;

    // Log thẻ Glyph để kiểm tra
    const glyphTag = `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" d="${finalPath}" horiz-adv-x="${horizAdvX}" />`;
    console.log(`\n--- GLYPH XML ---\n${glyphTag}`);

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
                ${glyphTag} 
            </font>
        </defs>
    </svg>`;

    // 6. Compile ra file TTF
    console.log(`\n--- ĐANG BUILD FILE TTF ---`);
    const outputFileName = `DebugFont_${targetChar === ' ' ? 'Space' : targetChar}.ttf`;

    try {
        const fontObj = Font.create(svgContent, {
            type: 'svg',
            hinting: true
        });

        // Đặt tên hiển thị cho font
        const fontData = fontObj.get();
        fontData.name.fontFamily = `Debug ${targetChar}`;
        fontData.name.fullName = `Debug Minecraft ${targetChar}`;
        fontObj.set(fontData);

        const ttfBuffer = fontObj.write({ type: 'ttf' });
        fs.writeFileSync(outputFileName, ttfBuffer);

        console.log(`✅ THÀNH CÔNG!`);
        console.log(`👉 File đã tạo: ${outputFileName}`);
        console.log(`Hãy mở file này lên để kiểm tra ký tự.`);

    } catch (e) {
        console.error("❌ Lỗi khi compile font:", e);
        fs.writeFileSync('debug_error.svg', svgContent);
        console.log("Đã lưu file 'debug_error.svg' để kiểm tra.");
    }
}

// Chạy debug cho chữ 'B' (hoặc thay đổi ký tự bạn muốn)
debugAndBuildOneChar('B');

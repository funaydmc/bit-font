const fs = require('fs');
const { Font } = require('fonteditor-core');
const fontProcess = require('./font');
const { bitmapToSVGPath } = require('./convert');

const CONFIG = {
    unitsPerEm: 1024,
    pixelSize: 8, // Kích thước cơ sở (16px = 1 block Minecraft)
    outputFile: 'MinecraftFont.ttf',
    fontFamily: 'Minecraft Custom',
    limit: 53790 // Giới hạn số lượng ký tự (null = không giới hạn)
};

const SCALE = CONFIG.unitsPerEm / CONFIG.pixelSize;

/**
 * Hàm biến đổi đường dẫn SVG sang tọa độ Font
 * @param {string} d - SVG Path data
 * @param {number} scale - Tỉ lệ scale
 * @param {number} ascentPixel - Tọa độ đỉnh (để lật trục Y)
 * @param {number} xOffsetPixel - Khoảng cách lề trái (padding)
 */
function transformPathToFontCoords(d, scale, ascentPixel, xOffsetPixel) {
    return d.replace(/([ML])\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (match, command, x, y) => {
        const pixelX = parseFloat(x);
        const pixelY = parseFloat(y);

        // Cộng thêm xOffset để giữ đúng khoảng cách ký tự
        const fontX = (pixelX + xOffsetPixel) * scale;

        // Lật trục Y: Font coords (Y tăng lên trên), Image coords (Y tăng xuống dưới)
        const fontY = (ascentPixel - pixelY) * scale;

        return `${command}${Math.round(fontX)} ${Math.round(fontY)}`;
    });
}

async function build() {
    console.log("--- BẮT ĐẦU QUÁ TRÌNH BUILD FONT ---");

    console.log("1. Đang đọc dữ liệu Texture...");
    let charDataList = await fontProcess.main();

    if (!charDataList || charDataList.length === 0) {
        console.error("Lỗi: Không tìm thấy dữ liệu ký tự!");
        return;
    }

    // Giới hạn ký tự cho bản build chính thức (nếu có config)
    if (CONFIG.limit && charDataList.length > CONFIG.limit) {
        console.log(`⚠️  Giới hạn bản build: ${CONFIG.limit} ký tự đầu tiên (Tổng tìm thấy: ${charDataList.length})`);

        // Sắp xếp theo Code Point để đảm bảo lấy đúng các ký tự cơ bản (ASCII/Latin-1)
        charDataList.sort((a, b) => (a.unicode.codePointAt(0) || 0) - (b.unicode.codePointAt(0) || 0));

        charDataList = charDataList.slice(0, CONFIG.limit);
    }

    console.log(`2. Đang xử lý ${charDataList.length} ký tự...`);

    let glyphsXML = '';
    let count = 0;
    const usedCodePoints = new Set();

    for (const charData of charDataList) {
        const codePoint = charData.unicode.codePointAt(0);

        if (codePoint === undefined || isNaN(codePoint) || codePoint === 0) continue;
        if (usedCodePoints.has(codePoint)) continue;
        usedCodePoints.add(codePoint);

        let d = '';
        // Tính độ rộng của ký tự trong font (Advance Width)
        // Trong Minecraft, width bao gồm cả phần đã trim + 1px spacing mặc định (nếu muốn)
        // Ở đây ta dùng width từ bitmap + xOffset (phần padding trái đã bị cắt)
        // Nếu muốn chuẩn Minecraft, thường là width thực tế của ký tự + padding phải.
        // Để đơn giản và an toàn, ta dùng: (width cắt + xOffset + 1px spacing nếu muốn thoáng) * Scale
        // Nhưng logic chuẩn của Bitmap font thường là width = độ rộng ô chứa (nếu monospace) hoặc độ rộng ảnh.
        // Ở đây charData.width là độ rộng ĐÃ CẮT.

        let visualWidth = charData.width || 0;
        let xOffset = charData.xOffset || 0;

        // Advance Width = (Padding trái + Độ rộng chữ + 1px padding phải mặc định) * Scale
        // Lưu ý: Minecraft thường tự động thêm 1px padding giữa các ký tự khi render. 
        // Trong TTF, ta phải tính luôn vào Advance Width.
        let horizAdvX = (xOffset + visualWidth + 1) * SCALE;

        if (charData.type === 'bitmap' && charData.bitmap && charData.bitmap.length > 0) {
            const rawPath = bitmapToSVGPath(charData.bitmap);
            if (rawPath) {
                const ascent = charData.ascent !== undefined ? charData.ascent : (charData.height - 1);
                // Truyền xOffset vào để dịch chuyển path sang phải
                d = transformPathToFontCoords(rawPath, SCALE, ascent, xOffset);
            }
        }
        else if (charData.type === 'space') {
            horizAdvX = charData.width * SCALE;
        }

        const unicodeHex = `&#x${codePoint.toString(16).toUpperCase()};`;
        const glyphName = `uni${codePoint.toString(16).toUpperCase()}`;

        if (d) {
            glyphsXML += `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" d="${d}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        } else {
            glyphsXML += `<glyph glyph-name="${glyphName}" unicode="${unicodeHex}" horiz-adv-x="${Math.round(horizAdvX)}" />\n`;
        }

        count++;
        if (count % 1000 === 0) process.stdout.write(`.`);
    }

    console.log(`\nTổng số ký tự hợp lệ: ${count}`);
    console.log("3. Đang đóng gói SVG và compile TTF...");

    const svgContent = `<?xml version="1.0" standalone="no"?>
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
    <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
            <font id="MinecraftFont" horiz-adv-x="${Math.round(8 * SCALE)}">
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

    try {
        const fontObj = Font.create(svgContent, {
            type: 'svg',
            hinting: true // Bật hinting để hiển thị tốt hơn ở size nhỏ
        });

        const fontData = fontObj.get();
        fontData.name.fontFamily = CONFIG.fontFamily;
        fontData.name.version = 'Version 1.0';
        fontObj.set(fontData);

        const ttfBuffer = fontObj.write({ type: 'ttf' });
        fs.writeFileSync(CONFIG.outputFile, ttfBuffer);

        console.log(`--- THÀNH CÔNG! ---`);
        console.log(`Đã tạo file: ${CONFIG.outputFile}`);

    } catch (e) {
        console.error("Lỗi khi compile font:", e);
        fs.writeFileSync('error_dump.svg', svgContent);
        console.log("Đã ghi file 'error_dump.svg' để debug.");
    }
}

build();

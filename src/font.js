const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const FONT_DIR = path.join(__dirname, 'font');
const TEXTURE_DIR = path.join(__dirname, 'texture');

// Sử dụng object thường thay vì Map để export dễ hơn, hoặc dùng mảng
const charList = [];
const processedCodes = new Set(); // Để check trùng lặp

async function main() {
    console.log('Starting font processing...');

    // Reset
    charList.length = 0;
    processedCodes.clear();

    try {
        await processReference('minecraft:default');

        // Sort theo Unicode
        charList.sort((a, b) => a.unicode.localeCompare(b.unicode));

        console.log(`Successfully generated font data for ${charList.length} characters.`);
        return charList;

    } catch (error) {
        console.error('Error processing font:', error);
        return [];
    }
}

function addChar(charData) {
    // Loại bỏ ký tự null (0x0000)
    if (charData.unicode === '\u0000' || charData.unicode.codePointAt(0) === 0) {
        return;
    }

    // Loại bỏ ký tự bitmap rỗng (toàn 0 hoặc mảng rỗng)
    if (charData.type === 'bitmap') {
        if (!charData.bitmap || charData.bitmap.length === 0) return;

        // Kiểm tra kỹ xem có pixel nào = 1 không
        const hasVisiblePixels = charData.bitmap.some(row => row.includes(1));
        if (!hasVisiblePixels) return;
    }

    if (!processedCodes.has(charData.unicode)) {
        processedCodes.add(charData.unicode);
        charList.push(charData);
    }
}

async function processReference(id) {
    if (id === 'minecraft:include/unifont') {
        await processUnifont();
        return;
    }

    // Fix đường dẫn file: minecraft:include/default -> include-default.json
    const filename = id.split(':')[1].replace('include/', 'include-') + '.json';
    const filePath = path.join(FONT_DIR, filename);

    if (!fs.existsSync(filePath)) {
        // Thử tìm trực tiếp tên file nếu không có prefix include-
        const altPath = path.join(FONT_DIR, id.split(':')[1] + '.json');
        if (fs.existsSync(altPath)) {
            const content = JSON.parse(fs.readFileSync(altPath, 'utf8'));
            if (content.providers) {
                for (const provider of content.providers) await processProvider(provider);
            }
            return;
        }

        console.warn(`File not found: ${filePath} (ID: ${id})`);
        return;
    }

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (content.providers) {
        for (const provider of content.providers) {
            await processProvider(provider);
        }
    }
}

async function processProvider(provider) {
    switch (provider.type) {
        case 'bitmap':
            await processBitmapProvider(provider);
            break;
        case 'space':
            processSpaceProvider(provider);
            break;
        case 'reference':
            await processReference(provider.id);
            break;
    }
}

function parsePng(imagePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(imagePath)) {
            resolve(null);
            return;
        }
        fs.createReadStream(imagePath)
            .pipe(new PNG({ filterType: 4 }))
            .on('parsed', function () {
                resolve({ width: this.width, height: this.height, data: this.data });
            })
            .on('error', (err) => reject(err));
    });
}

async function processBitmapProvider(provider) {
    const file = provider.file.replace('minecraft:font/', '');
    const imagePath = path.join(TEXTURE_DIR, file);

    const image = await parsePng(imagePath);
    if (!image) {
        console.warn(`Texture not found: ${imagePath}`);
        return;
    }

    const rows = provider.chars.length;
    const cols = provider.chars[0].length;

    // Sử dụng Math.floor để an toàn
    const chunkWidth = Math.floor(image.width / cols);
    const chunkHeight = Math.floor(image.height / rows);
    const height = provider.height || 8;
    const ascent = provider.ascent !== undefined ? provider.ascent : 7;

    for (let y = 0; y < rows; y++) {
        const rowChars = provider.chars[y];
        for (let x = 0; x < cols; x++) {
            const char = rowChars[x];
            if (char === '\u0000') continue;

            const charData = extractBitmap(image, x * chunkWidth, y * chunkHeight, chunkWidth, chunkHeight);

            if (!charData.isEmpty) {
                addChar({
                    unicode: char,
                    type: 'bitmap',
                    width: charData.width, // Chiều rộng thực tế (đã trim)
                    height: height,
                    ascent: ascent,
                    bitmap: charData.pixels,
                    xOffset: charData.xOffset // QUAN TRỌNG: Offset lề trái
                });
            }
        }
    }
}

function processSpaceProvider(provider) {
    for (const [char, advance] of Object.entries(provider.advances)) {
        addChar({
            unicode: char,
            type: 'space',
            width: advance
        });
    }
}

async function processUnifont() {
    for (let i = 0; i < 256; i++) {
        const page = i.toString(16).padStart(2, '0');
        const filename = `unicode_page_${page}.png`;
        const imagePath = path.join(TEXTURE_DIR, filename);

        const image = await parsePng(imagePath);
        if (image) {
            const tileWidth = 16;
            const tileHeight = 16;
            // Unifont thường là lưới 16x16 ký tự
            for (let cy = 0; cy < 16; cy++) {
                for (let cx = 0; cx < 16; cx++) {
                    const charCode = (i * 256) + (cy * 16) + cx;
                    const char = String.fromCharCode(charCode);

                    if (processedCodes.has(char)) continue;

                    const charData = extractBitmap(image, cx * tileWidth, cy * tileHeight, tileWidth, tileHeight);
                    if (!charData.isEmpty) {
                        addChar({
                            unicode: char,
                            type: 'bitmap',
                            width: charData.width,
                            height: 16,
                            ascent: 15, // Unifont chuẩn
                            bitmap: charData.pixels,
                            xOffset: charData.xOffset
                        });
                    }
                }
            }
        }
    }
}

function extractBitmap(image, x, y, width, height) {
    let minX = width, maxX = -1;
    let anyPixels = false;

    // Pass 1: Tìm biên giới hạn (Bounding Box)
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            // Kiểm tra bounds an toàn
            if (x + px >= image.width || y + py >= image.height) continue;

            const idx = ((y + py) * image.width + (x + px)) * 4;
            const r = image.data[idx];
            const g = image.data[idx + 1];
            const b = image.data[idx + 2];
            const a = image.data[idx + 3];

            // Pixel được coi là "nội dung" nếu:
            // 1. Alpha > 10 (không trong suốt)
            // 2. VÀ không phải màu đen tuyệt đối (0,0,0) - giả định nền đen là trong suốt nếu mất alpha
            const isContent = a > 10 && !(r === 0 && g === 0 && b === 0);

            if (isContent) {
                anyPixels = true;
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
            }
        }
    }

    if (!anyPixels) {
        return { pixels: [], width: 0, isEmpty: true, xOffset: 0 };
    }

    // Pass 2: Trích xuất pixel trong vùng biên
    const pixels = [];
    for (let py = 0; py < height; py++) {
        const row = [];
        // Chỉ lấy từ minX đến maxX
        for (let px = minX; px <= maxX; px++) {
            if (x + px >= image.width || y + py >= image.height) {
                row.push(0);
                continue;
            }
            const idx = ((y + py) * image.width + (x + px)) * 4;
            const r = image.data[idx];
            const g = image.data[idx + 1];
            const b = image.data[idx + 2];
            const a = image.data[idx + 3];

            // Logic tương tự Pass 1
            const isContent = a > 10 && !(r === 0 && g === 0 && b === 0);
            row.push(isContent ? 1 : 0);
        }
        pixels.push(row);
    }

    return {
        pixels: pixels,
        width: maxX - minX + 1, // Chiều rộng phần hiển thị
        xOffset: minX,          // Khoảng cách từ lề trái của ô tới pixel đầu tiên
        isEmpty: false
    };
}

module.exports = { main, charList, processedCodes, processReference };

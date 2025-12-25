const Fontmin = require('fontmin');
const path = require('path');
const fs = require('fs');

// Các bộ ký tự
const CHARSETS = {
    ascii: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:'",.<>/?\\ `,

    vi: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789` +
        `ÀÁÂÃĂẠẢẤẦẨẪẬẮẰẲẴẶÈÉÊẸẺẼẾỀỂỄỆÌÍỊỈĨÒÓÔÕƠỌỎỐỒỔỖỘỚỜỞỠỢÙÚƯỤỦỨỪỬỮỰỲÝỴỶỸ` +
        `àáâãăạảấầẩẫậắằẳẵặèéêẹẻẽếềểễệìíịỉĩòóôõơọỏốồổỗộớờởỡợùúưụủứừửữựỳýỵỷỹ` +
        `Đđ«»“”‚‛„‟‗•…№–—·™®©` +
        `\u0300\u0301\u0303\u0309\u0323!@#$%^&*()_+-=[]{}|;:'",.<>/?\\ `
};

/**
 * Tạo các subset font từ font gốc
 * @param {string} sourceFontPath - Đường dẫn file .ttf gốc
 * @param {string} outputDir - Thư mục output
 */
async function createSubsets(sourceFontPath, outputDir) {
    if (!fs.existsSync(sourceFontPath)) {
        console.error(`❌ Không tìm thấy font gốc: ${sourceFontPath}`);
        return;
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`--- BẮT ĐẦU TẠO SUBSET ---`);

    const promises = Object.keys(CHARSETS).map(mode => {
        return new Promise((resolve, reject) => {
            const fontmin = new Fontmin()
                .src(sourceFontPath)
                .use(Fontmin.glyph({
                    text: CHARSETS[mode],
                    hinting: false
                }))
                .use(Fontmin.ttf2woff2());

            // Không dùng .dest() nữa để tránh lỗi filesystem race condition
            // Ta sẽ ghi file thủ công từ buffer trả về

            fontmin.run((err, files) => {
                if (err) {
                    console.error(`❌ Lỗi subset ${mode}:`, err);
                    reject(err);
                    return;
                }

                if (!files || files.length === 0) {
                    console.error(`❌ Không có output nào cho subset ${mode}`);
                    reject(new Error('No output files'));
                    return;
                }

                // Find woff2 file in the output
                const woff2File = files.find(f => path.extname(f.relative) === '.woff2');

                if (!woff2File) {
                    console.error(`❌ Không tìm thấy file woff2 cho subset ${mode}`);
                    reject(new Error('No woff2 file generated'));
                    return;
                }

                // Tên file đích: [OriginalName]_[Mode].woff2
                const baseName = path.basename(sourceFontPath, '.ttf');
                const finalName = `${baseName}_${mode.toUpperCase()}.woff2`;
                const finalPath = path.join(outputDir, finalName);

                try {
                    fs.writeFileSync(finalPath, woff2File.contents);
                    console.log(`✅ Đã tạo subset: ${finalName}`);
                    resolve(finalPath);
                } catch (e) {
                    console.error(`❌ Lỗi ghi file ${mode}:`, e);
                    reject(e);
                }
            });
        });
    });

    await Promise.all(promises);
    console.log(`--- HOÀN THÀNH TẠO SUBSET CHO: ${path.basename(sourceFontPath)} ---`);
}

module.exports = { createSubsets };

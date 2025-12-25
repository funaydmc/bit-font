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
                }));

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

                // Tên file đích
                const finalName = `MinecraftFont_${mode.toUpperCase()}.ttf`;
                const finalPath = path.join(outputDir, finalName);

                try {
                    // Files[0] là file TTF đã subset (Vinyl object có thuộc tính contents là Buffer)
                    const subsetBuffer = files[0].contents;

                    fs.writeFileSync(finalPath, subsetBuffer);
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
    console.log(`--- HOÀN THÀNH TẠO SUBSET ---`);
}

module.exports = { createSubsets };

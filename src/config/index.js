const path = require('path');

/**
 * Configuration for the font build process.
 * @module config
 */

const CONFIG = {
    // Font settings
    unitsPerEm: 1024,
    pixelSize: 8,
    fontFamily: 'Minecraft Custom',

    // Dimensions
    fontHeight: 8,
    unifontHeight: 16,
    unifontAscent: 15,
    defaultAscent: 7,

    // Scaling
    // SCALE = 1024 / 8 = 128
    get scale() {
        return this.unitsPerEm / this.pixelSize;
    },

    // Paths
    paths: {
        root: path.resolve(__dirname, '../../'),
        src: path.resolve(__dirname, '../'),
        dist: path.resolve(__dirname, '../../dist'),
        fontDir: path.resolve(__dirname, '../assets/font'),
        textureDir: path.resolve(__dirname, '../assets/texture'),
    },

    // Character sets for filtering
    charsets: {
        vi: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789` +
            `ÀÁÂÃĂẠẢẤẦẨẪẬẮẰẲẴẶÈÉÊẸẺẼẾỀỂỄỆÌÍỊỈĨÒÓÔÕƠỌỎỐỒỔỖỘỚỜỞỠỢÙÚƯỤỦỨỪỬỮỰỲÝỴỶỸ` +
            `àáâãăạảấầẩẫậắằẳẵặèéêẹẻẽếềểễệìíịỉĩòóôõơọỏốồổỗộớờởỡợùúưụủứừửữựỳýỵỷỹ` +
            `Đđ«»“”‚‛„‟‗•…№–—·™®©` +
            `\u0300\u0301\u0303\u0309\u0323!@#$%^&*()_+-=[]{}|;:'",.<>/?\\ `
    }
};

module.exports = CONFIG;

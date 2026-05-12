/**
 * @module core/build-service
 * Shared font build pipeline for CLI and dev server.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CONFIG = require('../config');
const logger = require('../utils/logger');
const FontLoader = require('./font-loader');
const SvgGenerator = require('./svg-generator');
const FontBuilder = require('./font-builder');

const VARIANTS = [
    { id: 'full-normal', charset: 'full', type: 'normal', label: 'Full Regular' },
    { id: 'full-bold', charset: 'full', type: 'bold', label: 'Full Bold' },
    { id: 'vi-normal', charset: 'vi', type: 'normal', label: 'Vietnamese Regular' },
    { id: 'vi-bold', charset: 'vi', type: 'bold', label: 'Vietnamese Bold' },
    { id: 'custom-normal', charset: 'custom', type: 'normal', label: 'Custom Regular' },
    { id: 'custom-bold', charset: 'custom', type: 'bold', label: 'Custom Bold' }
];

function normalizeCustomText(text = '') {
    return Array.from(new Set(Array.from(text))).join('');
}

function getCustomTextHash(text) {
    return crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function getVariantId(charset, type) {
    return `${charset}-${type}`;
}

function getVariantById(id) {
    return VARIANTS.find((variant) => variant.id === id) || null;
}

function getFontFileName(charset, type) {
    let fileName = 'MinecraftFont';

    if (charset === 'custom') {
        fileName += '_Custom';
    } else if (charset !== 'full') {
        fileName += `_${charset.toUpperCase()}`;
    }

    if (type === 'bold') {
        fileName += '_Bold';
    }

    return `${fileName}.woff2`;
}

class FontBuildService {
    constructor(options = {}) {
        this.logger = options.logger || logger;
        this.initialized = false;
        this.charDataCache = new Map();
        this.svgCache = new Map();
    }

    invalidate() {
        this.charDataCache.clear();
        this.svgCache.clear();
    }

    invalidateCustom() {
        for (const key of Array.from(this.charDataCache.keys())) {
            if (key.startsWith('custom:')) {
                this.charDataCache.delete(key);
            }
        }

        for (const key of Array.from(this.svgCache.keys())) {
            if (key.startsWith('custom-')) {
                this.svgCache.delete(key);
            }
        }
    }

    async init() {
        if (this.initialized) {
            return;
        }

        await FontBuilder.init();
        this.initialized = true;
    }

    async loadCharData(charset, options = {}) {
        const normalizedCustomText = normalizeCustomText(options.customText || '');
        const cacheKey = charset === 'custom'
            ? `custom:${getCustomTextHash(normalizedCustomText)}`
            : charset;

        if (this.charDataCache.has(cacheKey)) {
            return this.charDataCache.get(cacheKey);
        }

        if (charset === 'custom') {
            if (!normalizedCustomText) {
                throw new Error('Custom variant needs at least one character.');
            }

            const fullCharData = await this.loadCharData('full');
            const requestedChars = new Set(Array.from(normalizedCustomText));
            const charDataList = fullCharData.filter((charData) => requestedChars.has(charData.unicode));

            if (charDataList.length === 0) {
                throw new Error('No matching glyphs found for custom input.');
            }

            this.charDataCache.set(cacheKey, charDataList);
            return charDataList;
        }

        const fontLoader = new FontLoader(charset);
        const charDataList = await fontLoader.loadAll();
        if (!charDataList || charDataList.length === 0) {
            throw new Error(`No character data loaded for charset: ${charset}`);
        }

        this.charDataCache.set(cacheKey, charDataList);
        return charDataList;
    }

    async generateSvg(charset, type, options = {}) {
        const normalizedCustomText = normalizeCustomText(options.customText || '');
        const cacheKey = charset === 'custom'
            ? `${getVariantId(charset, type)}:${getCustomTextHash(normalizedCustomText)}`
            : getVariantId(charset, type);

        if (this.svgCache.has(cacheKey)) {
            return this.svgCache.get(cacheKey);
        }

        const isBold = type === 'bold';
        const charDataList = await this.loadCharData(charset, { customText: normalizedCustomText });
        const svgContent = SvgGenerator.generate(charDataList, isBold);

        this.svgCache.set(cacheKey, svgContent);
        return svgContent;
    }

    async buildVariant(variant, options = {}) {
        const normalizedVariant = typeof variant === 'string' ? getVariantById(variant) : variant;
        if (!normalizedVariant) {
            throw new Error(`Unknown font variant: ${variant}`);
        }

        const { charset, type } = normalizedVariant;
        const isBold = type === 'bold';
        const fileName = getFontFileName(charset, type);
        const outputPath = path.join(CONFIG.paths.dist, fileName);
        const startedAt = Date.now();

        await this.init();

        if (!fs.existsSync(CONFIG.paths.dist)) {
            fs.mkdirSync(CONFIG.paths.dist, { recursive: true });
        }

        this.logger.info(`[${normalizedVariant.id}] Generating SVG path data...`);
        const customText = normalizeCustomText(options.customText || '');
        const svgContent = await this.generateSvg(charset, type, { customText });

        this.logger.info(`[${normalizedVariant.id}] Building font file (WASM)...`);
        const fontObj = FontBuilder.createFont(svgContent);
        FontBuilder.setMetadata(fontObj, isBold);
        FontBuilder.writeWOFF2(fontObj, outputPath);

        return {
            ...normalizedVariant,
            fileName,
            outputPath,
            durationMs: Date.now() - startedAt,
            customText: charset === 'custom' ? customText : null,
            customCharCount: charset === 'custom' ? Array.from(customText).length : null
        };
    }

    async buildVariants(variantIds, options = {}) {
        const results = [];

        for (const variantId of variantIds) {
            results.push(await this.buildVariant(variantId, options));
        }

        return results;
    }
}

module.exports = {
    FontBuildService,
    VARIANTS,
    getFontFileName,
    getVariantById,
    getVariantId,
    normalizeCustomText
};

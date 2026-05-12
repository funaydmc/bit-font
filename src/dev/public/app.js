const VARIANT_GROUPS = [
    { id: 'full', label: 'Full', normal: 'full-normal', bold: 'full-bold' },
    { id: 'ascii', label: 'ASCII', normal: 'ascii-normal', bold: 'ascii-bold' },
    { id: 'vi', label: 'Vietnamese', normal: 'vi-normal', bold: 'vi-bold' },
    { id: 'custom', label: 'Custom', normal: 'custom-normal', bold: 'custom-bold' }
];

const BUILD_CONFIG_FIELDS = [
    { key: 'unitsPerEm', label: 'Units/em', step: 1 },
    { key: 'pixelSize', label: 'Pixel size', step: 1 },
    { key: 'fontHeight', label: 'Font height', step: 1 },
    { key: 'unifontHeight', label: 'Unifont height', step: 1 },
    { key: 'unifontAscent', label: 'Unifont ascent', step: 1 },
    { key: 'defaultAscent', label: 'Default ascent', step: 1 },
    { key: 'yOffset', label: 'Y offset', step: 0.1 }
];

const state = {
    variants: [],
    fontSize: 36,
    customText: '',
    boldPreview: false,
    detailPreview: false,
    autoRebuild: true,
    buildConfig: {}
};

const variantList = document.getElementById('variantList');
const specimens = document.getElementById('specimens');
const configBox = document.getElementById('configBox');
const glyphCanvas = document.getElementById('glyphCanvas');
const glyphMetrics = document.getElementById('glyphMetrics');
const fontFaces = document.getElementById('fontFaces');
const customText = document.getElementById('customText');
const customSummary = document.getElementById('customSummary');
const detailPreview = document.getElementById('detailPreview');
const autoRebuild = document.getElementById('autoRebuild');
const boldPreview = document.getElementById('boldPreview');
const fontSize = document.getElementById('fontSize');
const fontSizeNumber = document.getElementById('fontSizeNumber');
const rebuildButton = document.getElementById('rebuildButton');
const connectionStatus = document.getElementById('connectionStatus');
const buildSummary = document.getElementById('buildSummary');
let customSaveTimer = null;
let configSaveTimer = null;
let measureTimer = null;
let glyphHitboxes = [];

function statusLabel(status) {
    const labels = {
        idle: 'Chờ',
        building: 'Đang build',
        ready: 'Sẵn sàng',
        error: 'Lỗi'
    };

    return labels[status] || status;
}

function cssFamily(variantId) {
    return `BitFont-${variantId}`;
}

function getVariant(id) {
    return state.variants.find((variant) => variant.id === id) || null;
}

function selectedGroup() {
    return VARIANT_GROUPS.find((group) => {
        return getVariant(group.normal)?.selected || getVariant(group.bold)?.selected;
    }) || null;
}

function variantIdForGroup(group) {
    return state.boldPreview ? group.bold : group.normal;
}

function selectedVariant() {
    const group = selectedGroup();
    return group ? getVariant(variantIdForGroup(group)) : null;
}

function saveCurrentSelection() {
    const group = selectedGroup() || VARIANT_GROUPS.find((item) => item.id === 'custom') || VARIANT_GROUPS[0];
    saveSelection([variantIdForGroup(group)], state.customText, state.autoRebuild, state.buildConfig);
}

function updateFontFaces() {
    const css = state.variants
        .filter((variant) => variant.selected && variant.status === 'ready')
        .map((variant) => {
            const weight = variant.type === 'bold' ? 700 : 400;
            return `@font-face{font-family:"${cssFamily(variant.id)}";src:url("${variant.url}") format("woff2");font-weight:${weight};font-style:normal;font-display:block;}`;
        })
        .join('\n');

    fontFaces.textContent = css;
}

function updateSummary() {
    const variant = selectedVariant();

    if (!variant) {
        buildSummary.textContent = 'Chưa chọn variant';
        rebuildButton.disabled = false;
        return;
    }

    buildSummary.textContent = statusLabel(variant.status);
    rebuildButton.disabled = variant.status === 'building';
}

function uniqueChars(text) {
    return Array.from(new Set(Array.from(text))).join('');
}

function updateCustomSummary() {
    const count = Array.from(uniqueChars(state.customText)).length;
    customSummary.textContent = `${count} ký tự duy nhất`;
}

function renderConfigControls() {
    configBox.replaceChildren();

    const title = document.createElement('div');
    title.className = 'configTitle';
    title.textContent = 'Build config';

    const grid = document.createElement('div');
    grid.className = 'configGrid';

    for (const field of BUILD_CONFIG_FIELDS) {
        const label = document.createElement('label');
        label.htmlFor = `config-${field.key}`;
        label.textContent = field.label;

        const input = document.createElement('input');
        input.id = `config-${field.key}`;
        input.type = 'number';
        input.step = String(field.step);
        input.value = state.buildConfig[field.key] ?? '';
        input.addEventListener('input', () => {
            state.buildConfig[field.key] = Number(input.value);
            clearTimeout(configSaveTimer);
            configSaveTimer = setTimeout(() => {
                saveCurrentSelection();
            }, 350);
        });

        grid.append(label, input);
    }

    configBox.append(title, grid);
}

function formatMetric(value) {
    return Number.isFinite(value) ? `${Math.round(value * 100) / 100}px` : '-';
}

function renderMetricItems(items) {
    glyphMetrics.replaceChildren();

    for (const [label, value] of items) {
        const item = document.createElement('div');
        item.className = 'metricItem';

        const name = document.createElement('span');
        name.textContent = label;

        const result = document.createElement('strong');
        result.textContent = value;

        item.append(name, result);
        glyphMetrics.append(item);
    }
}

function clearMetrics(message = '') {
    const ctx = glyphCanvas.getContext('2d');
    ctx.clearRect(0, 0, glyphCanvas.width, glyphCanvas.height);
    glyphHitboxes = [];
    renderMetricItems(message ? [['Trạng thái', message]] : []);
}

function measureChar(ctx, char, fontCss, baseline, canvasSize) {
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.font = fontCss;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#111';
    ctx.fillText(char, 16, baseline);

    const data = ctx.getImageData(0, 0, canvasSize, canvasSize).data;
    let minX = canvasSize;
    let minY = canvasSize;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvasSize; y++) {
        for (let x = 0; x < canvasSize; x++) {
            const alpha = data[((y * canvasSize + x) * 4) + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX === -1) {
        return null;
    }

    return {
        left: minX - 16,
        top: minY - baseline,
        height: maxY - minY + 1,
        aboveBaseline: baseline - minY,
        belowBaseline: maxY - baseline,
        width: maxX - minX + 1
    };
}

function drawDimensionLine(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (x1 === x2) {
        ctx.beginPath();
        ctx.moveTo(x1 - 4, y1);
        ctx.lineTo(x1 + 4, y1);
        ctx.moveTo(x2 - 4, y2);
        ctx.lineTo(x2 + 4, y2);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1 - 4);
        ctx.lineTo(x1, y1 + 4);
        ctx.moveTo(x2, y2 - 4);
        ctx.lineTo(x2, y2 + 4);
        ctx.stroke();
    }

    ctx.restore();
}

function drawGlyphGuide(ctx, metric, x, y, cellWidth, cellHeight, drawX, baseline) {
    const bboxX = drawX + metric.left;
    const bboxY = baseline + metric.top;
    const bboxW = metric.width;
    const bboxH = metric.height;
    const bboxBottom = bboxY + bboxH;
    const widthY = Math.min(y + cellHeight - 7, bboxBottom + 10);

    ctx.save();
    ctx.lineWidth = 1;

    ctx.strokeStyle = '#2274a5';
    ctx.beginPath();
    ctx.moveTo(x + 4, baseline + 0.5);
    ctx.lineTo(x + cellWidth - 4, baseline + 0.5);
    ctx.stroke();

    ctx.strokeStyle = '#e07a2f';
    ctx.strokeRect(bboxX + 0.5, bboxY + 0.5, bboxW, bboxH);

    drawDimensionLine(ctx, bboxX, widthY, bboxX + bboxW, widthY, '#7048e8');

    ctx.restore();
}

async function measureGlyphs() {
    const variant = selectedVariant();
    if (!variant || variant.status !== 'ready') {
        clearMetrics();
        return;
    }

    const chars = Array.from(uniqueChars(state.customText)).filter((char) => char !== '\n' && char !== '\r');
    if (chars.length === 0) {
        clearMetrics('Không có ký tự để đo');
        return;
    }

    const family = cssFamily(variant.id);
    const fontCss = `${state.boldPreview ? 700 : 400} ${state.fontSize}px "${family}", monospace`;
    await document.fonts.load(fontCss);

    const visibleCanvasWidth = Math.max(320, glyphCanvas.clientWidth || 640);
    const cellWidth = Math.max(74, Math.ceil(state.fontSize * 2.2));
    const cellHeight = Math.max(68, Math.ceil(state.fontSize * 2.5));
    const columns = Math.max(1, Math.floor(visibleCanvasWidth / cellWidth));
    const rows = Math.ceil(chars.length / columns);
    const dpr = window.devicePixelRatio || 1;

    glyphCanvas.width = Math.ceil(visibleCanvasWidth * dpr);
    glyphCanvas.height = Math.ceil(rows * cellHeight * dpr);
    glyphCanvas.style.height = `${rows * cellHeight}px`;

    const ctx = glyphCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, visibleCanvasWidth, rows * cellHeight);
    ctx.font = fontCss;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#111';

    const measureCanvas = document.createElement('canvas');
    const measureSize = Math.max(96, Math.ceil(state.fontSize * 4));
    const baseline = Math.ceil(measureSize * 0.62);
    measureCanvas.width = measureSize;
    measureCanvas.height = measureSize;
    const measureCtx = measureCanvas.getContext('2d');

    const metrics = [];
    let spaceWidth = null;
    glyphHitboxes = [];

    chars.forEach((char, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = col * cellWidth;
        const y = row * cellHeight;
        const drawBaseline = y + Math.ceil(cellHeight * 0.68);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1);
        ctx.fillText(char, x + 8, drawBaseline);

        const hitbox = {
            char,
            x,
            y,
            width: cellWidth,
            height: cellHeight,
            metric: null,
            spaceWidth: null
        };

        if (char === ' ') {
            spaceWidth = ctx.measureText(' ').width;
            drawDimensionLine(ctx, x + 8, drawBaseline + 10, x + 8 + spaceWidth, drawBaseline + 10, '#7048e8');
            hitbox.spaceWidth = spaceWidth;
            glyphHitboxes.push(hitbox);
            return;
        }

        const metric = measureChar(measureCtx, char, fontCss, baseline, measureSize);
        if (metric) {
            metrics.push(metric);
            drawGlyphGuide(ctx, metric, x, y, cellWidth, cellHeight, x + 8, drawBaseline);
            hitbox.metric = metric;
        }
        glyphHitboxes.push(hitbox);
    });

    if (spaceWidth === null) {
        spaceWidth = ctx.measureText(' ').width;
    }

    renderMetricItems([]);
}

function scheduleGlyphMeasure() {
    clearTimeout(measureTimer);
    measureTimer = setTimeout(() => {
        measureGlyphs().catch((error) => {
            clearMetrics(error.message);
        });
    }, 50);
}

function renderSampleText(sample) {
    sample.replaceChildren();

    if (!state.detailPreview) {
        sample.textContent = state.customText;
        return;
    }

    const colors = [
        '#fff2a8',
        '#c8f7dc',
        '#cfe8ff',
        '#ffd6d6',
        '#e8d7ff',
        '#d8f3f2'
    ];

    Array.from(state.customText).forEach((char, index) => {
        const span = document.createElement('span');
        span.className = char === ' ' ? 'sampleChar space' : 'sampleChar';
        span.textContent = char === '\n' ? '\n' : char;
        span.style.backgroundColor = char === '\n' ? 'transparent' : colors[index % colors.length];
        sample.append(span);
    });
}

function renderVariants() {
    const currentGroup = selectedGroup();
    variantList.replaceChildren();

    for (const group of VARIANT_GROUPS) {
        const variant = getVariant(variantIdForGroup(group));
        const row = document.createElement('div');
        row.className = 'variantRow';

        const top = document.createElement('div');
        top.className = 'variantTop';

        const label = document.createElement('label');
        label.className = 'checkLabel';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'variantGroup';
        radio.checked = currentGroup?.id === group.id;
        radio.addEventListener('change', () => {
            if (radio.checked) {
            saveSelection([variantIdForGroup(group)], state.customText, state.autoRebuild, state.buildConfig);
            }
        });

        const name = document.createElement('span');
        name.className = 'variantName';
        name.textContent = group.label;

        label.append(radio, name);

        const badge = document.createElement('span');
        badge.className = `badge ${variant?.status || 'idle'}`;
        badge.textContent = statusLabel(variant?.status || 'idle');

        top.append(label, badge);

        const meta = document.createElement('div');
        meta.className = 'variantMeta';

        const file = document.createElement('span');
        file.textContent = variant?.fileName || '';

        const time = document.createElement('span');
        time.textContent = variant?.durationMs ? `${variant.durationMs}ms` : 'chưa build';

        meta.append(file, time);

        if (variant?.error) {
            const error = document.createElement('span');
            error.className = 'badge error';
            error.textContent = variant.error;
            meta.append(error);
        }

        row.append(top, meta);
        variantList.append(row);
    }
}

function renderSpecimens() {
    specimens.replaceChildren();

    const group = selectedGroup();
    const variant = selectedVariant();

    if (!group || !variant || variant.status !== 'ready') {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Chọn variant và build để xem trước font.';
        specimens.append(empty);
        scheduleGlyphMeasure();
        return;
    }

    const item = document.createElement('article');
    item.className = 'specimen';

    const header = document.createElement('div');
    header.className = 'specimenHeader';

    const title = document.createElement('strong');
    title.textContent = `${group.label} ${state.boldPreview ? 'Bold' : 'Regular'}`;

    const file = document.createElement('span');
    file.textContent = variant.fileName;

    header.append(title, file);

    const sample = document.createElement('div');
    sample.className = 'sample';
    if (state.detailPreview) {
        sample.classList.add('detail');
    }
    sample.style.fontFamily = `"${cssFamily(variant.id)}", monospace`;
    sample.style.fontSize = `${state.fontSize}px`;
    sample.style.fontWeight = state.boldPreview ? '700' : '400';
    renderSampleText(sample);

    item.append(header, sample);
    specimens.append(item);
    scheduleGlyphMeasure();
}

function render() {
    updateFontFaces();
    updateSummary();
    updateCustomSummary();
    renderConfigControls();
    renderVariants();
    renderSpecimens();
}

async function loadState() {
    const response = await fetch('/api/state');
    if (!response.ok) {
        throw new Error('Không thể tải trạng thái dev server');
    }

    applyState(await response.json());
}

function applyState(nextState) {
    state.variants = nextState.variants || [];
    state.customText = nextState.customText || '';
    state.autoRebuild = nextState.autoRebuild !== false;
    state.buildConfig = nextState.buildConfig || {};
    autoRebuild.checked = state.autoRebuild;
    if (document.activeElement !== customText) {
        customText.value = state.customText;
    }
    render();
}

async function saveSelection(
    selected,
    nextCustomText = state.customText,
    nextAutoRebuild = state.autoRebuild,
    nextBuildConfig = state.buildConfig
) {
    const response = await fetch('/api/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            selected,
            customText: nextCustomText,
            autoRebuild: nextAutoRebuild,
            buildConfig: nextBuildConfig
        })
    });

    if (!response.ok) {
        connectionStatus.textContent = 'Không lưu được variant';
        return;
    }

    applyState(await response.json());
}

async function rebuild() {
    rebuildButton.disabled = true;
    await fetch('/api/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customText: state.customText,
            autoRebuild: state.autoRebuild,
            buildConfig: state.buildConfig
        })
    });
}

function connectEvents() {
    const events = new EventSource('/events');

    events.addEventListener('open', () => {
        connectionStatus.textContent = 'Đã kết nối';
    });

    events.addEventListener('state', (event) => {
        connectionStatus.textContent = 'Đã đồng bộ';
        applyState(JSON.parse(event.data));
    });

    events.addEventListener('error', () => {
        connectionStatus.textContent = 'Mất kết nối';
    });
}

customText.addEventListener('input', () => {
    state.customText = customText.value;
    updateCustomSummary();
    renderSpecimens();

    clearTimeout(customSaveTimer);
    customSaveTimer = setTimeout(() => {
        saveCurrentSelection();
    }, 350);
});

boldPreview.addEventListener('change', () => {
    state.boldPreview = boldPreview.checked;
    saveCurrentSelection();
});

autoRebuild.addEventListener('change', () => {
    state.autoRebuild = autoRebuild.checked;
    saveCurrentSelection();
});

detailPreview.addEventListener('change', () => {
    state.detailPreview = detailPreview.checked;
    renderSpecimens();
});

fontSize.addEventListener('input', () => {
    state.fontSize = Number(fontSize.value);
    fontSizeNumber.value = String(state.fontSize);
    renderSpecimens();
});

fontSizeNumber.addEventListener('input', () => {
    const min = Number(fontSizeNumber.min);
    const max = Number(fontSizeNumber.max);
    const nextSize = Math.min(max, Math.max(min, Number(fontSizeNumber.value) || min));

    state.fontSize = nextSize;
    fontSize.value = String(nextSize);
    renderSpecimens();
});

glyphCanvas.addEventListener('click', (event) => {
    const rect = glyphCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hitbox = glyphHitboxes.find((item) => {
        return x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height;
    });

    if (!hitbox) {
        renderMetricItems([]);
        return;
    }

    if (hitbox.char === ' ') {
        renderMetricItems([
            ['Ký tự', 'space'],
            ['Chiều rộng dấu cách', formatMetric(hitbox.spaceWidth)]
        ]);
        return;
    }

    if (!hitbox.metric) {
        renderMetricItems([['Ký tự', hitbox.char], ['Trạng thái', 'Không có pixel mực']]);
        return;
    }

    renderMetricItems([
        ['Ký tự', hitbox.char],
        ['Trên baseline', formatMetric(hitbox.metric.aboveBaseline)],
        ['Dưới baseline', formatMetric(hitbox.metric.belowBaseline)],
        ['Chiều rộng', formatMetric(hitbox.metric.width)],
        ['Chiều cao bbox', formatMetric(hitbox.metric.height)]
    ]);
});

rebuildButton.addEventListener('click', rebuild);

state.customText = customText.value;
state.fontSize = Number(fontSize.value);
state.detailPreview = detailPreview.checked;
state.autoRebuild = autoRebuild.checked;
state.boldPreview = boldPreview.checked;
fontSizeNumber.value = String(state.fontSize);
loadState().catch((error) => {
    connectionStatus.textContent = error.message;
});
connectEvents();

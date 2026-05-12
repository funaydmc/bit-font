const VARIANT_GROUPS = [
    { id: 'full', label: 'Full', normal: 'full-normal', bold: 'full-bold' },
    { id: 'vi', label: 'Vietnamese', normal: 'vi-normal', bold: 'vi-bold' },
    { id: 'custom', label: 'Custom', normal: 'custom-normal', bold: 'custom-bold' }
];

const state = {
    variants: [],
    fontSize: 36,
    customText: '',
    boldPreview: false
};

const variantList = document.getElementById('variantList');
const specimens = document.getElementById('specimens');
const fontFaces = document.getElementById('fontFaces');
const customText = document.getElementById('customText');
const customSummary = document.getElementById('customSummary');
const boldPreview = document.getElementById('boldPreview');
const fontSize = document.getElementById('fontSize');
const fontSizeNumber = document.getElementById('fontSizeNumber');
const rebuildButton = document.getElementById('rebuildButton');
const connectionStatus = document.getElementById('connectionStatus');
const buildSummary = document.getElementById('buildSummary');
let customSaveTimer = null;

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
    saveSelection([variantIdForGroup(group)], state.customText);
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
                saveSelection([variantIdForGroup(group)], state.customText);
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
    sample.textContent = state.customText;
    sample.style.fontFamily = `"${cssFamily(variant.id)}", monospace`;
    sample.style.fontSize = `${state.fontSize}px`;
    sample.style.fontWeight = state.boldPreview ? '700' : '400';

    item.append(header, sample);
    specimens.append(item);
}

function render() {
    updateFontFaces();
    updateSummary();
    updateCustomSummary();
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
    if (document.activeElement !== customText) {
        customText.value = state.customText;
    }
    render();
}

async function saveSelection(selected, nextCustomText = state.customText) {
    const response = await fetch('/api/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected, customText: nextCustomText })
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
        body: JSON.stringify({ customText: state.customText })
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

rebuildButton.addEventListener('click', rebuild);

state.customText = customText.value;
state.fontSize = Number(fontSize.value);
state.boldPreview = boldPreview.checked;
fontSizeNumber.value = String(state.fontSize);
loadState().catch((error) => {
    connectionStatus.textContent = error.message;
});
connectEvents();

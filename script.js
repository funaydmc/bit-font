// DOM Elements
const textarea = document.getElementById('preview-text');
const itemLore = document.querySelector('.item-lore');
const shadowToggle = document.getElementById('shadow-toggle');

// Shadow toggle functionality
let shadowEnabled = false;

if (shadowToggle && itemLore) {
    shadowToggle.addEventListener('click', () => {
        shadowEnabled = !shadowEnabled;
        
        if (shadowEnabled) {
            itemLore.classList.add('mc_shadow');
            shadowToggle.textContent = 'Disable Minecraft Shadow';
            shadowToggle.classList.add('active');
        } else {
            itemLore.classList.remove('mc_shadow');
            shadowToggle.textContent = 'Enable Minecraft Shadow';
            shadowToggle.classList.remove('active');
        }
    });
}

// MiniMessage Parser
class MiniMessageParser {
    constructor() {
        // Minecraft color mappings
        this.colors = {
            'black': '#000000',
            'dark_blue': '#0000AA',
            'dark_green': '#00AA00',
            'dark_aqua': '#00AAAA',
            'dark_red': '#AA0000',
            'dark_purple': '#AA00AA',
            'gold': '#FFAA00',
            'gray': '#AAAAAA',
            'grey': '#AAAAAA',
            'dark_gray': '#555555',
            'dark_grey': '#555555',
            'blue': '#5555FF',
            'green': '#55FF55',
            'aqua': '#55FFFF',
            'red': '#FF5555',
            'light_purple': '#FF55FF',
            'yellow': '#FFFF55',
            'white': '#FFFFFF'
        };

        // Decoration mappings (aliases)
        this.decorations = {
            'bold': 'b',
            'b': 'b',
            'italic': 'i',
            'i': 'i',
            'em': 'i',
            'underlined': 'u',
            'underline': 'u',
            'u': 'u',
            'strikethrough': 's',
            'st': 's',
            'obfuscated': 'obf',
            'obf': 'obf'
        };
    }

    parse(text) {
        // Stack to track open tags
        const stack = [];
        let result = '';
        let i = 0;

        while (i < text.length) {
            if (text[i] === '<') {
                const closeIdx = text.indexOf('>', i);
                if (closeIdx === -1) {
                    result += '&lt;';
                    i++;
                    continue;
                }

                const tagContent = text.substring(i + 1, closeIdx);
                const parsedTag = this.parseTag(tagContent);

                if (parsedTag) {
                    if (parsedTag.type === 'close') {
                        result += this.closeTag(stack, parsedTag.name);
                    } else if (parsedTag.type === 'reset') {
                        result += this.closeAll(stack);
                    } else {
                        result += this.openTag(stack, parsedTag);
                    }
                    i = closeIdx + 1;
                } else {
                    result += '&lt;';
                    i++;
                }
            } else if (text[i] === '\n') {
                result += '<br>';
                i++;
            } else if (text[i] === '&') {
                result += '&amp;';
                i++;
            } else {
                result += text[i];
                i++;
            }
        }

        // Close all remaining tags
        result += this.closeAll(stack);

        return result;
    }

    parseTag(content) {
        // Handle closing tags
        if (content.startsWith('/')) {
            const name = content.substring(1).trim();
            return { type: 'close', name };
        }

        // Handle reset
        if (content === 'reset') {
            return { type: 'reset' };
        }

        // Check for hex color #RRGGBB
        if (/^#[0-9A-Fa-f]{6}$/.test(content)) {
            return {
                type: 'color',
                value: content.toUpperCase(),
                original: content
            };
        }

        // Check for verbose color format: color:name or c:name
        const verboseMatch = content.match(/^(?:color|colour|c):(.+)$/);
        if (verboseMatch) {
            const colorValue = verboseMatch[1].trim();
            // Check if it's a hex color
            if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
                return {
                    type: 'color',
                    value: colorValue.toUpperCase(),
                    original: content
                };
            }
            // Check if it's a named color
            if (this.colors[colorValue]) {
                return {
                    type: 'color',
                    value: this.colors[colorValue],
                    original: content
                };
            }
        }

        // Check for named color
        if (this.colors[content]) {
            return {
                type: 'color',
                value: this.colors[content],
                original: content
            };
        }

        // Check for decoration
        if (this.decorations[content]) {
            return {
                type: 'decoration',
                name: this.decorations[content],
                original: content
            };
        }

        return null;
    }

    openTag(stack, tag) {
        stack.push(tag);

        if (tag.type === 'color') {
            return `<span style="color: ${tag.value}">`;
        } else if (tag.type === 'decoration') {
            if (tag.name === 'obf') {
                return '<span class="obfuscated">';
            } else {
                return `<${tag.name}>`;
            }
        }

        return '';
    }

    closeTag(stack, name) {
        // Find matching tag in stack
        let found = -1;
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].original === name ||
                (stack[i].type === 'decoration' && stack[i].name === this.decorations[name]) ||
                (stack[i].type === 'color' && (stack[i].original === name || this.colors[name] === stack[i].value))) {
                found = i;
                break;
            }
        }

        if (found === -1) {
            return ''; // Tag not found in stack
        }

        // Close all tags from end to found position
        let result = '';
        const toReopen = [];

        for (let i = stack.length - 1; i >= found; i--) {
            const tag = stack[i];
            if (tag.type === 'color' || tag.name === 'obf') {
                result += '</span>';
            } else if (tag.type === 'decoration') {
                result += `</${tag.name}>`;
            }

            if (i > found) {
                toReopen.unshift(tag);
            }
        }

        // Remove closed tags from stack
        stack.splice(found);

        // Reopen tags that were closed
        for (const tag of toReopen) {
            result += this.openTag(stack, tag);
        }

        return result;
    }

    closeAll(stack) {
        let result = '';
        while (stack.length > 0) {
            const tag = stack.pop();
            if (tag.type === 'color' || tag.name === 'obf') {
                result += '</span>';
            } else if (tag.type === 'decoration') {
                result += `</${tag.name}>`;
            }
        }
        return result;
    }
}

// Initialize parser
const parser = new MiniMessageParser();

// Obfuscated text management
let obfuscatedInterval = null;
const obfuscatedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

function randomizeObfuscated() {
    const obfElements = itemLore.querySelectorAll('.obfuscated');
    obfElements.forEach(el => {
        // Store original text if not stored
        if (!el.dataset.original) {
            el.dataset.original = el.textContent;
        }

        const originalText = el.dataset.original;
        const randomized = originalText
            .split('')
            .map(char => {
                if (char === ' ') return ' ';
                return obfuscatedChars[Math.floor(Math.random() * obfuscatedChars.length)];
            })
            .join('');

        el.textContent = randomized;
    });
}

function startObfuscatedAnimation() {
    // Clear existing interval
    if (obfuscatedInterval) {
        clearInterval(obfuscatedInterval);
    }

    // Start new interval
    obfuscatedInterval = setInterval(randomizeObfuscated, 50);
}

// Update item lore content from textarea
function updateItemLore() {
    const content = textarea.value;
    itemLore.innerHTML = parser.parse(content);

    // Check if there are obfuscated elements
    const hasObfuscated = itemLore.querySelectorAll('.obfuscated').length > 0;

    if (hasObfuscated) {
        startObfuscatedAnimation();
    } else if (obfuscatedInterval) {
        clearInterval(obfuscatedInterval);
        obfuscatedInterval = null;
    }
}

// Event listener
textarea.addEventListener('input', updateItemLore);

// Initialize
updateItemLore();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (obfuscatedInterval) {
        clearInterval(obfuscatedInterval);
    }
});

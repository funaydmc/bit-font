const textarea = document.getElementById('preview-text');
const itemLore = document.querySelector('.item-lore');
const controls = {
    bold: document.getElementById('bold-check'),
    italic: document.getElementById('italic-check'),
    underline: document.getElementById('underline-check'),
    strikethrough: document.getElementById('strikethrough-check')
};

function updateStyles() {
    if (controls.bold.checked) {
        textarea.classList.add('is-bold');
        itemLore.classList.add('is-bold');
    } else {
        textarea.classList.remove('is-bold');
        itemLore.classList.remove('is-bold');
    }

    if (controls.italic.checked) {
        textarea.classList.add('is-italic');
        itemLore.classList.add('is-italic');
    } else {
        textarea.classList.remove('is-italic');
        itemLore.classList.remove('is-italic');
    }

    // Handle decorations completely
    textarea.classList.remove('is-underline', 'is-strikethrough');
    itemLore.classList.remove('is-underline', 'is-strikethrough');

    if (controls.underline.checked) {
        textarea.classList.add('is-underline');
        itemLore.classList.add('is-underline');
    }
    if (controls.strikethrough.checked) {
        textarea.classList.add('is-strikethrough');
        itemLore.classList.add('is-strikethrough');
    }
}

function updateItemLore() {
    // Copy textarea content to item-lore and render HTML tags
    // Convert newlines to <br> tags for proper line breaks
    const content = textarea.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    // Now convert back the HTML tags we want to support
    const htmlContent = content
        .replace(/&lt;b&gt;/g, '<b>')
        .replace(/&lt;\/b&gt;/g, '</b>')
        .replace(/&lt;i&gt;/g, '<i>')
        .replace(/&lt;\/i&gt;/g, '</i>')
        .replace(/&lt;u&gt;/g, '<u>')
        .replace(/&lt;\/u&gt;/g, '</u>')
        .replace(/&lt;s&gt;/g, '<s>')
        .replace(/&lt;\/s&gt;/g, '</s>')
        .replace(/&lt;yellow&gt;/g, '<yellow>')
        .replace(/&lt;\/yellow&gt;/g, '</yellow>');

    itemLore.innerHTML = htmlContent;
}

// Add event listeners for checkboxes
Object.values(controls).forEach(input => {
    input.addEventListener('change', updateStyles);
});

// Add event listener for textarea input
textarea.addEventListener('input', updateItemLore);

// Initialize item-lore content
updateItemLore();

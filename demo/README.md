# Minecraft Font Demo

This demo page showcases the Minecraft custom font with support for MiniMessage formatting and text shadow effects.

## Features

- **Custom Minecraft Font**: Uses the authentic Minecraft bitmap font
- **MiniMessage Support**: Format text with colors, styles, and decorations
- **Text Shadow**: Toggle Minecraft-style text shadow for authentic look

## Text Shadow

The `mc_shadow` CSS class adds an authentic Minecraft text shadow effect to the text. Click the "Toggle Shadow" button to enable/disable the shadow.

### Shadow Effect Comparison

**With Shadow Enabled:**

![Minecraft Font with Shadow](https://github.com/user-attachments/assets/99b3c3ab-11ec-4121-b0d9-198a5ce6db35)

The shadow mimics the exact shadow rendering used in Minecraft, offset by 1/8em to the bottom-right with a dark gray color (#3F3F3F).

## Usage

### CSS Class

To add the Minecraft shadow effect to any text element, simply add the `mc_shadow` class:

```css
.mc_shadow {
    text-shadow: 0.125em 0.125em 0 rgba(63, 63, 63, 1);
}
```

### HTML Example

```html
<div class="item-lore mc_shadow">
    Your text here
</div>
```

### JavaScript Toggle

```javascript
element.classList.toggle('mc_shadow');
```

## Supported Colors

- black, dark_blue, dark_green, dark_aqua, dark_red, dark_purple
- gold, gray, dark_gray, blue, green, aqua, red, light_purple, yellow, white

## Supported Decorations

- `<bold>` or `<b>` - Bold text
- `<italic>` or `<i>` - Italic text
- `<u>` - Underlined text
- `<st>` - Strikethrough text
- `<obf>` - Obfuscated (animated) text

## License

Font assets are from Minecraft by Mojang Studios.

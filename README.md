# Minecraft Font Tester

A web-based tool for testing and previewing Minecraft-style fonts with MiniMessage format support.

## Features

- **MiniMessage Format Support**: Use tags like `<red>`, `<bold>`, `<italic>`, etc.
- **Hex Color Support**: Custom colors with `<#FF5555>` format
- **Text Decorations**: Bold, italic, underline, strikethrough
- **Obfuscated Text**: Animated random characters with `<obf>` tag
- **Minecraft Text Shadow**: Toggle authentic Minecraft-style text shadow

## Minecraft Text Shadow

The `mc_shadow` CSS class provides an accurate simulation of Minecraft's text shadow effect. You can toggle it on the demo page using the "Enable Minecraft Shadow" button.

The shadow is implemented using:
- **1px offset** (down and right) - matching Minecraft's exact rendering
- **#3F3F3F color** (RGB 63,63,63) - following Minecraft's shadow formula (original color ÷ 4)
- **No blur** - for crisp, pixel-perfect shadow

### Without Shadow
![Without Shadow](https://github.com/user-attachments/assets/b9426b4a-dbe9-458d-b7ed-c93138c6ff24)

### With Shadow
![With Shadow](https://github.com/user-attachments/assets/3523ff6a-f129-42ff-a4af-58cd8435219f)

## Usage

1. Open `index.html` in a web browser
2. Type or paste your text with MiniMessage formatting in the left textarea
3. The formatted text will appear in the right panel
4. Click "Enable Minecraft Shadow" to add Minecraft-style text shadow

## MiniMessage Format Examples

```
<red>Red text</red>
<blue>Blue text</blue>
<bold>Bold text</bold>
<italic>Italic text</italic>
<#FF5555>Custom hex color</#FF5555>
<yellow><u>Underlined yellow</u></yellow>
<st>Strikethrough</st>
<obf>Obfuscated</obf>
```

## Font Files

The custom Minecraft font files are located in the `font/` directory:
- `MinecraftFont.woff2` - Regular weight
- `MinecraftFont-Bold.woff2` - Bold weight

## License

This project is open source and available for use.

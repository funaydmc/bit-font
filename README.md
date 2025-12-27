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

### Without Shadow
![Without Shadow](https://github.com/user-attachments/assets/c7cc3c86-6cde-4496-b7fd-0356028c1840)

### With Shadow
![With Shadow](https://github.com/user-attachments/assets/771f2f13-5378-4c23-88cd-d2ff5ac3bcf7)

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

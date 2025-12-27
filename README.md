# Minecraft Text Shadow Feature

## Tạo class CSS `mc_shadow` để bật shadow cho text

Tính năng này thêm class CSS `mc_shadow` để mô phỏng chính xác text shadow trong Minecraft.

### Demo Page Updates

Các thay đổi đã được áp dụng cho demo page (nhánh `demo`):

#### 1. CSS Class mới (`demo/text.css`)

```css
.mc_shadow {
    text-shadow: 0.125em 0.125em 0 rgba(63, 63, 63, 1);
}
```

Class này tạo shadow offset 1/8em xuống phía dưới và sang phải, với màu xám đậm (#3F3F3F) - giống hệt shadow trong Minecraft.

#### 2. Nút Toggle Shadow (`demo/index.html`)

Đã thêm nút "Toggle Shadow" trong phần controls để người dùng có thể bật/tắt shadow:

```html
<div class="controls">
    <button id="shadow-toggle" class="toggle-btn">Toggle Shadow</button>
</div>
```

#### 3. JavaScript Functionality (`demo/script.js`)

```javascript
shadowToggle.addEventListener('click', () => {
    shadowEnabled = !shadowEnabled;
    
    if (shadowEnabled) {
        itemLore.classList.add('mc_shadow');
        textarea.classList.add('mc_shadow');
        shadowToggle.classList.add('active');
    } else {
        itemLore.classList.remove('mc_shadow');
        textarea.classList.remove('mc_shadow');
        shadowToggle.classList.remove('active');
    }
});
```

#### 4. Styling (`demo/style.css`)

Đã thêm styling cho nút toggle với:
- Màu xanh lá mặc định
- Hiệu ứng hover
- Màu cam khi active (shadow đang bật)

### Screenshots

**Khi shadow được bật:**

![Minecraft Font with Shadow](https://github.com/user-attachments/assets/99b3c3ab-11ec-4121-b0d9-198a5ce6db35)

**Khi shadow bị tắt:**

![Minecraft Font without Shadow](https://github.com/user-attachments/assets/9ffe5b9e-5c56-4d89-add7-daa043076044)

### Cách áp dụng lên nhánh demo

Các file trong thư mục `demo/` cần được copy vào nhánh `demo`:
- `demo/index.html` → `index.html` (demo branch)
- `demo/style.css` → `style.css` (demo branch)
- `demo/text.css` → `text.css` (demo branch)
- `demo/script.js` → `script.js` (demo branch)
- `demo/README.md` → `README.md` (demo branch)

### Kiểm tra

Tính năng đã được test và hoạt động chính xác:
- ✅ Shadow hiển thị đúng khi toggle bật
- ✅ Shadow tắt hoàn toàn khi toggle tắt
- ✅ Nút đổi màu khi active/inactive
- ✅ Shadow áp dụng cho cả textarea và item-lore
- ✅ Shadow offset và màu sắc giống Minecraft

## Technical Details

Shadow sử dụng `text-shadow` với:
- **Offset**: 0.125em (tương đương 1 pixel ở font size 8px)
- **Màu**: rgba(63, 63, 63, 1) - màu xám đậm như trong Minecraft
- **Blur**: 0 - không có blur, giữ sharp edges như bitmap font

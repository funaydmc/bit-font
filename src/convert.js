function bitmapToSVGPath(bitmap) {
    if (!bitmap || bitmap.length === 0 || !bitmap[0]) return '';
    const rows = bitmap.length;
    const cols = bitmap[0].length;
    const edges = [];

    // 1. Tìm tất cả các cạnh biên hướng theo chiều kim đồng hồ (Clockwise)
    // Quy tắc: Luôn giữ phần "đặc" (bitmap=1) nằm bên phải hướng di chuyển vector.
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (bitmap[r][c] === 1) {
                // Cạnh trên: Đi từ trái sang phải
                if (r === 0 || bitmap[r - 1][c] === 0) edges.push([[c, r], [c + 1, r]]);
                // Cạnh phải: Đi từ trên xuống dưới
                if (c === cols - 1 || bitmap[r][c + 1] === 0) edges.push([[c + 1, r], [c + 1, r + 1]]);
                // Cạnh dưới: Đi từ phải sang trái
                if (r === rows - 1 || bitmap[r + 1][c] === 0) edges.push([[c + 1, r + 1], [c, r + 1]]);
                // Cạnh trái: Đi từ dưới lên trên
                if (c === 0 || bitmap[r][c - 1] === 0) edges.push([[c, r + 1], [c, r]]);
            }
        }
    }

    const pathParts = [];
    const visited = new Set();

    // 2. Nối các đoạn thẳng
    while (visited.size < edges.length) {
        let startEdgeIdx = -1;
        // Tìm cạnh chưa thăm làm điểm bắt đầu
        for (let i = 0; i < edges.length; i++) {
            if (!visited.has(i)) {
                startEdgeIdx = i;
                break;
            }
        }
        if (startEdgeIdx === -1) break;

        let currentLoop = [];
        let [currPoint, nextPoint] = edges[startEdgeIdx];

        currentLoop.push(currPoint);
        visited.add(startEdgeIdx);

        // Dò theo chuỗi liên kết
        while (true) {
            // Nếu điểm tiếp theo trùng với điểm khởi đầu của vòng lặp hiện tại -> Đã khép kín
            if (nextPoint[0] === currentLoop[0][0] && nextPoint[1] === currentLoop[0][1]) {
                break;
            }

            currentLoop.push(nextPoint);
            let foundNext = false;

            for (let i = 0; i < edges.length; i++) {
                if (!visited.has(i)) {
                    // Tìm cạnh bắt đầu tại nơi cạnh hiện tại kết thúc
                    if (edges[i][0][0] === nextPoint[0] && edges[i][0][1] === nextPoint[1]) {
                        visited.add(i);
                        nextPoint = edges[i][1];
                        foundNext = true;
                        break;
                    }
                }
            }
            // Nếu không tìm thấy đường đi tiếp (lỗi hình học), buộc phải dừng
            if (!foundNext) break;
        }

        // 3. Tối ưu hóa: Hợp nhất các đoạn thẳng thẳng hàng
        const optimizedLoop = simplifyPath(currentLoop);

        if (optimizedLoop.length > 2) {
            const d = `M${optimizedLoop[0][0]} ${optimizedLoop[0][1]} ` +
                optimizedLoop.slice(1).map(p => `L${p[0]} ${p[1]}`).join(' ') + 'Z';
            pathParts.push(d);
        }
    }

    return pathParts.join(' ');
}

function simplifyPath(points) {
    if (points.length < 3) return points;

    const result = [];
    const len = points.length;

    for (let i = 0; i < len; i++) {
        const prev = result.length > 0 ? result[result.length - 1] : points[len - 1]; // Wrap around check
        const curr = points[i];
        const next = points[(i + 1) % len];

        // Kiểm tra tính thẳng hàng (Collinear)
        // Nếu 3 điểm thẳng hàng ngang hoặc dọc, bỏ qua điểm giữa (curr)
        const isHorizontal = prev[1] === curr[1] && curr[1] === next[1];
        const isVertical = prev[0] === curr[0] && curr[0] === next[0];

        if (!isHorizontal && !isVertical) {
            result.push(curr);
        } else if (result.length === 0) {
            // Luôn giữ điểm đầu tiên để làm mốc, sẽ lọc lại sau nếu cần
            result.push(curr);
        }
    }

    return result;
}

exports.bitmapToSVGPath = bitmapToSVGPath;
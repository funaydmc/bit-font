/**
 * @module core/bitmap-processor
 * Handles operations related to bitmap processing: extraction, transformation, and vectorization.
 */

class BitmapProcessor {
    /**
     * Extract a bitmap from an image buffer at specified coordinates.
     * @param {Object} image - The source image object { width, height, data }.
     * @param {number} x - Starting x coordinate.
     * @param {number} y - Starting y coordinate.
     * @param {number} width - Width of the area to extract.
     * @param {number} height - Height of the area to extract.
     * @returns {Object} Extracted bitmap data { pixels, width, xOffset, isEmpty }.
     */
    static extractBitmap(image, x, y, width, height) {
        let minX = width, maxX = -1;
        let anyPixels = false;

        // Pass 1: Bounding Box Detection
        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                if (x + px >= image.width || y + py >= image.height) continue;

                const idx = ((y + py) * image.width + (x + px)) * 4;
                const r = image.data[idx];
                const g = image.data[idx + 1];
                const b = image.data[idx + 2];
                const a = image.data[idx + 3];

                const isContent = a > 10 && !(r === 0 && g === 0 && b === 0);

                if (isContent) {
                    anyPixels = true;
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                }
            }
        }

        if (!anyPixels) {
            return { pixels: [], width: 0, isEmpty: true, xOffset: 0 };
        }

        // Pass 2: Extract Pixels
        const pixels = [];
        for (let py = 0; py < height; py++) {
            const row = [];
            for (let px = minX; px <= maxX; px++) {
                if (x + px >= image.width || y + py >= image.height) {
                    row.push(0);
                    continue;
                }
                const idx = ((y + py) * image.width + (x + px)) * 4;
                const r = image.data[idx];
                const g = image.data[idx + 1];
                const b = image.data[idx + 2];
                const a = image.data[idx + 3];

                const isContent = a > 10 && !(r === 0 && g === 0 && b === 0);
                row.push(isContent ? 1 : 0);
            }
            pixels.push(row);
        }

        return {
            pixels: pixels,
            width: maxX - minX + 1,
            xOffset: minX,
            isEmpty: false
        };
    }

    /**
     * Transform a bitmap to a "bold" version by smearing pixels to the right.
     * @param {number[][]} bitmap - The input 2D bitmap array.
     * @returns {number[][]} The transformed bold bitmap.
     */
    static transformBold(bitmap) {
        if (!bitmap || bitmap.length === 0) return bitmap;

        const rows = bitmap.length;
        const cols = bitmap[0].length;
        const newCols = cols + 1;

        const newBitmap = [];

        for (let r = 0; r < rows; r++) {
            const row = bitmap[r];
            const newRow = new Array(newCols).fill(0);
            for (let c = 0; c < newCols; c++) {
                const curr = (c < cols) ? row[c] : 0;
                const prev = (c > 0) ? row[c - 1] : 0;
                newRow[c] = (curr === 1 || prev === 1) ? 1 : 0;
            }
            newBitmap.push(newRow);
        }
        return newBitmap;
    }

    /**
     * Convert a 2D bitmap array into an SVG path string.
     * @param {number[][]} bitmap - The 2D bitmap array.
     * @returns {string} The SVG path data.
     */
    static toSVGPath(bitmap) {
        if (!bitmap || bitmap.length === 0 || !bitmap[0]) return '';
        const rows = bitmap.length;
        const cols = bitmap[0].length;
        const edges = [];

        // 1. Identify Edges
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (bitmap[r][c] === 1) {
                    if (r === 0 || bitmap[r - 1][c] === 0) edges.push([[c, r], [c + 1, r]]); // Top
                    if (c === cols - 1 || bitmap[r][c + 1] === 0) edges.push([[c + 1, r], [c + 1, r + 1]]); // Right
                    if (r === rows - 1 || bitmap[r + 1][c] === 0) edges.push([[c + 1, r + 1], [c, r + 1]]); // Bottom
                    if (c === 0 || bitmap[r][c - 1] === 0) edges.push([[c, r + 1], [c, r]]); // Left
                }
            }
        }

        const pathParts = [];
        const visited = new Set();

        // 2. Connect Edges
        while (visited.size < edges.length) {
            let startEdgeIdx = -1;
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

            while (true) {
                if (nextPoint[0] === currentLoop[0][0] && nextPoint[1] === currentLoop[0][1]) {
                    break;
                }

                currentLoop.push(nextPoint);
                let foundNext = false;

                for (let i = 0; i < edges.length; i++) {
                    if (!visited.has(i)) {
                        if (edges[i][0][0] === nextPoint[0] && edges[i][0][1] === nextPoint[1]) {
                            visited.add(i);
                            nextPoint = edges[i][1];
                            foundNext = true;
                            break;
                        }
                    }
                }
                if (!foundNext) break;
            }

            // 3. Simplify Path
            const optimizedLoop = this.simplifyPath(currentLoop);

            if (optimizedLoop.length > 2) {
                const d = `M${optimizedLoop[0][0]} ${optimizedLoop[0][1]} ` +
                    optimizedLoop.slice(1).map(p => `L${p[0]} ${p[1]}`).join(' ') + 'Z';
                pathParts.push(d);
            }
        }

        return pathParts.join(' ');
    }

    /**
     * Simplify a path by removing collinear points.
     * @param {Array<Array<number>>} points - List of [x, y] points.
     * @returns {Array<Array<number>>} Simplified list of points.
     */
    static simplifyPath(points) {
        if (points.length < 3) return points;

        const result = [];
        const len = points.length;

        for (let i = 0; i < len; i++) {
            const prev = result.length > 0 ? result[result.length - 1] : points[len - 1];
            const curr = points[i];
            const next = points[(i + 1) % len];

            const isHorizontal = prev[1] === curr[1] && curr[1] === next[1];
            const isVertical = prev[0] === curr[0] && curr[0] === next[0];

            if (!isHorizontal && !isVertical) {
                result.push(curr);
            } else if (result.length === 0) {
                result.push(curr);
            }
        }

        return result;
    }
}

module.exports = BitmapProcessor;

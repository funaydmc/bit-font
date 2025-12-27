/**
 * @module core/bitmap-processor
 * Handles operations related to bitmap processing: extraction, transformation, and vectorization.
 */

class BitmapProcessor {
    /**
     * Extract a bitmap from an image buffer at specified coordinates.
     * @param {BitFont.PNGData} image - The source image object { width, height, data }.
     * @param {number} x - Starting x coordinate.
     * @param {number} y - Starting y coordinate.
     * @param {number} width - Width of the area to extract.
     * @param {number} height - Height of the area to extract.
     * @returns {BitFont.ExtractedBitmap} Extracted bitmap data { pixels, width, xOffset, isEmpty }.
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
     * Optimized to merge diagonally adjacent blocks.
     * @param {number[][]} bitmap - The 2D bitmap array.
     * @returns {string} The SVG path data.
     */
    static toSVGPath(bitmap) {
        if (!bitmap || bitmap.length === 0 || !bitmap[0]) return '';
        const rows = bitmap.length;
        const cols = bitmap[0].length;

        // 1. Find connected components with diagonal connectivity
        const components = this.findDiagonalConnectedComponents(bitmap);

        const pathParts = [];

        // 2. Process each connected component
        for (const component of components) {
            // Create a set of component pixels for fast lookup
            const componentSet = new Set(component.map(([r, c]) => `${r},${c}`));
            const edges = [];
            
            // Identify edges for this component, filtering out internal edges
            for (const [r, c] of component) {
                // Top edge
                if (r === 0 || bitmap[r - 1][c] === 0) {
                    const edge = [[c, r], [c + 1, r]];
                    if (!this.isInternalEdge(edge, componentSet, bitmap)) {
                        edges.push(edge);
                    }
                }
                // Right edge
                if (c === cols - 1 || bitmap[r][c + 1] === 0) {
                    const edge = [[c + 1, r], [c + 1, r + 1]];
                    if (!this.isInternalEdge(edge, componentSet, bitmap)) {
                        edges.push(edge);
                    }
                }
                // Bottom edge
                if (r === rows - 1 || bitmap[r + 1][c] === 0) {
                    const edge = [[c + 1, r + 1], [c, r + 1]];
                    if (!this.isInternalEdge(edge, componentSet, bitmap)) {
                        edges.push(edge);
                    }
                }
                // Left edge
                if (c === 0 || bitmap[r][c - 1] === 0) {
                    const edge = [[c, r + 1], [c, r]];
                    if (!this.isInternalEdge(edge, componentSet, bitmap)) {
                        edges.push(edge);
                    }
                }
            }

            const visited = new Set();

            // 3. Connect Edges into loops using right-hand rule
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
                let prevEdgeIdx = startEdgeIdx;

                while (true) {
                    if (nextPoint[0] === currentLoop[0][0] && nextPoint[1] === currentLoop[0][1]) {
                        break;
                    }

                    currentLoop.push(nextPoint);
                    
                    // Find the next edge using rightmost turn strategy
                    let nextEdgeIdx = this.findNextEdgeRightmost(edges, visited, prevEdgeIdx, nextPoint);
                    
                    if (nextEdgeIdx === -1) break;
                    
                    visited.add(nextEdgeIdx);
                    prevEdgeIdx = nextEdgeIdx;
                    nextPoint = edges[nextEdgeIdx][1];
                }

                // 4. Simplify Path
                const optimizedLoop = this.simplifyPath(currentLoop);

                if (optimizedLoop.length > 2) {
                    const d = `M${optimizedLoop[0][0]} ${optimizedLoop[0][1]} ` +
                        optimizedLoop.slice(1).map(p => `L${p[0]} ${p[1]}`).join(' ') + 'Z';
                    pathParts.push(d);
                }
            }
        }

        return pathParts.join(' ');
    }

    /**
     * Find connected components considering diagonal connectivity.
     * @param {number[][]} bitmap - The 2D bitmap array.
     * @returns {Array<Array<[number, number]>>} Array of components, each containing pixel coordinates.
     */
    static findDiagonalConnectedComponents(bitmap) {
        if (!bitmap || bitmap.length === 0) return [];
        const rows = bitmap.length;
        const cols = bitmap[0].length;
        const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));
        const components = [];

        const dfs = (r, c, component) => {
            if (r < 0 || r >= rows || c < 0 || c >= cols) return;
            if (visited[r][c] || bitmap[r][c] !== 1) return;

            visited[r][c] = true;
            component.push([r, c]);

            // Visit all 8 neighbors (including diagonals)
            dfs(r - 1, c, component);     // Top
            dfs(r + 1, c, component);     // Bottom
            dfs(r, c - 1, component);     // Left
            dfs(r, c + 1, component);     // Right
            dfs(r - 1, c - 1, component); // Top-left
            dfs(r - 1, c + 1, component); // Top-right
            dfs(r + 1, c - 1, component); // Bottom-left
            dfs(r + 1, c + 1, component); // Bottom-right
        };

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (bitmap[r][c] === 1 && !visited[r][c]) {
                    const component = [];
                    dfs(r, c, component);
                    if (component.length > 0) {
                        components.push(component);
                    }
                }
            }
        }

        return components;
    }

    /**
     * Find the next edge that makes the rightmost turn from the current edge.
     * This ensures we trace the outer boundary of the shape.
     * @param {Array<Array<Array<number>>>} edges - All edges.
     * @param {Set<number>} visited - Set of visited edge indices.
     * @param {number} prevEdgeIdx - Index of the previous edge.
     * @param {Array<number>} point - The current point [x, y].
     * @returns {number} Index of the next edge, or -1 if none found.
     */
    static findNextEdgeRightmost(edges, visited, prevEdgeIdx, point) {
        const prevEdge = edges[prevEdgeIdx];
        const incomingDir = [
            prevEdge[1][0] - prevEdge[0][0],
            prevEdge[1][1] - prevEdge[0][1]
        ];

        let bestEdgeIdx = -1;
        let bestAngle = -Infinity;

        for (let i = 0; i < edges.length; i++) {
            if (visited.has(i)) continue;
            if (edges[i][0][0] !== point[0] || edges[i][0][1] !== point[1]) continue;

            const outgoingDir = [
                edges[i][1][0] - edges[i][0][0],
                edges[i][1][1] - edges[i][0][1]
            ];

            // Calculate the angle between incoming and outgoing directions
            // We want the rightmost turn, which is the smallest clockwise angle
            const angle = this.calculateTurnAngle(incomingDir, outgoingDir);
            
            if (angle > bestAngle) {
                bestAngle = angle;
                bestEdgeIdx = i;
            }
        }

        return bestEdgeIdx;
    }

    /**
     * Calculate the turn angle from incoming to outgoing direction.
     * Returns a value where larger = more clockwise turn.
     * @param {Array<number>} incoming - Incoming direction vector [dx, dy].
     * @param {Array<number>} outgoing - Outgoing direction vector [dx, dy].
     * @returns {number} Turn angle indicator.
     */
    static calculateTurnAngle(incoming, outgoing) {
        // Cross product gives us the turn direction
        // Positive = counterclockwise, negative = clockwise
        const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
        
        // Dot product helps determine if it's a sharp or gentle turn
        const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
        
        // Use atan2 for a proper angle measure
        // Negate because we want clockwise (right turn) to be positive
        return Math.atan2(-cross, dot);
    }

    /**
     * Check if an edge is internal (between two pixels in the same component).
     * An edge is internal if pixels on both sides (considering diagonals) are in the same component.
     * @param {Array<Array<number>>} edge - The edge as [[x1, y1], [x2, y2]].
     * @param {Set<string>} componentSet - Set of pixel coordinates in the component.
     * @param {number[][]} bitmap - The bitmap array.
     * @returns {boolean} True if the edge is internal.
     */
    static isInternalEdge(edge, componentSet, bitmap) {
        const [[x1, y1], [x2, y2]] = edge;
        
        // Determine edge orientation and get adjacent pixels
        if (x1 === x2) {
            // Vertical edge: check left and right pixels
            const x = x1;
            const y = Math.min(y1, y2);
            const leftPixel = `${y},${x - 1}`;
            const rightPixel = `${y},${x}`;
            
            // Check if both adjacent pixels are in the component
            const leftInComponent = componentSet.has(leftPixel);
            const rightInComponent = componentSet.has(rightPixel);
            
            // Edge is internal if both sides are in the component
            return leftInComponent && rightInComponent;
        } else {
            // Horizontal edge: check top and bottom pixels
            const y = y1;
            const x = Math.min(x1, x2);
            const topPixel = `${y - 1},${x}`;
            const bottomPixel = `${y},${x}`;
            
            // Check if both adjacent pixels are in the component
            const topInComponent = componentSet.has(topPixel);
            const bottomInComponent = componentSet.has(bottomPixel);
            
            // Edge is internal if both sides are in the component
            return topInComponent && bottomInComponent;
        }
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

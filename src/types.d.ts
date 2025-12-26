/**
 * Global type definitions for BitFont project.
 * These types are available globally in the project when JSDoc comments reference them.
 */

declare namespace BitFont {
    /**
     * Image pixel data from PNG.
     */
    interface PNGData {
        width: number;
        height: number;
        data: any; // Using any for Buffer/Uint8Array compatibility essentially
    }

    /**
     * Base interface for font providers.
     */
    interface BaseProvider {
        type: string;
    }

    /**
     * Bitmap character provider configuration.
     */
    interface BitmapProvider extends BaseProvider {
        type: 'bitmap';
        file: string;
        chars: string[];
        height?: number;
        ascent?: number;
    }

    /**
     * Space character provider configuration.
     */
    interface SpaceProvider extends BaseProvider {
        type: 'space';
        advances: { [char: string]: number };
    }

    /**
     * Reference provider configuration.
     */
    interface ReferenceProvider extends BaseProvider {
        type: 'reference';
        id: string;
    }

    /**
     * Union of all provider types.
     */
    type Provider = BitmapProvider | SpaceProvider | ReferenceProvider;

    /**
     * Processed character data.
     */
    interface CharData {
        unicode: string;
        type: 'bitmap' | 'space';
        width?: number; // Advance width
        height?: number;
        ascent?: number;
        bitmap?: number[][];
        xOffset?: number;
    }

    /**
     * Data extracted from a bitmap image.
     */
    interface ExtractedBitmap {
        pixels: number[][];
        width: number;
        xOffset: number;
        isEmpty: boolean;
    }

    /**
     * Font object from fonteditor-core.
     */
    interface FontEditorFont {
        get(): any; // Returns complex font data structure
        set(data: any): void;
        write(options: { type: 'ttf' | 'woff' | 'woff2' | 'svg' | 'eot' | 'symbol' }): Buffer;
    }
}

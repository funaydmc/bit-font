/**
 * Simple logger utility for standardized output.
 * @module utils/logger
 */

const logger = {
    /**
     * Log an informational message.
     * @param {string} message 
     * @param {...any} args 
     */
    info: (message, ...args) => {
        console.log(`[INFO] ${message}`, ...args);
    },

    /**
     * Log a success message.
     * @param {string} message 
     * @param {...any} args 
     */
    success: (message, ...args) => {
        console.log(`✅ ${message}`, ...args);
    },

    /**
     * Log a warning message.
     * @param {string} message 
     * @param {...any} args 
     */
    warn: (message, ...args) => {
        console.warn(`⚠️  ${message}`, ...args);
    },

    /**
     * Log an error message.
     * @param {string} message 
     * @param {...any} args 
     */
    error: (message, ...args) => {
        console.error(`❌ ${message}`, ...args);
    },

    /**
     * Log progress (without newline).
     * @param {string} char 
     */
    progress: (char = '.') => {
        process.stdout.write(char);
    }
};

module.exports = logger;

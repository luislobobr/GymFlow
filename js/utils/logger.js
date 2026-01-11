/**
 * GymFlow - Logger Utility
 * Handles conditional logging based on environment.
 * Suppresses logs in production (except errors).
 */

const isDevelopment = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

export const logger = {
    /**
     * Log standard message (development only)
     */
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    /**
     * Log info message (development only)
     */
    info: (...args) => {
        if (isDevelopment) {
            console.info(...args);
        }
    },

    /**
     * Log warning message (development only)
     */
    warn: (...args) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },

    /**
     * Log error message (always visible)
     * In future can be connected to monitoring service like Sentry
     */
    error: (...args) => {
        console.error(...args);
        // Future: Sentry.captureException(args[0]);
    },

    /**
     * Group logs (development only)
     */
    group: (...args) => {
        if (isDevelopment) {
            console.group(...args);
        }
    },

    /**
     * Group end (development only)
     */
    groupEnd: () => {
        if (isDevelopment) {
            console.groupEnd();
        }
    }
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../js/utils/logger.js';

describe('Logger Utility', () => {
    let originalHostname;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        // Save original hostname
        originalHostname = window.location.hostname;

        // Spy on console methods
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        // Restore hostname
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hostname: originalHostname }
        });
        vi.restoreAllMocks();
    });

    it('should log in development environment', () => {
        // Mock hostname to localhost
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hostname: 'localhost' }
        });

        logger.log('test message');
        expect(consoleLogSpy).toHaveBeenCalledWith('test message');
    });

    it('should NOT log in production environment', () => {
        // Mock hostname to production
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hostname: 'gymflow.app' }
        });

        logger.log('test message');
        logger.warn('test warning');

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should ALWAYS log errors regardless of environment', () => {
        // Mock hostname to production
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hostname: 'gymflow.app' }
        });

        logger.error('critical error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('critical error');
    });
});

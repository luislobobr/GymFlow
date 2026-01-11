import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { router } from '../../js/router.js';

describe('Router Module', () => {
    beforeEach(() => {
        // Clear router state
        router.routes.clear();
        router.beforeHooks = [];
        router.afterHooks = [];

        // Mock page container
        document.body.innerHTML = '<div id="page-container"></div>';
    });

    it('should register routes correctly', () => {
        router.add('home', {
            title: 'Home',
            render: () => '<div>Home Page</div>'
        });

        expect(router.routes.has('home')).toBe(true);
        expect(router.routes.get('home').title).toBe('Home');
    });

    it('should handle navigation', async () => {
        const renderSpy = vi.fn().mockReturnValue('<div>Test</div>');

        router.add('test', {
            render: renderSpy
        });

        // Manually trigger handleRoute since JSDOM hash change might not fire automatically in this context
        window.location.hash = 'test';
        await router.handleRoute();

        expect(renderSpy).toHaveBeenCalled();
        expect(document.getElementById('page-container').innerHTML).toBe('<div>Test</div>');
    });

    it('should respect requiresAuth flag', () => {
        router.add('protected', { requiresAuth: true });
        router.add('public', { requiresAuth: false });

        expect(router.requiresAuth('protected')).toBe(true);
        expect(router.requiresAuth('public')).toBe(false);
    });

    it('should execute before hooks', async () => {
        const hookSpy = vi.fn().mockResolvedValue(true);
        router.beforeEach(hookSpy);

        router.add('test', { render: () => '' });

        window.location.hash = 'test';
        await router.handleRoute();

        expect(hookSpy).toHaveBeenCalled();
    });

    it('should block navigation if before hook returns false', async () => {
        const hookSpy = vi.fn().mockResolvedValue(false);
        const renderSpy = vi.fn();

        router.beforeEach(hookSpy);
        router.add('test', { render: renderSpy });

        window.location.hash = 'test';
        await router.handleRoute();

        expect(renderSpy).not.toHaveBeenCalled();
    });
});

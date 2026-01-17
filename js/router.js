/**
 * MFIT Personal - Router Module
 * Simple SPA router for hash-based navigation
 */

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.beforeHooks = [];
        this.afterHooks = [];

        // Only listen for hash changes - initial route will be triggered manually by app.init()
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    /**
     * Register a route
     * @param {string} path - Route path (e.g., 'dashboard', 'workouts')
     * @param {object} config - Route configuration
     */
    add(path, config) {
        this.routes.set(path, {
            title: config.title || path,
            render: config.render,
            onEnter: config.onEnter,
            onLeave: config.onLeave,
            requiresAuth: config.requiresAuth ?? true
        });
        return this;
    }

    /**
     * Add before navigation hook
     */
    beforeEach(hook) {
        this.beforeHooks.push(hook);
        return this;
    }

    /**
     * Add after navigation hook
     */
    afterEach(hook) {
        this.afterHooks.push(hook);
        return this;
    }

    /**
     * Navigate to a route
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Get current path from hash
     */
    getCurrentPath() {
        return window.location.hash.slice(1) || 'dashboard';
    }

    /**
     * Handle route changes
     */
    async handleRoute() {
        const path = this.getCurrentPath();
        const route = this.routes.get(path);

        if (!route) {
            // Don't try to navigate if route not found - this could cause infinite loops
            // when called before routes are registered
            if (this.routes.size > 0) {
                console.warn(`[Router] Route not found: ${path}, redirecting to dashboard`);
                window.location.hash = 'dashboard';
            }
            return;
        }

        // Run before hooks
        for (const hook of this.beforeHooks) {
            const result = await hook(path, this.currentRoute);
            if (result === false) return;
        }

        // Call onLeave for previous route
        if (this.currentRoute) {
            const prevRoute = this.routes.get(this.currentRoute);
            if (prevRoute?.onLeave) {
                await prevRoute.onLeave();
            }
        }

        // Update current route
        const previousRoute = this.currentRoute;
        this.currentRoute = path;

        // Update page title
        document.title = `${route.title} | GymFlow`;

        // Update active nav item
        this.updateNavigation(path);

        // Call onEnter
        if (route.onEnter) {
            await route.onEnter();
        }

        // Render the route
        if (route.render) {
            const container = document.getElementById('page-container');
            if (container) {
                container.innerHTML = '';
                const content = await route.render();
                if (typeof content === 'string') {
                    container.innerHTML = content;
                } else if (content instanceof HTMLElement) {
                    container.appendChild(content);
                }

                // Trigger animation
                container.classList.add('animate-fade-in');
                setTimeout(() => container.classList.remove('animate-fade-in'), 300);
            }
        }

        // Run after hooks
        for (const hook of this.afterHooks) {
            await hook(path, previousRoute);
        }
    }

    /**
     * Update navigation active state
     */
    updateNavigation(path) {
        const navItems = document.querySelectorAll('.nav-item[data-route]');
        navItems.forEach(item => {
            const route = item.dataset.route;
            if (route === path) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update page title in header
        const route = this.routes.get(path);
        const pageTitleEl = document.querySelector('.page-title');
        if (pageTitleEl && route) {
            pageTitleEl.textContent = route.title;
        }
    }

    /**
     * Check if route requires auth
     */
    requiresAuth(path) {
        const route = this.routes.get(path);
        return route?.requiresAuth ?? true;
    }
}

// Export singleton
const router = new Router();
export { router };

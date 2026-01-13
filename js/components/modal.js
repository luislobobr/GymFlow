/**
 * MFIT Personal - Modal Component
 * Reusable modal dialog system
 */

class Modal {
    constructor() {
        this.activeModal = null;
        this.init();
    }

    init() {
        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close();
            }
        });
    }

    /**
     * Open a modal dialog
     * @param {object} config - Modal configuration
     */
    open(config) {
        // Close any existing modal first
        if (this.activeModal) {
            this.close();
        }

        const {
            title = '',
            content = '',
            size = 'md', // sm, md, lg, xl, full
            closable = true,
            footer = null,
            onOpen = null,
            onClose = null
        } = config;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.dataset.closable = closable;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'modal-title');

        // Size classes
        const sizeClass = {
            sm: 'max-width: 400px;',
            md: 'max-width: 500px;',
            lg: 'max-width: 700px;',
            xl: 'max-width: 900px;',
            full: 'max-width: 95%; max-height: 95%;'
        };

        // Create modal
        overlay.innerHTML = `
       <div class="modal" style="${sizeClass[size] || sizeClass.md}">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title">${title}</h3>
          ${closable ? `
            <button class="modal-close" aria-label="Fechar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          ` : ''}
        </div>
        <div class="modal-body">
          ${typeof content === 'string' ? content : ''}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

        // If content is an element, append it
        if (content instanceof HTMLElement) {
            overlay.querySelector('.modal-body').appendChild(content);
        }

        // Close handlers
        if (closable) {
            overlay.querySelector('.modal-close').addEventListener('click', () => this.close());
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.close();
            });
        }

        // Store callbacks
        overlay.dataset.onClose = onClose ? 'true' : 'false';
        this._onClose = onClose;

        // Add to DOM
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        this.activeModal = overlay;

        // Call onOpen callback
        if (onOpen) onOpen(overlay);

        return overlay;
    }

    /**
     * Close the active modal
     */
    close() {
        if (!this.activeModal) return;

        const overlay = this.activeModal;
        overlay.classList.remove('active');

        // Call onClose callback
        if (this._onClose) {
            this._onClose();
        }

        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';

            // Only clear activeModal if it's still the same one (avoid clearing new modal ref)
            if (this.activeModal === overlay) {
                this.activeModal = null;
            }
            this._onClose = null;
        }, 250);
    }

    /**
     * Confirm dialog
     */
    confirm(options) {
        return new Promise((resolve) => {
            const {
                title = 'Confirmar',
                message = 'Você tem certeza?',
                confirmText = 'Confirmar',
                cancelText = 'Cancelar',
                confirmClass = 'btn-primary',
                danger = false
            } = options;

            const footer = `
        <button class="btn btn-secondary modal-cancel">${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger' : confirmClass} modal-confirm">${confirmText}</button>
      `;

            const modal = this.open({
                title,
                content: `<p>${message}</p>`,
                footer,
                size: 'sm'
            });

            modal.querySelector('.modal-cancel').addEventListener('click', () => {
                this.close();
                resolve(false);
            });

            modal.querySelector('.modal-confirm').addEventListener('click', () => {
                this.close();
                resolve(true);
            });
        });
    }

    /**
     * Alert dialog
     */
    alert(options) {
        const {
            title = 'Aviso',
            message = '',
            buttonText = 'OK'
        } = typeof options === 'string' ? { message: options } : options;

        return new Promise((resolve) => {
            const footer = `<button class="btn btn-primary modal-ok">${buttonText}</button>`;

            const modal = this.open({
                title,
                content: `<p>${message}</p>`,
                footer,
                size: 'sm'
            });

            modal.querySelector('.modal-ok').addEventListener('click', () => {
                this.close();
                resolve();
            });
        });
    }

    /**
     * Prompt dialog
     */
    prompt(options) {
        const {
            title = 'Digite',
            label = '',
            placeholder = '',
            defaultValue = '',
            type = 'text',
            confirmText = 'OK',
            cancelText = 'Cancelar'
        } = options;

        return new Promise((resolve) => {
            const content = `
        <div class="form-group">
          ${label ? `<label class="form-label">${label}</label>` : ''}
          <input type="${type}" class="form-input modal-input" placeholder="${placeholder}" value="${defaultValue}">
        </div>
      `;

            const footer = `
        <button class="btn btn-secondary modal-cancel">${cancelText}</button>
        <button class="btn btn-primary modal-confirm">${confirmText}</button>
      `;

            const modal = this.open({
                title,
                content,
                footer,
                size: 'sm'
            });

            const input = modal.querySelector('.modal-input');
            input.focus();

            // Submit on Enter
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.close();
                    resolve(input.value);
                }
            });

            modal.querySelector('.modal-cancel').addEventListener('click', () => {
                this.close();
                resolve(null);
            });

            modal.querySelector('.modal-confirm').addEventListener('click', () => {
                this.close();
                resolve(input.value);
            });
        });
    }
}

// Export singleton
const modal = new Modal();
export { modal };

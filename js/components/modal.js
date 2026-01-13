/**
 * MFIT Personal - Modal Component
 * Reusable modal dialog system with Stack Support
 */

class Modal {
    constructor() {
        this.modalsStack = []; // Stack of active modals
        this.init();
    }

    init() {
        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalsStack.length > 0) {
                const topModal = this.modalsStack[this.modalsStack.length - 1];
                // Check if closable via dataset
                if (topModal.dataset.closable === 'true') {
                    this.close();
                }
            }
        });
    }

    /**
     * Open a modal dialog
     * @param {object} config - Modal configuration
     */
    open(config) {
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

        // Increase z-index based on stack depth to ensure proper layering
        const baseZIndex = 1100;
        overlay.style.zIndex = baseZIndex + (this.modalsStack.length * 10);

        // Size classes
        const sizeClass = {
            sm: 'max-width: 400px;',
            md: 'max-width: 500px;',
            lg: 'max-width: 700px;',
            xl: 'max-width: 900px;',
            full: 'max-width: 95%; max-height: 95%;'
        };

        // Create modal content
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
            // Close button click
            overlay.querySelector('.modal-close').addEventListener('click', () => {
                // Ensure we are closing THIS modal (top of stack)
                if (this.modalsStack[this.modalsStack.length - 1] === overlay) {
                    this.close();
                }
            });

            // Overlay click (click outside)
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    // Ensure we are closing THIS modal
                    if (this.modalsStack[this.modalsStack.length - 1] === overlay) {
                        this.close();
                    }
                }
            });
        }

        // Store callbacks
        // Attach onClose directly to the DOM element to retrieve it later easily
        overlay._onCloseCallback = onClose;

        // Add to DOM
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Add to stack
        this.modalsStack.push(overlay);

        // Call onOpen callback
        if (onOpen) onOpen(overlay);

        return overlay;
    }

    /**
     * Close the top-most modal
     */
    close() {
        if (this.modalsStack.length === 0) return;

        // Pop the top modal
        const overlay = this.modalsStack.pop();
        overlay.classList.remove('active');

        // Call onClose callback
        if (overlay._onCloseCallback) {
            overlay._onCloseCallback();
        }

        setTimeout(() => {
            overlay.remove();

            // Only restore body scrolling if no more modals exist
            if (this.modalsStack.length === 0) {
                document.body.style.overflow = '';
            }
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

            // We need a reference to modify closure behavior
            let modalOverlay = null;

            modalOverlay = this.open({
                title,
                content: `<p>${message}</p>`,
                footer,
                size: 'sm'
            });

            const handleClose = (result) => {
                // Only call this once
                // Note: this.close() will close the top modal, which IS this one because confirm is always on top when interacting
                this.close();
                resolve(result);
            };

            modalOverlay.querySelector('.modal-cancel').addEventListener('click', () => handleClose(false));
            modalOverlay.querySelector('.modal-confirm').addEventListener('click', () => handleClose(true));
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

            const modalOverlay = this.open({
                title,
                content: `<p>${message}</p>`,
                footer,
                size: 'sm'
            });

            modalOverlay.querySelector('.modal-ok').addEventListener('click', () => {
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

            const modalOverlay = this.open({
                title,
                content,
                footer,
                size: 'sm'
            });

            const input = modalOverlay.querySelector('.modal-input');
            input.focus();

            const handleClose = (result) => {
                this.close();
                resolve(result);
            };

            // Submit on Enter
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleClose(input.value);
                }
            });

            modalOverlay.querySelector('.modal-cancel').addEventListener('click', () => handleClose(null));
            modalOverlay.querySelector('.modal-confirm').addEventListener('click', () => handleClose(input.value));
        });
    }
}

// Export singleton
const modal = new Modal();
export { modal };

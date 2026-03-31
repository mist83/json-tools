/**
 * Modals Everywhere - Reusable Modal Framework
 * @version 1.0.0
 * @description Simple, configurable modal system with auto-close X button
 * @license MIT
 * 
 * USAGE:
 * <script src="https://vizio-data-ingestion-resources.s3.us-west-2.amazonaws.com/other/modals-everywhere/modals-everywhere.js"></script>
 * <script>
 *   const modals = new ModalsEverywhere({
 *     defaultIcon: 'ti ti-brand-walmart',
 *     defaultIconColor: '#FFC220',
 *     headerBackground: '#0071CE',
 *     primaryButtonColor: '#0071CE',
 *     dangerButtonColor: '#e74c3c'
 *   });
 *   
 *   modals.show({
 *     title: 'My Modal',
 *     content: '<p>Content here</p>',
 *     actions: [{ text: 'Save', type: 'primary', onClick: () => {} }]
 *   });
 * </script>
 */

class ModalsEverywhere {
    /**
     * Detect if styles-everywhere CSS variables are available
     * @returns {Object|null} Object with detected variables or null if not found
     */
    detectStylesEverywhere() {
        const root = getComputedStyle(document.documentElement);
        const primaryColor = root.getPropertyValue('--color-primary').trim();
        
        if (primaryColor) {
            return {
                primary: primaryColor,
                secondary: root.getPropertyValue('--color-secondary').trim(),
                success: root.getPropertyValue('--color-success').trim(),
                danger: root.getPropertyValue('--color-danger').trim(),
                bgPrimary: root.getPropertyValue('--color-bg').trim(),
                textPrimary: root.getPropertyValue('--color-text').trim()
            };
        }
        
        return null;
    }

    constructor(config = {}) {
        // Detect styles-everywhere variables
        const stylesEverywhere = this.detectStylesEverywhere();
        
        // Use styles-everywhere as defaults, allow config overrides
        this.config = {
            defaultIcon: config.defaultIcon || 'ti ti-circle',
            defaultIconColor: config.defaultIconColor || (stylesEverywhere?.secondary || '#666'),
            headerBackground: config.headerBackground || (stylesEverywhere?.primary || '#2c3e50'),
            primaryButtonColor: config.primaryButtonColor || (stylesEverywhere?.primary || '#3498db'),
            secondaryButtonColor: config.secondaryButtonColor || '#95a5a6',
            dangerButtonColor: config.dangerButtonColor || (stylesEverywhere?.danger || '#e74c3c'),
            ...config
        };
        
        this.currentModal = null;
        this.injectStyles();
        
        // Log integration status
        if (stylesEverywhere) {
            console.log('[Modals Everywhere] Integrated with styles-everywhere theme');
        }
    }

    injectStyles() {
        if (document.getElementById('modals-everywhere-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'modals-everywhere-styles';
        style.textContent = `
            .modals-everywhere-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .modals-everywhere-overlay.active {
                opacity: 1;
            }
            
            .modals-everywhere-modal {
                place-self: center;
                background: white;
                border-radius: 8px;
                width: 90%;
                max-height: 90vh;
                display: grid;
                grid-template-rows: auto 1fr auto;
                overflow: hidden;
                transform: scale(0.9);
                transition: transform 0.2s;
            }
            
            .modals-everywhere-overlay.active .modals-everywhere-modal {
                transform: scale(1);
            }
            
            .modals-everywhere-modal.size-small {
                max-width: 500px;
            }
            
            .modals-everywhere-modal.size-medium {
                max-width: 700px;
            }
            
            .modals-everywhere-modal.size-large {
                max-width: 1200px;
            }
            
            .modals-everywhere-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
            }
            
            .modals-everywhere-header-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .modals-everywhere-icon {
                font-size: 24px;
            }
            
            .modals-everywhere-title {
                font-size: 24px;
                font-weight: 600;
                margin: 0;
                color: white;
            }
            
            .modals-everywhere-close {
                background: none;
                border: none;
                font-size: 32px;
                color: white;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            
            .modals-everywhere-close:hover {
                opacity: 1;
            }
            
            .modals-everywhere-body {
                padding: 24px;
                overflow-y: auto;
                max-height: 70vh;
            }
            
            .modals-everywhere-footer {
                padding: 20px 24px;
                border-top: 1px solid #ecf0f1;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .modals-everywhere-button {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .modals-everywhere-button:hover {
                transform: none !important;
                box-shadow: none !important;
            }
        `;
        
        document.head.appendChild(style);
    }

    show(options) {
        const {
            title = 'Modal',
            content = '',
            actions = [],
            icon = this.config.defaultIcon,
            iconColor = this.config.defaultIconColor,
            size = 'medium',
            onClose = null
        } = options;

        // Close existing modal if any
        if (this.currentModal) {
            this.close();
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'modals-everywhere-overlay';
        overlay.dataset.state = 'opening';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = `modals-everywhere-modal size-${size}`;
        
        // Header
        const header = document.createElement('div');
        header.className = 'modals-everywhere-header';
        header.style.background = this.config.headerBackground;
        header.style.color = 'white';
        
        const headerContent = document.createElement('div');
        headerContent.className = 'modals-everywhere-header-content';
        
        if (icon) {
            const iconEl = document.createElement('i');
            iconEl.className = `modals-everywhere-icon ${icon}`;
            iconEl.style.color = iconColor;
            headerContent.appendChild(iconEl);
        }
        
        const titleEl = document.createElement('h2');
        titleEl.className = 'modals-everywhere-title';
        titleEl.textContent = title;
        headerContent.appendChild(titleEl);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modals-everywhere-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            if (onClose) onClose();
            this.close();
        };
        
        header.appendChild(headerContent);
        header.appendChild(closeBtn);
        
        // Body
        const body = document.createElement('div');
        body.className = 'modals-everywhere-body';
        
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }
        
        // Footer (only if actions provided)
        let footer = null;
        if (actions && actions.length > 0) {
            footer = document.createElement('div');
            footer.className = 'modals-everywhere-footer';
            
            actions.forEach((action, index) => {
                const btn = document.createElement('button');
                btn.className = 'modals-everywhere-button';
                btn.textContent = action.text || 'Action';
                
                // Set button color based on type
                const type = action.type || 'secondary';
                if (type === 'primary') {
                    btn.className += ' modal-btn-primary';
                    btn.id = 'modal-btn-primary';
                    btn.style.background = this.config.primaryButtonColor;
                    btn.style.color = 'white';
                } else if (type === 'danger') {
                    btn.className += ' modal-btn-danger';
                    btn.id = 'modal-btn-danger';
                    btn.style.background = this.config.dangerButtonColor;
                    btn.style.color = 'white';
                } else {
                    btn.className += ' modal-btn-secondary';
                    btn.id = `modal-btn-${index}`;
                    btn.style.background = this.config.secondaryButtonColor;
                    btn.style.color = 'white';
                }
                
                btn.onclick = async () => {
                    if (action.onClick) {
                        const result = await action.onClick();
                        // If onClick returns false, keep modal open
                        // Otherwise, close the modal
                        if (result !== false) {
                            this.close();
                        }
                    } else {
                        this.close();
                    }
                };
                
                footer.appendChild(btn);
            });
        }
        
        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(body);
        if (footer) modal.appendChild(footer);
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            overlay.dataset.state = 'open';
        });
        
        // Track mousedown location to prevent accidental dismissal during text selection
        let mouseDownOnBackdrop = false;
        
        overlay.addEventListener('mousedown', (e) => {
            // Only set flag if mousedown is on the backdrop itself
            mouseDownOnBackdrop = (e.target === overlay);
        });
        
        // Close on overlay click only if both mousedown and mouseup happened on backdrop
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && mouseDownOnBackdrop) {
                if (onClose) onClose();
                this.close();
            }
            // Reset flag after click
            mouseDownOnBackdrop = false;
        });
        
        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                if (onClose) onClose();
                this.close();
            }
        };
        document.addEventListener('keydown', escHandler);
        
        this.currentModal = {
            overlay,
            escHandler
        };
        
        return this;
    }

    confirm(options) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            onConfirm = null,
            onCancel = null,
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmType = 'primary'
        } = options;

        const content = `<p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">${message}</p>`;
        
        const actions = [
            {
                text: cancelText,
                type: 'secondary',
                onClick: () => {
                    if (onCancel) onCancel();
                    this.close();
                }
            },
            {
                text: confirmText,
                type: confirmType,
                onClick: () => {
                    if (onConfirm) onConfirm();
                    this.close();
                }
            }
        ];

        return this.show({
            title,
            content,
            actions,
            size: 'small',
            icon: confirmType === 'danger' ? 'ti ti-alert-triangle' : 'ti ti-help-circle'
        });
    }

    close() {
        if (!this.currentModal) return;
        
        const { overlay, escHandler } = this.currentModal;
        
        // Remove ESC handler
        document.removeEventListener('keydown', escHandler);
        
        // Animate out
        overlay.classList.remove('active');
        overlay.dataset.state = 'closing';
        
        setTimeout(() => {
            overlay.remove();
        }, 200);
        
        this.currentModal = null;
    }

    isOpen() {
        return this.currentModal !== null;
    }

    updateContent(newContent) {
        if (!this.currentModal) return;
        
        const body = this.currentModal.overlay.querySelector('.modals-everywhere-body');
        if (body) {
            if (typeof newContent === 'string') {
                body.innerHTML = newContent;
            } else if (newContent instanceof HTMLElement) {
                body.innerHTML = '';
                body.appendChild(newContent);
            }
        }
    }

    updateActions(newActions) {
        if (!this.currentModal) return;
        
        let footer = this.currentModal.overlay.querySelector('.modals-everywhere-footer');
        
        if (!footer && newActions && newActions.length > 0) {
            // Create footer if it doesn't exist
            footer = document.createElement('div');
            footer.className = 'modals-everywhere-footer';
            const modal = this.currentModal.overlay.querySelector('.modals-everywhere-modal');
            modal.appendChild(footer);
        }
        
        if (footer) {
            footer.innerHTML = '';
            
            newActions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = 'modals-everywhere-button';
                btn.textContent = action.text || 'Action';
                
                const type = action.type || 'secondary';
                if (type === 'primary') {
                    btn.style.background = this.config.primaryButtonColor;
                    btn.style.color = 'white';
                } else if (type === 'danger') {
                    btn.style.background = this.config.dangerButtonColor;
                    btn.style.color = 'white';
                } else {
                    btn.style.background = this.config.secondaryButtonColor;
                    btn.style.color = 'white';
                }
                
                btn.onclick = async () => {
                    if (action.onClick) {
                        const result = await action.onClick();
                        if (result !== false) {
                            this.close();
                        }
                    } else {
                        this.close();
                    }
                };
                
                footer.appendChild(btn);
            });
        }
    }
}

// Export for use
window.ModalsEverywhere = ModalsEverywhere;

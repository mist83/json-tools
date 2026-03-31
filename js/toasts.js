/**
 * Toasts Everywhere
 * @version 1.0.0
 * @description Toast notification system using styles-everywhere variables
 * @license MIT
 * 
 * USAGE:
 * <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
 * <link rel="stylesheet" href="https://styles-everywhere.mikesendpoint.com/styles-everywhere.css">
 * <script src="https://toasts-everywhere.mikesendpoint.com/toasts-everywhere.js"></script>
 * 
 * SIMPLE:
 * window.Toasts.show('Success!', 'success');
 * window.Toasts.show('Error occurred', 'error');
 * 
 * ADVANCED:
 * window.Toasts.show({
 *     message: 'Custom toast',
 *     type: 'info',
 *     duration: 5000,
 *     position: 'top-right',
 *     icon: 'ti ti-rocket'
 * });
 */

(function(window, document) {
    'use strict';

    const TOAST_TYPES = {
        success: {
            color: 'var(--color-success)',
            icon: 'ti ti-check'
        },
        error: {
            color: 'var(--color-danger)',
            icon: 'ti ti-x'
        },
        warning: {
            color: 'var(--color-warning)',
            icon: 'ti ti-alert-circle'
        },
        info: {
            color: 'var(--color-info)',
            icon: 'ti ti-info-circle'
        }
    };

    const DEFAULT_OPTIONS = {
        position: 'top-right',
        duration: 3000,
        maxVisible: 5
    };

    let toastQueue = [];
    let visibleToasts = [];
    let containers = {};

    // Get highest z-index on page (Price is Right strategy)
    function getMaxZIndex() {
        const elements = document.querySelectorAll('*');
        let maxZ = 0;
        
        elements.forEach(el => {
            const z = parseInt(window.getComputedStyle(el).zIndex, 10);
            if (!isNaN(z) && z > maxZ) {
                maxZ = z;
            }
        });
        
        return maxZ;
    }

    // Get or create container for position
    function getContainer(position) {
        if (containers[position]) {
            return containers[position];
        }

        const container = document.createElement('div');
        container.className = `toasts-container toasts-${position}`;
        
        // Price is Right strategy: always outbid by 1
        const winningZIndex = getMaxZIndex() + 1;
        
        // Position styles
        const positions = {
            'top-left': 'top: 20px; left: 20px;',
            'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
            'top-right': 'top: 20px; right: 20px;',
            'bottom-left': 'bottom: 20px; left: 20px;',
            'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);',
            'bottom-right': 'bottom: 20px; right: 20px;'
        };

        container.style.cssText = `
            all: initial;
            position: fixed;
            ${positions[position] || positions['top-right']}
            z-index: ${winningZIndex};
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
            font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        `;

        document.body.appendChild(container);
        containers[position] = container;
        return container;
    }

    // Create toast element
    function createToast(options) {
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.dataset.state = 'visible';
        toast.dataset.type = options.type || 'info';
        
        const typeConfig = TOAST_TYPES[options.type] || TOAST_TYPES.info;
        const color = options.color || typeConfig.color;
        const icon = options.icon || typeConfig.icon;

        toast.style.cssText = `
            all: initial;
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--color-bg-alt, #ffffff);
            color: var(--color-text, #333333);
            padding: 16px;
            border-radius: var(--radius-md, 8px);
            box-shadow: var(--shadow-lg, 0 8px 16px rgba(0,0,0,0.2));
            min-width: 300px;
            max-width: 400px;
            pointer-events: auto;
            animation: slideIn 0.3s ease-out;
            font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
            font-size: var(--text-base, 14px);
            line-height: 1.4;
            border-left: 4px solid ${color};
        `;

        // Icon
        const iconEl = document.createElement('i');
        iconEl.className = icon;
        iconEl.style.cssText = `
            all: initial;
            font-size: 24px;
            color: ${color};
            display: inline-block;
            font-family: tabler-icons;
            font-style: normal;
            font-weight: normal;
            line-height: 1;
            flex-shrink: 0;
        `;

        // Message
        const messageEl = document.createElement('div');
        messageEl.textContent = options.message;
        messageEl.style.cssText = `
            all: initial;
            flex: 1;
            color: var(--color-text, #333333);
            font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
            font-size: var(--text-base, 14px);
            line-height: 1.4;
            display: block;
        `;

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            all: initial;
            background: none;
            border: none;
            color: var(--color-text-secondary, #666666);
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            line-height: 1;
            font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        `;
        closeBtn.onclick = () => removeToast(toast, options.position);
        closeBtn.onmouseenter = function() { this.style.color = 'var(--color-text, #333333)'; };
        closeBtn.onmouseleave = function() { this.style.color = 'var(--color-text-secondary, #666666)'; };

        toast.appendChild(iconEl);
        toast.appendChild(messageEl);
        toast.appendChild(closeBtn);

        return toast;
    }

    // Remove toast with animation
    function removeToast(toast, position) {
        toast.dataset.state = 'hiding';
        toast.style.animation = 'slideOut 0.3s ease-out';
        
        setTimeout(() => {
            toast.remove();
            
            // Remove from visible toasts
            const index = visibleToasts.findIndex(t => t.element === toast);
            if (index !== -1) {
                visibleToasts.splice(index, 1);
            }

            // Clean up empty containers
            const container = containers[position];
            if (container && container.children.length === 0) {
                container.remove();
                delete containers[position];
            }

            // Show next queued toast
            processQueue();
        }, 300);
    }

    // Process toast queue
    function processQueue() {
        if (toastQueue.length === 0) return;
        if (visibleToasts.length >= DEFAULT_OPTIONS.maxVisible) return;

        const options = toastQueue.shift();
        showToastNow(options);
    }

    // Show toast immediately
    function showToastNow(options) {
        const container = getContainer(options.position);
        const toast = createToast(options);
        
        container.appendChild(toast);
        
        visibleToasts.push({
            element: toast,
            position: options.position
        });

        // Auto-dismiss if duration > 0
        if (options.duration > 0) {
            setTimeout(() => {
                removeToast(toast, options.position);
            }, options.duration);
        }
    }

    // Main show function
    function show(messageOrOptions, type = 'info') {
        let options;

        if (typeof messageOrOptions === 'string') {
            options = {
                message: messageOrOptions,
                type: type,
                position: DEFAULT_OPTIONS.position,
                duration: DEFAULT_OPTIONS.duration
            };
        } else {
            options = {
                ...DEFAULT_OPTIONS,
                ...messageOrOptions
            };
        }

        // Add to queue or show immediately
        if (visibleToasts.length >= DEFAULT_OPTIONS.maxVisible) {
            toastQueue.push(options);
        } else {
            showToastNow(options);
        }
    }

    // Add animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Export API
    window.Toasts = {
        show: show,
        success: (message, options = {}) => show({ message, type: 'success', ...options }),
        error: (message, options = {}) => show({ message, type: 'error', ...options }),
        warning: (message, options = {}) => show({ message, type: 'warning', ...options }),
        info: (message, options = {}) => show({ message, type: 'info', ...options }),
        version: '1.0.0'
    };

    console.log('[Toasts Everywhere] Library loaded');

})(window, document);

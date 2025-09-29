// Northwestern Mutual Design System Components
// Professional UI Components for Fortune 100 Deployment

class NMDesignSystem {
    constructor() {
        this.notifications = [];
        this.modals = new Map();
        this.dropdowns = new Map();
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.loadDesignSystemCSS();
        console.log('✅ Northwestern Mutual Design System initialized');
    }

    loadDesignSystemCSS() {
        if (!document.querySelector('link[href*="design-system.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/design-system.css';
            document.head.appendChild(link);
        }
    }

    initializeEventListeners() {
        // Global click handler for dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nm-dropdown')) {
                this.closeAllDropdowns();
            }
        });

        // Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllDropdowns();
                this.closeTopModal();
            }
        });
    }

    // Notification System
    showNotification(message, type = 'info', duration = 5000) {
        const id = 'nm-notification-' + Date.now();
        const notification = {
            id,
            message,
            type,
            duration,
            element: this.createNotificationElement(id, message, type)
        };

        this.notifications.push(notification);
        this.renderNotification(notification);

        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(id);
            }, duration);
        }

        return id;
    }

    createNotificationElement(id, message, type) {
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `nm-notification nm-notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: var(--nm-space-4);
            right: var(--nm-space-4);
            max-width: 400px;
            padding: var(--nm-space-4);
            background: var(--nm-white);
            border-radius: var(--nm-radius-lg);
            box-shadow: var(--nm-shadow-xl);
            border-left: 4px solid ${this.getNotificationColor(type)};
            z-index: var(--nm-z-tooltip);
            animation: nm-slide-in 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: var(--nm-space-3);
        `;

        const icon = this.getNotificationIcon(type);
        const content = document.createElement('div');
        content.style.flex = '1';
        content.innerHTML = `
            <div style="display: flex; align-items: center; gap: var(--nm-space-2);">
                ${icon}
                <span class="nm-body" style="margin: 0;">${message}</span>
            </div>
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'nm-btn-ghost';
        closeButton.style.cssText = `
            padding: var(--nm-space-1);
            margin: 0;
            min-width: auto;
            border: none;
            background: none;
            font-size: var(--nm-text-lg);
            color: var(--nm-gray-500);
            cursor: pointer;
        `;
        closeButton.onclick = () => this.removeNotification(id);

        notification.appendChild(content);
        notification.appendChild(closeButton);
        return notification;
    }

    getNotificationColor(type) {
        const colors = {
            success: 'var(--nm-success)',
            warning: 'var(--nm-warning)',
            error: 'var(--nm-error)',
            info: 'var(--nm-info)',
            primary: 'var(--nm-primary-blue)'
        };
        return colors[type] || colors.info;
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️',
            primary: '🔔'
        };
        return `<span style="font-size: var(--nm-text-lg);">${icons[type] || icons.info}</span>`;
    }

    renderNotification(notification) {
        if (!document.getElementById('nm-notifications-container')) {
            const container = document.createElement('div');
            container.id = 'nm-notifications-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                right: 0;
                z-index: var(--nm-z-tooltip);
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const container = document.getElementById('nm-notifications-container');
        notification.element.style.pointerEvents = 'auto';
        container.appendChild(notification.element);
    }

    removeNotification(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.element.style.animation = 'nm-slide-out 0.3s ease-in';
            setTimeout(() => {
                notification.element.remove();
                this.notifications = this.notifications.filter(n => n.id !== id);
            }, 300);
        }
    }

    // Modal System
    showModal(content, options = {}) {
        const id = 'nm-modal-' + Date.now();
        const modal = this.createModal(id, content, options);
        this.modals.set(id, modal);
        this.renderModal(modal);
        return id;
    }

    createModal(id, content, options) {
        const {
            title = '',
            size = 'md',
            closable = true,
            backdrop = true,
            className = ''
        } = options;

        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = `nm-modal-overlay ${className}`;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: var(--nm-z-modal);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--nm-space-4);
            animation: nm-fade-in 0.2s ease-out;
        `;

        const modal = document.createElement('div');
        modal.className = `nm-modal nm-modal-${size}`;
        modal.style.cssText = `
            background: var(--nm-white);
            border-radius: var(--nm-radius-xl);
            box-shadow: var(--nm-shadow-2xl);
            max-height: 90vh;
            overflow: hidden;
            animation: nm-scale-in 0.2s ease-out;
            ${this.getModalSize(size)}
        `;

        if (title) {
            const header = document.createElement('div');
            header.className = 'nm-modal-header';
            header.style.cssText = `
                padding: var(--nm-space-6);
                border-bottom: 1px solid var(--nm-gray-200);
                display: flex;
                align-items: center;
                justify-content: space-between;
            `;

            const titleElement = document.createElement('h3');
            titleElement.className = 'nm-heading-4';
            titleElement.style.margin = '0';
            titleElement.textContent = title;

            header.appendChild(titleElement);

            if (closable) {
                const closeButton = document.createElement('button');
                closeButton.innerHTML = '×';
                closeButton.className = 'nm-btn-ghost';
                closeButton.style.cssText = `
                    padding: var(--nm-space-2);
                    margin: 0;
                    min-width: auto;
                    font-size: var(--nm-text-2xl);
                    line-height: 1;
                `;
                closeButton.onclick = () => this.closeModal(id);
                header.appendChild(closeButton);
            }

            modal.appendChild(header);
        }

        const body = document.createElement('div');
        body.className = 'nm-modal-body';
        body.style.cssText = `
            padding: var(--nm-space-6);
            overflow-y: auto;
            max-height: calc(90vh - 120px);
        `;

        if (typeof content === 'string') {
            body.innerHTML = content;
        } else {
            body.appendChild(content);
        }

        modal.appendChild(body);

        if (backdrop && closable) {
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.closeModal(id);
                }
            };
        }

        overlay.appendChild(modal);
        return { id, element: overlay, options };
    }

    getModalSize(size) {
        const sizes = {
            sm: 'width: 400px;',
            md: 'width: 600px;',
            lg: 'width: 800px;',
            xl: 'width: 1000px;',
            full: 'width: 95vw; height: 95vh;'
        };
        return sizes[size] || sizes.md;
    }

    renderModal(modal) {
        document.body.appendChild(modal.element);
        document.body.style.overflow = 'hidden';
    }

    closeModal(id) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.element.style.animation = 'nm-fade-out 0.2s ease-in';
            setTimeout(() => {
                modal.element.remove();
                this.modals.delete(id);
                if (this.modals.size === 0) {
                    document.body.style.overflow = '';
                }
            }, 200);
        }
    }

    closeTopModal() {
        const modals = Array.from(this.modals.keys());
        if (modals.length > 0) {
            this.closeModal(modals[modals.length - 1]);
        }
    }

    // Dropdown System
    createDropdown(triggerElement, content, options = {}) {
        const id = 'nm-dropdown-' + Date.now();
        const dropdown = this.createDropdownElement(id, content, options);
        this.dropdowns.set(id, { dropdown, trigger: triggerElement, options });

        triggerElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(id);
        });

        return id;
    }

    createDropdownElement(id, content, options) {
        const {
            position = 'bottom-left',
            className = ''
        } = options;

        const dropdown = document.createElement('div');
        dropdown.id = id;
        dropdown.className = `nm-dropdown ${className}`;
        dropdown.style.cssText = `
            position: absolute;
            background: var(--nm-white);
            border-radius: var(--nm-radius-lg);
            box-shadow: var(--nm-shadow-xl);
            border: 1px solid var(--nm-gray-200);
            z-index: var(--nm-z-dropdown);
            min-width: 200px;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: var(--nm-transition-all);
        `;

        if (typeof content === 'string') {
            dropdown.innerHTML = content;
        } else {
            dropdown.appendChild(content);
        }

        return dropdown;
    }

    toggleDropdown(id) {
        const dropdownData = this.dropdowns.get(id);
        if (!dropdownData) return;

        const isOpen = dropdownData.dropdown.style.opacity === '1';

        this.closeAllDropdowns();

        if (!isOpen) {
            this.openDropdown(id);
        }
    }

    openDropdown(id) {
        const dropdownData = this.dropdowns.get(id);
        if (!dropdownData) return;

        const { dropdown, trigger } = dropdownData;

        if (!dropdown.parentElement) {
            document.body.appendChild(dropdown);
        }

        const triggerRect = trigger.getBoundingClientRect();
        dropdown.style.top = (triggerRect.bottom + 5) + 'px';
        dropdown.style.left = triggerRect.left + 'px';
        dropdown.style.opacity = '1';
        dropdown.style.visibility = 'visible';
        dropdown.style.transform = 'translateY(0)';
    }

    closeAllDropdowns() {
        this.dropdowns.forEach((dropdownData, id) => {
            const { dropdown } = dropdownData;
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
        });
    }

    // Loading States
    setLoadingState(element, isLoading) {
        if (isLoading) {
            element.classList.add('nm-loading');
            element.disabled = true;
        } else {
            element.classList.remove('nm-loading');
            element.disabled = false;
        }
    }

    // Form Validation
    validateForm(formElement) {
        const errors = [];
        const requiredFields = formElement.querySelectorAll('[required]');

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.setFieldError(field, 'This field is required');
                errors.push({
                    field: field.name || field.id,
                    message: 'This field is required'
                });
            } else {
                this.clearFieldError(field);
            }
        });

        // Email validation
        const emailFields = formElement.querySelectorAll('input[type="email"]');
        emailFields.forEach(field => {
            if (field.value && !this.isValidEmail(field.value)) {
                this.setFieldError(field, 'Please enter a valid email address');
                errors.push({
                    field: field.name || field.id,
                    message: 'Please enter a valid email address'
                });
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    setFieldError(field, message) {
        field.classList.add('nm-input-error');

        let errorElement = field.parentNode.querySelector('.nm-error-text');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'nm-error-text';
            field.parentNode.appendChild(errorElement);
        }
        errorElement.textContent = message;
    }

    clearFieldError(field) {
        field.classList.remove('nm-input-error');
        const errorElement = field.parentNode.querySelector('.nm-error-text');
        if (errorElement) {
            errorElement.remove();
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Utility Methods
    createElement(tag, className = '', content = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) {
            if (typeof content === 'string') {
                element.innerHTML = content;
            } else {
                element.appendChild(content);
            }
        }
        return element;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(date));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Animation CSS
const animationCSS = `
@keyframes nm-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes nm-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
}

@keyframes nm-scale-in {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

@keyframes nm-slide-in {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes nm-slide-out {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100%);
    }
}
`;

// Add animation CSS to document
if (!document.querySelector('#nm-animations')) {
    const style = document.createElement('style');
    style.id = 'nm-animations';
    style.textContent = animationCSS;
    document.head.appendChild(style);
}

// Initialize Design System
window.nmDesignSystem = new NMDesignSystem();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NMDesignSystem;
}
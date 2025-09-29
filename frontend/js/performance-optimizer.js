// Frontend Performance Optimization for Northwestern Mutual Platform
// Enterprise-grade client-side performance enhancements

class FrontendPerformanceOptimizer {
    constructor() {
        this.performanceMetrics = {
            pageLoadTime: 0,
            domContentLoaded: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            firstInputDelay: 0,
            cumulativeLayoutShift: 0,
            timeToInteractive: 0
        };

        this.resourceCache = new Map();
        this.componentCache = new Map();
        this.intersectionObserver = null;
        this.performanceObserver = null;
        this.isOptimizationEnabled = true;

        this.init();
        console.log('🚀 Frontend Performance Optimizer initialized');
    }

    init() {
        // Initialize performance monitoring
        this.setupPerformanceObserver();
        this.setupIntersectionObserver();
        this.setupResourceOptimization();
        this.setupImageOptimization();
        this.setupCriticalResourcePreloading();
        this.setupServiceWorker();

        // Performance metrics collection
        this.collectCoreWebVitals();

        // DOM optimization
        this.optimizeDOM();

        // Event listener optimization
        this.optimizeEventListeners();
    }

    // Core Web Vitals Collection
    collectCoreWebVitals() {
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.performanceMetrics.largestContentfulPaint = lastEntry.startTime;
            this.logMetric('LCP', lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
                this.performanceMetrics.firstInputDelay = entry.processingStart - entry.startTime;
                this.logMetric('FID', entry.processingStart - entry.startTime);
            });
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                    this.performanceMetrics.cumulativeLayoutShift = clsValue;
                    this.logMetric('CLS', clsValue);
                }
            });
        }).observe({ entryTypes: ['layout-shift'] });

        // Navigation Timing
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            this.performanceMetrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
            this.performanceMetrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;

            this.logMetric('Page Load Time', this.performanceMetrics.pageLoadTime);
            this.logMetric('DOM Content Loaded', this.performanceMetrics.domContentLoaded);
        });
    }

    // Resource Optimization
    setupResourceOptimization() {
        // Preload critical resources
        this.preloadCriticalResources();

        // Implement resource hints
        this.addResourceHints();

        // Setup lazy loading for non-critical resources
        this.setupLazyLoading();
    }

    preloadCriticalResources() {
        const criticalResources = [
            { href: '/css/design-system.css', as: 'style' },
            { href: '/css/northwestern-mutual-theme.css', as: 'style' },
            { href: '/js/state-management-enhanced.js', as: 'script' },
            { href: '/js/design-system-components.js', as: 'script' }
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            if (resource.as === 'style') {
                link.onload = () => {
                    link.rel = 'stylesheet';
                };
            }
            document.head.appendChild(link);
        });
    }

    addResourceHints() {
        const hints = [
            { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
            { rel: 'dns-prefetch', href: 'https://cdn.jsdelivr.net' },
            { rel: 'dns-prefetch', href: 'https://cdn.socket.io' },
            { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true }
        ];

        hints.forEach(hint => {
            const link = document.createElement('link');
            link.rel = hint.rel;
            link.href = hint.href;
            if (hint.crossorigin) link.crossOrigin = hint.crossorigin;
            document.head.appendChild(link);
        });
    }

    // Image Optimization
    setupImageOptimization() {
        // Lazy loading for images
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.remove('lazy');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }

        // WebP support detection and optimization
        this.optimizeImageFormats();
    }

    optimizeImageFormats() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.toBlob = canvas.toBlob || canvas.msToBlob;

        // Check WebP support
        canvas.toBlob((blob) => {
            const supportsWebP = blob && blob.type === 'image/webp';
            if (supportsWebP) {
                document.documentElement.classList.add('webp-support');
            }
        }, 'image/webp');
    }

    // Lazy Loading Implementation
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadLazyComponent(entry.target);
                        this.intersectionObserver.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px'
            });

            // Observe lazy components
            document.querySelectorAll('[data-lazy-component]').forEach(element => {
                this.intersectionObserver.observe(element);
            });
        }
    }

    loadLazyComponent(element) {
        const componentName = element.dataset.lazyComponent;

        // Check if component is already cached
        if (this.componentCache.has(componentName)) {
            this.renderCachedComponent(element, componentName);
            return;
        }

        // Load component dynamically
        import(`./components/${componentName}.js`)
            .then(module => {
                this.componentCache.set(componentName, module.default);
                this.renderComponent(element, module.default);
            })
            .catch(error => {
                console.error(`Failed to load component ${componentName}:`, error);
            });
    }

    renderComponent(element, Component) {
        if (typeof Component === 'function') {
            const instance = new Component(element);
            element.classList.add('component-loaded');
        }
    }

    renderCachedComponent(element, componentName) {
        const Component = this.componentCache.get(componentName);
        this.renderComponent(element, Component);
    }

    // DOM Optimization
    optimizeDOM() {
        // Virtual scrolling for large lists
        this.setupVirtualScrolling();

        // DOM fragment optimization
        this.optimizeDOMUpdates();

        // Event delegation
        this.setupEventDelegation();
    }

    setupVirtualScrolling() {
        const virtualScrollContainers = document.querySelectorAll('[data-virtual-scroll]');

        virtualScrollContainers.forEach(container => {
            new VirtualScrollManager(container);
        });
    }

    optimizeDOMUpdates() {
        // Batch DOM updates using DocumentFragment
        window.batchDOMUpdates = (updates) => {
            const fragment = document.createDocumentFragment();
            updates.forEach(update => update(fragment));
            return fragment;
        };

        // Throttled DOM updates
        window.throttledDOMUpdate = this.throttle((callback) => {
            requestAnimationFrame(callback);
        }, 16); // 60fps
    }

    // Event Listener Optimization
    optimizeEventListeners() {
        // Passive event listeners for scroll performance
        this.setupPassiveListeners();

        // Debounced resize handler
        this.setupOptimizedResize();

        // Touch event optimization
        this.setupTouchOptimization();
    }

    setupPassiveListeners() {
        const passiveEvents = ['scroll', 'wheel', 'touchstart', 'touchmove'];

        passiveEvents.forEach(eventType => {
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (passiveEvents.includes(type) && typeof options !== 'object') {
                    options = { passive: true };
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
        });
    }

    setupOptimizedResize() {
        let resizeTimer;
        const optimizedResize = this.debounce(() => {
            window.dispatchEvent(new CustomEvent('optimizedResize'));
        }, 250);

        window.addEventListener('resize', optimizedResize, { passive: true });
    }

    setupTouchOptimization() {
        // Prevent 300ms click delay on mobile
        document.addEventListener('touchstart', () => {}, { passive: true });

        // Optimize touch interactions
        const style = document.createElement('style');
        style.textContent = `
            * {
                touch-action: manipulation;
            }

            .scrollable {
                -webkit-overflow-scrolling: touch;
                overflow-scrolling: touch;
            }
        `;
        document.head.appendChild(style);
    }

    // Service Worker Setup
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registered:', registration);
                })
                .catch(error => {
                    console.warn('❌ Service Worker registration failed:', error);
                });
        }
    }

    // Critical Resource Preloading
    setupCriticalResourcePreloading() {
        // Preload next page resources based on user behavior
        this.setupPredictivePreloading();

        // Critical CSS inlining
        this.inlineCriticalCSS();
    }

    setupPredictivePreloading() {
        const links = document.querySelectorAll('a[href]');
        const linkObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const href = entry.target.href;
                    this.preloadPage(href);
                }
            });
        });

        links.forEach(link => linkObserver.observe(link));
    }

    preloadPage(href) {
        if (this.resourceCache.has(href)) return;

        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);

        this.resourceCache.set(href, true);
    }

    inlineCriticalCSS() {
        // This would be done at build time in production
        // For now, we'll optimize the critical path
        const criticalStyles = `
            .loading { opacity: 0; }
            .dashboard-header { display: flex; }
            .stats-grid { display: grid; }
        `;

        const style = document.createElement('style');
        style.textContent = criticalStyles;
        document.head.insertBefore(style, document.head.firstChild);
    }

    // Performance Monitoring
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    this.analyzePerformanceEntry(entry);
                });
            });

            this.performanceObserver.observe({ entryTypes: ['measure', 'mark', 'resource'] });
        }
    }

    analyzePerformanceEntry(entry) {
        // Log slow resources
        if (entry.entryType === 'resource' && entry.duration > 1000) {
            console.warn(`🐌 Slow resource: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
        }

        // Track performance marks
        if (entry.entryType === 'mark') {
            console.log(`📊 Performance mark: ${entry.name} at ${entry.startTime.toFixed(2)}ms`);
        }
    }

    // Utility Methods
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
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

    logMetric(name, value) {
        console.log(`📊 ${name}: ${value.toFixed(2)}ms`);

        // Send to analytics in production
        if (typeof gtag !== 'undefined') {
            gtag('event', 'timing_complete', {
                name: name,
                value: Math.round(value)
            });
        }
    }

    // Public API
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    measureOperation(name, operation) {
        const startMark = `${name}-start`;
        const endMark = `${name}-end`;

        performance.mark(startMark);
        const result = operation();
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);

        return result;
    }

    clearCache() {
        this.resourceCache.clear();
        this.componentCache.clear();
        console.log('🗑️ Performance cache cleared');
    }
}

// Virtual Scroll Manager for large lists
class VirtualScrollManager {
    constructor(container) {
        this.container = container;
        this.itemHeight = 50; // Default item height
        this.buffer = 5; // Items to render outside viewport
        this.items = [];
        this.startIndex = 0;
        this.endIndex = 0;

        this.init();
    }

    init() {
        this.container.style.overflowY = 'auto';
        this.setupScrollListener();
        this.render();
    }

    setupScrollListener() {
        this.container.addEventListener('scroll',
            this.debounce(() => this.handleScroll(), 10),
            { passive: true }
        );
    }

    handleScroll() {
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;

        this.startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
        this.endIndex = Math.min(
            this.items.length,
            Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.buffer
        );

        this.render();
    }

    render() {
        // Implementation would depend on specific list component
        // This is a simplified version
        const fragment = document.createDocumentFragment();

        for (let i = this.startIndex; i < this.endIndex; i++) {
            if (this.items[i]) {
                const element = this.createItemElement(this.items[i], i);
                fragment.appendChild(element);
            }
        }

        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }

    createItemElement(item, index) {
        const div = document.createElement('div');
        div.style.height = `${this.itemHeight}px`;
        div.style.transform = `translateY(${index * this.itemHeight}px)`;
        div.textContent = item.name || `Item ${index}`;
        return div;
    }

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}

// Initialize performance optimizer
const performanceOptimizer = new FrontendPerformanceOptimizer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrontendPerformanceOptimizer, VirtualScrollManager };
}

// Global performance utilities
window.performanceOptimizer = performanceOptimizer;
window.measurePerformance = (name, operation) => performanceOptimizer.measureOperation(name, operation);

console.log('✅ Frontend Performance Optimization System ready');
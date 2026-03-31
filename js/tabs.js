/**
 * Get current user permissions from session
 * Returns ["*"] if no session or permissions not configured
 */
function getUserPermissions() {
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) return ['*'];
        
        // Permissions stored in localStorage after login
        const permsJson = localStorage.getItem('userPermissions');
        if (!permsJson) return ['*'];
        
        return JSON.parse(permsJson);
    } catch (e) {
        console.warn('[Tabs Everywhere] Error getting permissions:', e);
        return ['*'];
    }
}

/**
 * Check if user has required permission
 * Wildcard "*" grants all access
 */
function hasPermission(required, userPermissions) {
    if (!required) return true; // No permission required
    if (userPermissions.includes('*')) return true; // Wildcard
    return userPermissions.includes(required);
}

class TabsEverywhere {
    constructor(config) {
        this.config = config || {};
        this.sitemap = null;
        this.managers = {};
    }

    async init() {
        await this.loadSitemap();
        
        // Render header if configured
        if (this.config.header) {
            this.renderHeader();
        }
        
        this.renderTopLevelTabs();
        
        const hash = window.location.hash.slice(1);
        const pathSegments = hash.split('/').filter(s => s);
        const tabParam = pathSegments[0];
        const itemParam = pathSegments[1];
        
        const tabToLoad = tabParam || this.sitemap.tabs[0].id;
        await this.loadTab(tabToLoad, itemParam, true);
        
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1);
            const segments = hash.split('/').filter(s => s);
            this.loadTab(segments[0] || this.sitemap.tabs[0].id, segments[1], false);
        });
    }

    renderHeader() {
        const headerConfig = this.config.header;
        const headerContainer = document.getElementById(headerConfig.containerId || 'header-container');
        
        if (!headerContainer) {
            console.warn('[Tabs Everywhere] Header container not found:', headerConfig.containerId);
            return;
        }
        
        // Build left side (title + icon)
        let leftHtml = '<h1>';
        
        if (headerConfig.icon) {
            const iconHtml = headerConfig.iconLink 
                ? `<a href="${headerConfig.iconLink}" class="brand-icon-link" title="${headerConfig.iconTitle || ''}">
                     <span class="brand-icon">
                       <i class="${headerConfig.icon} brand-icon-default"></i>
                       ${headerConfig.iconHover ? `<i class="${headerConfig.iconHover} brand-icon-hover"></i>` : ''}
                     </span>
                   </a>`
                : `<i class="${headerConfig.icon} brand-icon"></i>`;
            leftHtml += iconHtml;
        }
        
        if (headerConfig.title) {
            leftHtml += headerConfig.title;
        }
        
        leftHtml += '</h1>';
        
        // Build right side (controls)
        let rightHtml = '<div class="header-controls">';
        
        if (headerConfig.controls && Array.isArray(headerConfig.controls)) {
            headerConfig.controls.forEach(control => {
                if (control.type === 'text') {
                    const className = control.className || 'header-text';
                    rightHtml += `<span id="${control.id || ''}" class="${className}">${control.text || ''}</span>`;
                } else if (control.type === 'icon') {
                    rightHtml += `<i id="${control.id || ''}" class="${control.icon} header-icon" title="${control.title || ''}"></i>`;
                }
            });
        }
        
        rightHtml += '</div>';
        
        // Render header
        headerContainer.innerHTML = leftHtml + rightHtml;
        
        // Wire up click handlers
        if (headerConfig.controls) {
            headerConfig.controls.forEach(control => {
                if (control.onClick && control.id) {
                    const element = document.getElementById(control.id);
                    if (element) {
                        element.addEventListener('click', control.onClick);
                    }
                }
            });
        }
        
        // Wire up icon link click if provided
        if (headerConfig.iconLink && headerConfig.iconOnClick) {
            const iconLink = headerContainer.querySelector('.brand-icon-link');
            if (iconLink) {
                iconLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    headerConfig.iconOnClick();
                });
            }
        }
        
        console.log('[Tabs Everywhere] Header rendered');
    }

    async loadSitemap() {
        // Support direct sitemap object via config (for demos/testing)
        if (this.config.sitemap) {
            this.sitemap = this.config.sitemap;
            console.log('[Tabs Everywhere] Using provided sitemap object');
        } else {
            const response = await fetch(this.config.sitemapPath || '/sitemap.json');
            this.sitemap = await response.json();
        }
        
        const tabPromises = this.sitemap.tabs.map(async (tab, index) => {
            if (tab.configSource) {
                try {
                    const configResponse = await fetch(tab.configSource);
                    const externalConfig = await configResponse.json();
                    this.sitemap.tabs[index] = externalConfig;
                } catch (error) {
                    console.error(`Failed to load external config: ${tab.configSource}`, error);
                }
            }
        });
        
        await Promise.all(tabPromises);
    }

    renderTopLevelTabs() {
        const container = document.getElementById(this.config.tabsContainerId || 'tabs-container');
        if (!container) return;

        // Get user permissions
        const userPermissions = getUserPermissions();
        
        // Detect current environment
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const currentEnvironment = isLocalhost ? 'localhost' : 'production';
        
        let html = '';
        this.sitemap.tabs.forEach(tab => {
            // Check permission (backward compatible - if no requiredPermission, always show)
            if (tab.requiredPermission && !hasPermission(tab.requiredPermission, userPermissions)) {
                console.log('[Tabs Everywhere] Tab hidden due to permissions:', tab.id);
                return; // Skip this tab
            }
            
            // Check environment (if showInEnvironments specified, only show in those environments)
            if (tab.showInEnvironments && !tab.showInEnvironments.includes(currentEnvironment)) {
                console.log('[Tabs Everywhere] Tab hidden due to environment:', tab.id, 'requires', tab.showInEnvironments, 'but running in', currentEnvironment);
                return; // Skip this tab
            }
            
            html += `
                <div class="tab" data-tab-id="${tab.id}" id="tab-${tab.id}" onclick="window.UI.tabs.loadTab('${tab.id}'); window.keyboardNav?.setFocusOnContainer(event.target)">
                    <i class="${tab.icon}"></i>
                    <span class="tab-label">${tab.label}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async loadTab(tabId, itemId = null, isInit = false) {
        console.log('[Tabs Everywhere] ========================================');
        console.log('[Tabs Everywhere] loadTab START:', { tabId, itemId, isInit });
        console.log('[Tabs Everywhere] currentlyLoadingTab:', this.currentlyLoadingTab);
        
        // Prevent double-loading same tab
        if (this.currentlyLoadingTab === tabId && !isInit) {
            console.log('[Tabs Everywhere] ❌ Already loading this tab, skipping');
            return;
        }
        this.currentlyLoadingTab = tabId;
        console.log('[Tabs Everywhere] ✅ Set currentlyLoadingTab to:', tabId);
        
        const tab = this.sitemap.tabs.find(t => t.id === tabId);
        console.log('[Tabs Everywhere] Found tab config:', tab ? tab.label : 'NOT FOUND');
        if (!tab) {
            console.error('[Tabs Everywhere] ❌ Tab not found:', tabId, '- redirecting to first tab');
            // Redirect to first visible tab
            const firstTab = this.sitemap.tabs[0];
            if (firstTab) {
                window.location.hash = firstTab.id;
                return;
            }
            return;
        }

        document.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
            t.removeAttribute('aria-current');
        });
        const activeTab = Array.from(document.querySelectorAll('.tab')).find(t => 
            t.textContent.includes(tab.label)
        );
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-current', 'page');
        }

        const contentContainer = document.getElementById(this.config.contentContainerId || 'content-container');
        
        // Check if tab has static section with htmlSource (treat like direct htmlSource)
        const staticSection = tab.sections?.find(s => s.type === 'static' && s.htmlSource);
        
        // If tab has direct htmlSource OR static section, load it (supports "single" layout tabs)
        if (tab.htmlSource || staticSection) {
            console.log('[Tabs Everywhere] 📄 Loading HTML content tab');
            
            // Hide ALL existing tab content first
            const allTabDivs = contentContainer.querySelectorAll('[data-tab-id]');
            console.log('[Tabs Everywhere] 🔍 Found', allTabDivs.length, 'existing tab divs');
            allTabDivs.forEach(div => {
                console.log('[Tabs Everywhere] 👁️ Hiding div:', div.dataset.tabId);
                div.classList.add('display-none');
                div.classList.remove('display-block');
                div.style.display = 'none'; // Force hide
            });
            
            // Check if this tab's content already exists
            let tabContentDiv = contentContainer.querySelector('[data-tab-id="' + tabId + '"]');
            console.log('[Tabs Everywhere] 🔍 Looking for cached div with tabId:', tabId, 'found:', !!tabContentDiv);
            if (tabContentDiv) {
                // Just show existing content
                tabContentDiv.classList.remove('display-none');
                tabContentDiv.classList.add('display-block');
                tabContentDiv.style.display = 'block'; // Force show
                console.log('[Tabs Everywhere] ✅ Showing cached content for:', tabId);
                
                // Clear loading guard and exit
                this.currentlyLoadingTab = null;
                console.log('[Tabs Everywhere] ✅ Cleared currentlyLoadingTab');
                console.log('[Tabs Everywhere] loadTab COMPLETE');
                console.log('[Tabs Everywhere] ========================================');
                return;
            }
            
            // Load fresh content
            try {
                const htmlSource = tab.htmlSource || staticSection.htmlSource;
                console.log('[Tabs Everywhere] 🌐 Fetching HTML from:', htmlSource);
                const response = await fetch(htmlSource + '?v=' + Date.now());
                const html = await response.text();
                console.log('[Tabs Everywhere] ✅ HTML fetched, length:', html.length);
                
                tabContentDiv = document.createElement('div');
                tabContentDiv.dataset.tabId = tabId;
                
                if (tab.headerHtml) {
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'tab-custom-header';
                    headerDiv.innerHTML = tab.headerHtml;
                    tabContentDiv.appendChild(headerDiv);
                }
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'tab-scrollable-content';
                
                // If this is a static section, wrap with page header FIRST
                if (staticSection) {
                    const headerControls = staticSection.headerControls || '';
                    contentDiv.innerHTML = `
                        <div class="page-header">
                            <div class="page-header-text">
                                <h3>${staticSection.title || tab.label}</h3>
                                ${staticSection.description ? `<p>${staticSection.description}</p>` : ''}
                            </div>
                            ${headerControls ? `<div class="page-header-controls">${headerControls}</div>` : ''}
                        </div>
                        <div class="detail-body">
                            ${html}
                        </div>
                    `;
                } else {
                    contentDiv.innerHTML = html;
                }
                
                tabContentDiv.appendChild(contentDiv);
                contentContainer.appendChild(tabContentDiv);
                console.log('[Tabs Everywhere] ✅ Content appended to DOM');
                
                // NOW execute scripts (after HTML is in DOM)
                const scripts = contentDiv.querySelectorAll('script');
                console.log('[Tabs Everywhere] 📜 Found', scripts.length, 'scripts');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => {
                        // Add cache-busting to module src to force re-execution
                        if (attr.name === 'src' && oldScript.type === 'module') {
                            const cacheBust = '?v=' + Date.now();
                            newScript.setAttribute(attr.name, attr.value + cacheBust);
                            console.log('[Tabs Everywhere] 🔄 Cache-busting module:', attr.value + cacheBust);
                        } else {
                            newScript.setAttribute(attr.name, attr.value);
                        }
                    });
                    newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
                console.log('[Tabs Everywhere] ✅ Scripts executed');
                
                setTimeout(() => this.populateSidebarsFromSections(tab), 50);
                
                // Show the new content
                tabContentDiv.classList.remove('display-none');
                tabContentDiv.classList.add('display-block');
                console.log('[Tabs Everywhere] ✅ Tab content visible');
                
                setTimeout(() => {
                    const event = new CustomEvent('tabs-everywhere:tab-changed', {
                        detail: { tabId: tabId, tab: tab, itemId: itemId }
                    });
                    document.dispatchEvent(event);
                    console.log('[Tabs Everywhere] 📡 Dispatched tab-changed event');
                }, 100);
            } catch (error) {
                console.error('[Tabs Everywhere] Error loading tab HTML:', error);
                tabContentDiv = document.createElement('div');
                tabContentDiv.dataset.tabId = tabId;
                tabContentDiv.innerHTML = `<div class="layout single"><div class="content"><p>Error loading content from ${tab.htmlSource}</p></div></div>`;
                contentContainer.appendChild(tabContentDiv);
                tabContentDiv.classList.add('display-block');
            }
        } else {
            console.log('[Tabs Everywhere] 📋 Loading sidebar-content tab:', tabId);
            
            // ALWAYS render fresh HTML and create new manager (no caching)
            console.log('[Tabs Everywhere] 🔨 Rendering fresh layout HTML');
            contentContainer.innerHTML = this.renderLayout(tab);
            console.log('[Tabs Everywhere] ✅ HTML rendered, creating new TabManager');
            this.managers[tabId] = new TabManager(tab, this.config, this);
            console.log('[Tabs Everywhere] ✅ TabManager created');

            console.log('[Tabs Everywhere] 🚀 Calling manager.init...');
            try {
                await this.managers[tabId].init(itemId, !isInit);
                console.log('[Tabs Everywhere] ✅ Manager.init complete');
            } catch (error) {
                console.error('[Tabs Everywhere] ❌ Manager.init failed:', error);
                throw error;
            }
            
            // Check for static section
            const staticSection = tab.sections?.find(s => s.type === 'static');
            if (staticSection) {
                await this.loadStaticSection(tab, staticSection);
            }
            
            // Dispatch tab change event after content is ready
            const event = new CustomEvent('tabs-everywhere:tab-changed', {
                detail: { tabId: tabId, tab: tab, itemId: itemId }
            });
            document.dispatchEvent(event);
        }
        
        if (!isInit) {
            console.log('[Tabs Everywhere] 📝 Updating history');
            this.updateHistory(tabId, itemId);
        }
        
        // Clear loading guard after tab load completes
        this.currentlyLoadingTab = null;
        console.log('[Tabs Everywhere] ✅ Cleared currentlyLoadingTab');
        console.log('[Tabs Everywhere] loadTab COMPLETE');
        console.log('[Tabs Everywhere] ========================================');
    }
    
    updateHistory(tabId, itemId = null, isFirstItem = false) {
        const isFirstTab = tabId === this.sitemap.tabs[0].id;
        let hash = '';
        
        if (!isFirstTab) {
            hash = tabId;
            if (itemId && !isFirstItem) {
                hash += '/' + itemId;
            }
        }
        
        // Prevent hashchange loop - only update if different
        const currentHash = window.location.hash.slice(1);
        if (currentHash !== hash) {
            window.location.hash = hash;
        }
    }

    renderLayout(tab) {
        const layouts = {
            'sidebar-content': `
                <div class="layout sidebar-content">
                    <div id="${tab.id}-sidebar" class="sidebar">
                        <div id="${tab.id}-sidebar-scroll" class="sidebar-scroll"></div>
                    </div>
                    <div id="${tab.id}-content" class="content">
                        <div id="${tab.id}-detail" class="section"></div>
                        <div id="${tab.id}-new" class="section">New Item Form</div>
                    </div>
                </div>
            `,
            'single': `
                <div class="layout single">
                    <div id="${tab.id}-content" class="content"></div>
                </div>
            `
        };
        
        return layouts[tab.layout] || layouts['sidebar-content'];
    }
    
    populateSidebarsFromSections(tab) {
        if (!tab.sections) return;
        
        tab.sections.forEach(section => {
            if (section.type === 'menu' && section.items) {
                const sidebar = document.getElementById(section.id);
                if (sidebar && sidebar.children.length === 0) {
                    section.items.forEach((item, index) => {
                        // Handle both string format and object format
                        const itemId = typeof item === 'string' ? item : item.id;
                        const label = typeof item === 'string' ? item : item.label;
                        const icon = typeof item === 'string' ? 'ti ti-circle' : item.icon;
                        const htmlSource = typeof item === 'object' ? item.htmlSource : null;
                        
                        const menuItem = document.createElement('div');
                        menuItem.className = 'sidebar-item' + (index === 0 ? ' active' : '');
                        menuItem.innerHTML = `<i class="${icon}"></i> <span>${label}</span>`;
                        menuItem.onclick = () => {
                            sidebar.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
                            menuItem.classList.add('active');
                            
                            // Load content - prefer htmlSource, fallback to showArchTab
                            if (htmlSource) {
                                this.loadMenuItemContent(tab.id, itemId, htmlSource);
                            } else if (window.showArchTab) {
                                window.showArchTab(itemId);
                            }
                        };
                        sidebar.appendChild(menuItem);
                    });
                    console.log('[Tabs Everywhere] Populated', section.id, 'with', section.items.length, 'items');
                }
            }
        });
    }
    
    async loadMenuItemContent(tabId, itemId, htmlSource) {
        // Find content container - try multiple patterns
        const contentContainer = document.getElementById(`${tabId}-content`) ||
                                document.getElementById(`${tabId}-detail`) ||
                                document.querySelector(`#${tabId}-sidebar ~ .content`) ||
                                document.querySelector('.content');
        
        if (!contentContainer) {
            console.error('[Tabs Everywhere] No content container found for', tabId);
            return;
        }
        
        try {
            const response = await fetch(htmlSource + '?v=' + Date.now());
            const html = await response.text();
            contentContainer.innerHTML = html;
            console.log('[Tabs Everywhere] Loaded', htmlSource, 'into', contentContainer.id || 'content');
        } catch (error) {
            contentContainer.innerHTML = `<p class="tabs-error-message">Error loading ${htmlSource}</p>`;
            console.error('[Tabs Everywhere] Error loading', htmlSource, error);
        }
    }

    async loadStaticSection(tab, section) {
        const content = document.getElementById(`${tab.id}-content`);
        if (!content) {
            console.error('[Tabs Everywhere] Content div not found:', `${tab.id}-content`);
            return;
        }

        if (section.htmlSource) {
            const fetchUrl = section.htmlSource + '?v=' + Date.now();
            const response = await fetch(fetchUrl);
            const html = await response.text();
            
            // Wrap content with page header (with optional controls)
            const headerControls = section.headerControls || '';
            content.innerHTML = `
                <div class="page-header">
                    <div class="page-header-text">
                        <h3>${section.title || tab.label}</h3>
                        ${section.description ? `<p>${section.description}</p>` : ''}
                    </div>
                    ${headerControls ? `<div class="page-header-controls">${headerControls}</div>` : ''}
                </div>
                <div class="detail-body">
                    ${html}
                </div>
            `;
            
            // Execute scripts in the inserted HTML
            const scripts = content.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        }
    }
}

class TabManager {
    constructor(tabConfig, globalConfig, parent, context = {}) {
        this.tabConfig = tabConfig;
        this.globalConfig = globalConfig;
        this.parent = parent;
        this.context = {
            layoutPattern: context.layoutPattern || 'sidebar-content',
            depth: context.depth || 0
        };
        this.data = [];
        this.selectedId = null;
        this.actions = null;
        this.loadId = 0;
    }

    getElement(suffix) {
        return document.getElementById(`${this.tabConfig.id}-${suffix}`);
    }

    async init(itemId = null, shouldUpdateHistory = false) {
        console.log('[TabManager] init called for:', this.tabConfig.id, 'itemId:', itemId);
        const listSection = this.tabConfig.sections?.find(s => s.type === 'list');
        const accordionSection = this.tabConfig.sections?.find(s => s.type === 'accordion');
        console.log('[TabManager] listSection:', !!listSection, 'accordionSection:', !!accordionSection);
        
        // Handle accordion - render panels in sidebar, content area ready for app
        if (accordionSection) {
            this.renderAccordion(accordionSection);
            
            // Make detail section active (app will populate it)
            const detailSection = this.getElement('detail');
            if (detailSection) {
                detailSection.classList.add('active');
            }
            
            // Dispatch event so app knows tab is ready
            setTimeout(() => {
                const event = new CustomEvent('tabs-everywhere:tab-changed', {
                    detail: { tabId: this.tabConfig.id, tab: this.tabConfig }
                });
                document.dispatchEvent(event);
            }, 100);
            
            return;
        }
        
        if (listSection) {
            console.log('[TabManager] Processing list section for:', this.tabConfig.id);
            this.actions = listSection.actions || [];
            this.renderActions();

            if (listSection.inlineData) {
                console.log('[TabManager] Using inline data:', listSection.inlineData.length, 'items');
                this.data = listSection.inlineData;
            } else if (listSection.dataSource) {
                console.log('[TabManager] Loading data from:', listSection.dataSource);
                await this.loadData(listSection.dataSource);
                console.log('[TabManager] Data loaded:', this.data.length, 'items');
            }

            // Always render sidebar (no caching)
            const sidebarScroll = this.getElement('sidebar-scroll');
            console.log('[TabManager] Sidebar scroll element:', !!sidebarScroll, 'children:', sidebarScroll?.children.length);
            console.log('[TabManager] ALWAYS rendering sidebar for:', this.tabConfig.id);
            this.renderSidebar();
            
            // Update selection
            if (itemId) {
                console.log('[TabManager] Setting active item:', itemId);
                this.setActiveItem(itemId);
            } else if (this.data.length > 0) {
                console.log('[TabManager] Setting first item as active:', this.data[0].id);
                this.setActiveItem(this.data[0].id);
            }
        }

        const rawSection = this.tabConfig.sections?.find(s => s.type === 'raw');
        if (rawSection && rawSection.dataSource) {
            await this.loadData(rawSection.dataSource);
            this.renderRawData();
        }

        const menuSection = this.tabConfig.sections?.find(s => s.type === 'menu');
        if (menuSection) {
            this.renderMenu(menuSection);
        }
    }

    async loadData(dataSource) {
        try {
            const response = await fetch(dataSource);
            const json = await response.json();
            
            // Ensure data is always an array
            if (Array.isArray(json)) {
                this.data = json;
            } else if (json && typeof json === 'object') {
                // If it's an object, try to extract array from common wrapper patterns
                const extracted = json.data || json.items || json.results || [];
                
                // Ensure extracted value is an array
                if (Array.isArray(extracted)) {
                    this.data = extracted;
                    console.log('[Tabs Everywhere] API returned object wrapper. Extracted:', this.data.length, 'items');
                } else {
                    this.data = [];
                    console.warn('[Tabs Everywhere] Extracted value is not an array:', typeof extracted);
                }
            } else {
                this.data = [];
                console.warn('[Tabs Everywhere] API returned unexpected format:', typeof json);
            }
        } catch (error) {
            this.data = [];
            console.error('[Tabs Everywhere] Error loading data:', error);
        }
    }

    renderActions() {
        // Actions now rendered as regular sidebar items at index 0
    }

    renderSidebar() {
        const sidebar = this.getElement('sidebar');
        const sidebarScroll = this.getElement('sidebar-scroll');
        if (!sidebarScroll) return;

        // Clear only if rendering for first time
        sidebarScroll.innerHTML = '';
        
        // Add collapse toggle button at bottom if not already added
        if (sidebar && !sidebar.querySelector('.sidebar-collapse-toggle')) {
            const toggleBtn = document.createElement('div');
            toggleBtn.className = 'sidebar-collapse-toggle';
            toggleBtn.innerHTML = '<i class="ti ti-chevron-left"></i>';
            toggleBtn.onclick = () => this.toggleSidebarCollapse();
            sidebar.appendChild(toggleBtn);
        }

        // Render actions as regular items at the top
        if (this.actions && this.actions.length > 0) {
            this.actions.forEach((action, index) => {
                const actionDiv = document.createElement('div');
                actionDiv.className = 'sidebar-item';
                actionDiv.id = `sidebar-${action.id}`;
                actionDiv.innerHTML = `<i class="${action.icon}"></i> <span>${action.label}</span>`;
                actionDiv.dataset.itemId = action.id;
                actionDiv.onclick = () => {
                    this.selectItem(action.id);
                    window.keyboardNav?.setFocusOnContainer(actionDiv);
                };
                sidebarScroll.appendChild(actionDiv);
            });
        }

        if (this.data.length === 0 && (!this.actions || this.actions.length === 0)) {
            const empty = document.createElement('p');
            empty.textContent = 'No items yet';
            empty.className = 'empty-sidebar-message';
            sidebarScroll.appendChild(empty);
            return;
        }

        this.data.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'sidebar-item';
            itemDiv.id = `sidebar-${item.id}`;
            
            const icon = this.resolveIcon(item.icon, index);
            itemDiv.innerHTML = `<i class="${icon}"></i> <span>${item.name || item.title || 'Unnamed'}</span>`;
            itemDiv.dataset.itemId = item.id;
            itemDiv.onclick = () => {
                this.selectItem(item.id);
                window.keyboardNav?.setFocusOnContainer(itemDiv);
            };
            sidebarScroll.appendChild(itemDiv);
        });
    }

    setActiveItem(itemId) {
        const sidebarScroll = this.getElement('sidebar-scroll');
        if (!sidebarScroll) return;
        
        // Update active class and aria-selected
        const allItems = Array.from(sidebarScroll.children).filter(el => el.classList.contains('sidebar-item'));
        allItems.forEach(el => {
            el.classList.remove('active');
            el.removeAttribute('aria-selected');
        });
        
        const targetItem = allItems.find(el => el.dataset.itemId === itemId);
        if (targetItem) {
            targetItem.classList.add('active');
            targetItem.setAttribute('aria-selected', 'true');
        }
        
        // Load content for this item
        this.selectItem(itemId, targetItem, true); // skipHistory = true to avoid loop
    }

    renderAccordion(accordionSection) {
        const sidebarScroll = this.getElement('sidebar-scroll');
        if (!sidebarScroll) return;
        
        sidebarScroll.innerHTML = '';
        
        // Load panel states from localStorage
        const panelStates = this.loadPanelStates();
        
        accordionSection.panels.forEach((panel, index) => {
            const isExpanded = panelStates[panel.id] ?? (panel.defaultExpanded || false);
            
            // Create panel container
            const panelDiv = document.createElement('div');
            panelDiv.className = 'accordion-panel';
            panelDiv.dataset.panelId = panel.id;
            
            // Create panel header
            const header = document.createElement('div');
            header.className = 'accordion-header';
            header.innerHTML = `
                <i class="accordion-chevron ti ti-chevron-right ${isExpanded ? 'accordion-chevron-rotate-90' : 'accordion-chevron-rotate-0'}"></i>
                <i class="${panel.icon}"></i>
                <span>${panel.label}</span>
            `;
            
            // Create panel content
            const content = document.createElement('div');
            content.className = 'accordion-content';
            if (!isExpanded) { content.classList.add('hidden'); }
            content.dataset.htmlSource = panel.htmlSource;
            
            // Header click handler
            header.onclick = async () => {
                const isCurrentlyExpanded = content.style.display === 'block';
                content.style.display = isCurrentlyExpanded ? 'none' : 'block';
                const chevron = header.querySelector('.accordion-chevron');
                if (isCurrentlyExpanded) { chevron.classList.remove('accordion-chevron-expanded'); } else { chevron.classList.add('accordion-chevron-expanded'); }
                
                // Save state
                panelStates[panel.id] = !isCurrentlyExpanded;
                this.savePanelStates(panelStates);
                
                // Load content on first expand
                if (!isCurrentlyExpanded && content.children.length === 0) {
                    await this.loadPanelContent(panel, content);
                }
            };
            
            panelDiv.appendChild(header);
            panelDiv.appendChild(content);
            sidebarScroll.appendChild(panelDiv);
            
            // Load content if expanded by default
            if (isExpanded) {
                setTimeout(() => this.loadPanelContent(panel, content), 50);
            }
        });
        
        console.log('[Tabs Everywhere] Rendered accordion with', accordionSection.panels.length, 'panels');
    }
    
    async loadPanelContent(panel, contentDiv) {
        if (!panel.htmlSource) return;
        
        try {
            const response = await fetch(panel.htmlSource + '?v=' + Date.now());
            const html = await response.text();
            contentDiv.innerHTML = html;
            
            // Execute any scripts in the loaded content
            const scripts = contentDiv.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
            
            // Trigger panel-specific initialization
            if (panel.onLoad && typeof window[panel.onLoad] === 'function') {
                window[panel.onLoad]();
            }
            
            console.log('[Tabs Everywhere] Loaded panel content:', panel.id);
        } catch (error) {
            contentDiv.innerHTML = `<p class="tabs-error-message">Error loading ${panel.htmlSource}</p>`;
            console.error('[Tabs Everywhere] Error loading panel:', error);
        }
    }
    
    loadPanelStates() {
        try {
            const saved = localStorage.getItem(`accordion-panels-${this.tabConfig.id}`);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }
    
    savePanelStates(states) {
        try {
            localStorage.setItem(`accordion-panels-${this.tabConfig.id}`, JSON.stringify(states));
        } catch (e) {
            console.warn('[Tabs Everywhere] Could not save panel states:', e);
        }
    }

    renderMenu(menuSection) {
        const sidebar = this.getElement('sidebar');
        if (!sidebar) return;

        menuSection.items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.textContent = item;
            menuItem.onclick = () => this.showMenuOption(item);
            sidebar.appendChild(menuItem);
        });
    }

    handleAction(actionId) {
        if (actionId === 'new') {
            // Select "New" like a regular item
            const sidebarScroll = this.getElement('sidebar-scroll');
            if (sidebarScroll) {
                sidebarScroll.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                const newButton = Array.from(sidebarScroll.children).find(el => el.textContent.includes('New'));
                if (newButton) newButton.classList.add('active');
            }
            
            // Show new section
            const contentArea = this.getElement('content');
            if (contentArea) {
                contentArea.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            }
            
            const newSection = this.getElement('new');
            if (newSection) {
                newSection.classList.add('active');
                newSection.innerHTML = `
                    <div class="detail-header">
                        <h2>New Item</h2>
                        <div class="detail-subtitle">Create a new item</div>
                    </div>
                    <div class="detail-body">
                        <p class="new-item-intro">This is where you would add a new item to this list.</p>
                        <p class="new-item-description">The form content is customizable per item type - you can define fields, validation, and behavior in your sitemap configuration.</p>
                        <div class="new-item-example-box">
                            <strong class="new-item-example-title">Example fields:</strong>
                            <ul class="new-item-example-list">
                                <li>Name</li>
                                <li>Description</li>
                                <li>Icon</li>
                                <li>Type</li>
                                <li>Data source</li>
                            </ul>
                        </div>
                    </div>
                `;
            }
            
            // Update URL
            if (this.parent) {
                this.parent.updateHistory(this.tabConfig.id, 'new', false);
            }
        }
    }

    async selectItem(itemId, targetElement, skipHistory = false, isAutoSelect = false) {
        this.loadId++;
        const thisLoadId = this.loadId;
        this.selectedId = itemId;
        
        const item = this.data.find(i => i.id === itemId);
        
        // If item not found, check if it's an action
        if (!item && this.actions) {
            const action = this.actions.find(a => a.id === itemId);
            if (action) {
                this.handleAction(itemId);
                return;
            }
        }
        
        // If still no item found, exit gracefully
        if (!item) {
            console.warn(`Item not found: ${itemId}`);
            return;
        }
        
        // Update active class and aria-selected if not already set
        if (!skipHistory) {
            const sidebar = this.getElement('sidebar-scroll');
            if (sidebar) {
                sidebar.querySelectorAll('.sidebar-item').forEach(i => {
                    i.classList.remove('active');
                    i.removeAttribute('aria-selected');
                });
            }
            const element = targetElement || event?.target;
            if (element) {
                element.classList.add('active');
                element.setAttribute('aria-selected', 'true');
            }
            
            // Update URL
            if (this.parent) {
                const isFirstItem = this.data.length > 0 && this.data[0].id === itemId;
                this.parent.updateHistory(this.tabConfig.id, itemId, isFirstItem);
            }
        }

        const contentArea = this.getElement('content');
        if (contentArea) {
            contentArea.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        }

        const detailSection = this.getElement('detail');
        if (!detailSection) return;

        detailSection.classList.add('active');
        
        // Only show header at depth 0
        const showHeader = this.context.depth === 0;
        const description = (item.description || 'No description available').replace(/\n/g, '<br>');
        
        if (showHeader) {
            detailSection.innerHTML = `
                <div class="detail-header">
                    <h2>${item.name || 'Item ' + itemId}</h2>
                    <div class="detail-subtitle">${description.split('<br>')[0]}</div>
                </div>
                <div class="detail-body loading-container">
                    <div class="loading-content">
                        <div class="loading-spinner-box"></div>
                        <p class="loading-text">Loading...</p>
                    </div>
                </div>
            `;
        } else {
            detailSection.innerHTML = `
                <div class="detail-body loading-container">
                    <div class="loading-content">
                        <div class="loading-spinner-box"></div>
                        <p class="loading-text">Loading...</p>
                    </div>
                </div>
            `;
        }
        
        if (item.delay) await new Promise(resolve => setTimeout(resolve, item.delay));
        if (this.loadId !== thisLoadId) return;
        
        let bodyContent;
        const itemLayoutPattern = item.nestedLayout || '_parent';
        const childLayoutPattern = itemLayoutPattern === '_parent' 
            ? this.rotatePattern(this.context.layoutPattern)
            : itemLayoutPattern;
        const childLayout = this.resolveLayout(childLayoutPattern);
        
        if (item.nestedTabs) {
            bodyContent = this.renderNested(item.nestedTabs, childLayout, childLayoutPattern);
        } else if (item.nestedTabsSource) {
            try {
                const response = await fetch(item.nestedTabsSource);
                const jsonData = await response.json();
                if (this.loadId !== thisLoadId) return;
                
                const nestedTabs = item.nestedTabsPath ? jsonData[item.nestedTabsPath] : jsonData;
                bodyContent = this.renderNested(nestedTabs, childLayout, childLayoutPattern);
            } catch (error) {
                bodyContent = `<p>Error loading nested tabs</p>`;
            }
        } else if (item.htmlSource) {
            try {
                const response = await fetch(item.htmlSource + '?v=' + Date.now());
                bodyContent = await response.text();
                if (this.loadId !== thisLoadId) return;
                
                // Trigger init for special fragments
                setTimeout(() => {
                    if (item.htmlSource.includes('visualizer.html') && window.SitemapVisualizer) {
                        window.SitemapVisualizer.init();
                    } else if (item.htmlSource.includes('raw-sitemap.html') && window.RawJsonViewer) {
                        window.RawJsonViewer.init();
                    }
                }, 50);
            } catch (error) {
                bodyContent = `<p>Error loading content from ${item.htmlSource}</p>`;
            }
        } else if (item.htmlContent) {
            bodyContent = `<div class="html-content-display">${item.htmlContent}</div>`;
        } else {
            const hasMetadata = item.type || item.status;
            const metadataCard = hasMetadata ? `
                <div class="metadata-card">
                    <strong>ID:</strong> ${itemId}<br>
                    ${item.type ? `<strong>Type:</strong> ${item.type}<br>` : ''}
                    ${item.status ? `<strong>Status:</strong> ${item.status}` : ''}
                </div>
            ` : '';
            
            bodyContent = metadataCard || '<p class="no-details-message">No additional details</p>';
        }
        
        if (this.loadId !== thisLoadId) return;
        
        if (showHeader) {
            detailSection.innerHTML = `
                <div class="detail-header">
                    <h2>${item.name || 'Item ' + itemId}</h2>
                    <div class="detail-subtitle">${description.split('<br>')[0]}</div>
                </div>
                <div class="detail-body">
                    ${bodyContent}
                </div>
            `;
        } else {
            detailSection.innerHTML = bodyContent;
        }
    }

    renderNested(nestedTabs, layout, layoutPattern) {
        if (!nestedTabs || nestedTabs.length === 0) {
            return '<p class="nested-tabs-message">No nested tabs configured</p>';
        }
        
        const containerId = `nested-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        if (layout === 'sidebar-content') {
            const sidebarId = `${containerId}-sidebar`;
            const contentId = `${containerId}-content`;
            
            let sidebarHtml = '';
            nestedTabs.forEach((tab, index) => {
                const isFirst = index === 0;
                const icon = this.resolveIcon(tab.icon, index);
                sidebarHtml += `
                    <div class="sidebar-item ${isFirst ? 'active' : ''}" data-tab-index="${index}">
                        <i class="${icon}"></i> ${tab.label}
                    </div>
                `;
            });
            
            const html = `
                <div class="layout sidebar-content nested-layout">
                    <div id="${sidebarId}" class="sidebar">
                        <div id="${sidebarId}-scroll" class="sidebar-scroll">
                            ${sidebarHtml}
                        </div>
                    </div>
                    <div id="${contentId}" class="content">
                        <div id="${contentId}-detail" class="section active"></div>
                    </div>
                </div>
            `;
            
            const self = this;
            setTimeout(() => {
                const sidebarItems = document.querySelectorAll(`#${sidebarId}-scroll .sidebar-item`);
                sidebarItems.forEach((itemEl, index) => {
                    itemEl.onclick = () => {
                        sidebarItems.forEach(el => el.classList.remove('active'));
                        itemEl.classList.add('active');
                        self.loadNestedItem(nestedTabs[index], `${contentId}-detail`, layoutPattern);
                        window.keyboardNav?.setFocusOnContainer(itemEl);
                    };
                });
                
                if (nestedTabs.length > 0) {
                    self.loadNestedItem(nestedTabs[0], `${contentId}-detail`, layoutPattern);
                }
            }, 10);
            
            return html;
        } else {
            const tabsId = `${containerId}-tabs`;
            const contentId = `${containerId}-content`;
            
            let tabsHtml = '';
            nestedTabs.forEach((tab, index) => {
                const isFirst = index === 0;
                tabsHtml += `
                    <div class="tab nested-tab ${isFirst ? 'active' : ''}" data-tab-id="${tab.id}">
                        <i class="${tab.icon}"></i>
                        <span class="tab-label">${tab.label}</span>
                    </div>
                `;
            });
            
            const html = `
                <div class="nested-tabs-container">
                    <div class="tabs nested-tabs" id="${tabsId}">
                        ${tabsHtml}
                    </div>
                    <div class="nested-content-area" id="${contentId}"></div>
                </div>
            `;
            
            const self = this;
            setTimeout(() => {
                const tabsContainer = document.getElementById(tabsId);
                if (!tabsContainer) return;
                
                const tabElements = tabsContainer.querySelectorAll('.nested-tab');
                tabElements.forEach((tabEl, index) => {
                    tabEl.onclick = () => {
                        tabElements.forEach(el => el.classList.remove('active'));
                        tabEl.classList.add('active');
                        self.loadNestedItem(nestedTabs[index], contentId, layoutPattern);
                        window.keyboardNav?.setFocusOnContainer(tabEl);
                    };
                });
                
                if (nestedTabs.length > 0) {
                    self.loadNestedItem(nestedTabs[0], contentId, layoutPattern);
                }
            }, 10);
            
            return html;
        }
    }

    async loadNestedItem(tab, contentId, layoutPattern) {
        const contentContainer = document.getElementById(contentId);
        if (!contentContainer) return;
        
        const listSection = tab.sections?.find(s => s.type === 'list');
        if (!listSection) return;
        
        let data = listSection.inlineData || [];
        if (!listSection.inlineData && listSection.dataSource) {
            try {
                const response = await fetch(listSection.dataSource);
                data = await response.json();
            } catch (error) {
                return;
            }
        }
        
        if (data.length === 0) return;
        
        const item = data[0];
        const itemLayoutPattern = item.nestedLayout || '_parent';
        const childLayoutPattern = itemLayoutPattern === '_parent' 
            ? this.rotatePattern(layoutPattern)
            : itemLayoutPattern;
        const childLayout = this.resolveLayout(childLayoutPattern);
        
        let nestedContent = '';
        if (item.nestedTabsSource) {
            try {
                const response = await fetch(item.nestedTabsSource);
                const nestedTabs = await response.json();
                nestedContent = this.renderNested(nestedTabs, childLayout, childLayoutPattern);
            } catch (error) {
                nestedContent = '<p>Error loading nested content</p>';
            }
        } else if (item.nestedTabs) {
            nestedContent = this.renderNested(item.nestedTabs, childLayout, childLayoutPattern);
        } else {
            nestedContent = `<p class="nested-tabs-message">${item.description || item.name}</p>`;
        }
        
        contentContainer.innerHTML = nestedContent;
    }

    resolveIcon(iconValue, index = 0) {
        if (!iconValue) return 'ti ti-circle';
        
        if (iconValue.includes('|')) {
            const options = iconValue.split('|');
            return options[index % options.length];
        }
        
        return iconValue;
    }

    rotatePattern(pattern) {
        if (pattern && pattern.includes('|')) {
            const parts = pattern.split('|');
            return parts.slice(1).concat(parts[0]).join('|');
        }
        return pattern;
    }

    resolveLayout(layoutValue) {
        const layoutMap = {
            'horizontal': 'tabs',
            'tabs': 'tabs',
            'vertical': 'sidebar-content',
            'sidebar-content': 'sidebar-content',
            'sidebar': 'sidebar-content',
            '': 'sidebar-content'
        };

        if (!layoutValue) return 'sidebar-content';
        if (layoutValue === '_random') return Math.random() < 0.5 ? 'tabs' : 'sidebar-content';
        
        if (layoutValue.includes('|')) {
            const options = layoutValue.split('|');
            const firstOption = options[0];
            return layoutMap[firstOption] || firstOption;
        }

        return layoutMap[layoutValue] || layoutValue;
    }

    renderRawData() {
        const content = this.getElement('content');
        if (!content) return;
        const json = JSON.stringify(this.data, null, 2);
        const highlighted = this.highlightJSON(json);
        content.innerHTML = `<pre class="raw-json-display">${highlighted}</pre>`;
    }

    highlightJSON(json) {
        return json
            .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
                if (/:$/.test(match)) {
                    return `<span class="key">${match}</span>`;
                }
                return `<span class="string">${match}</span>`;
            })
            .replace(/\b(true|false)\b/g, '<span class="boolean">$1</span>')
            .replace(/\b(null)\b/g, '<span class="null">$1</span>')
            .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="number">$1</span>');
    }

    showMenuOption(optionId) {
        const content = this.getElement('content');
        if (content) {
            content.innerHTML = `<h2>Menu: ${optionId}</h2><p>Content for ${optionId}</p>`;
        }
    }

    toggleSidebarCollapse() {
        const sidebar = this.getElement('sidebar');
        if (!sidebar) return;
        
        const isCollapsed = sidebar.classList.toggle('collapsed');
        const toggleBtn = sidebar.querySelector('.sidebar-collapse-toggle i');
        
        if (toggleBtn) {
            toggleBtn.className = isCollapsed ? 'ti ti-chevron-right' : 'ti ti-chevron-left';
        }
        
        // Save state to localStorage
        try {
            localStorage.setItem(`sidebar-collapsed-${this.tabConfig.id}`, isCollapsed);
        } catch (e) {
            console.warn('Could not save sidebar state:', e);
        }
        
        // Wrap text in spans if not already done
        if (!sidebar.dataset.textWrapped) {
            const items = sidebar.querySelectorAll('.sidebar-item');
            items.forEach(item => {
                const icon = item.querySelector('i');
                if (icon) {
                    const text = item.textContent.trim();
                    item.innerHTML = '';
                    item.appendChild(icon.cloneNode(true));
                    const span = document.createElement('span');
                    span.textContent = text.replace(icon.textContent, '').trim();
                    item.appendChild(span);
                }
            });
            sidebar.dataset.textWrapped = 'true';
        }
    }
}

window.TabsEverywhere = TabsEverywhere;
window.TabManager = TabManager;

// Compatibility function for DallAIre's HTML files
window.showArchTab = function(viewId) {
    const contentContainer = document.getElementById('system-content-container') || 
                            document.getElementById('playbooks-content') ||
                            document.getElementById('showcase-content');
    
    if (!contentContainer) {
        console.warn('[showArchTab] Content container not found');
        return;
    }
    
    // Determine which tab we're in based on which container exists
    let tabPath = '';
    if (document.getElementById('system-content-container')) {
        tabPath = '/tabs/system/';
    } else if (document.getElementById('playbooks-content')) {
        tabPath = '/tabs/playbooks/';
    } else if (document.getElementById('showcase-content')) {
        tabPath = '/tabs/showcase/';
    }
    
    // Load the HTML file for this view
    fetch(tabPath + viewId + '.html?v=' + Date.now())
        .then(response => response.text())
        .then(html => {
            contentContainer.innerHTML = html;
            console.log('[showArchTab] Loaded', viewId);
        })
        .catch(error => {
            contentContainer.innerHTML = `<p class="tabs-error-message">Error loading ${viewId}</p>`;
            console.error('[showArchTab] Error:', error);
        });
};

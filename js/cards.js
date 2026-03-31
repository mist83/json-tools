/**
 * Cards Everywhere - Reusable Card Grid Component
 * @version 1.0.0
 * @description Renders responsive card grids with photos, titles, and actions
 * @license MIT
 * 
 * USAGE:
 * const cards = new CardsEverywhere({
 *     containerId: 'my-cards-container',
 *     dataSource: '/api/items',
 *     cardTemplate: (item) => ({ ... })
 * });
 * cards.render();
 */

(function() {
    'use strict';
    
    class CardsEverywhere {
        constructor(config) {
            this.config = config || {};
            this.data = [];
            this.filteredData = [];
        }
        
        /**
         * Render cards from data source
         */
        async render() {
            const container = document.getElementById(this.config.containerId);
            if (!container) {
                console.error('[Cards Everywhere] Container not found:', this.config.containerId);
                return;
            }
            
            // Show loading state
            container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>Loading...</span></div>';
            
            // Load data
            await this.loadData();
            
            // Render cards
            this.renderCards();
        }
        
        /**
         * Load data from API or inline data
         */
        async loadData() {
            if (this.config.data) {
                this.data = this.config.data;
                this.filteredData = [...this.data];
                return;
            }
            
            if (!this.config.dataSource) {
                console.error('[Cards Everywhere] No data source provided');
                return;
            }
            
            try {
                const response = await fetch(this.config.dataSource);
                const result = await response.json();
                
                // Handle both array and {success, data} wrapper
                if (Array.isArray(result)) {
                    this.data = result;
                } else if (result.success && result.data) {
                    this.data = result.data;
                } else {
                    this.data = [];
                }
                
                this.filteredData = [...this.data];
            } catch (error) {
                console.error('[Cards Everywhere] Failed to load data:', error);
                this.data = [];
                this.filteredData = [];
            }
        }
        
        /**
         * Render cards into container
         */
        renderCards() {
            const container = document.getElementById(this.config.containerId);
            if (!container) return;
            
            if (this.filteredData.length === 0) {
                container.innerHTML = '<div class="loading"><span>No items found</span></div>';
                return;
            }
            
            const cardsHtml = this.filteredData.map(item => this.renderCard(item)).join('');
            container.innerHTML = cardsHtml;
            
            // Wire up click handlers
            this.wireUpHandlers();
        }
        
        /**
         * Render individual card
         */
        renderCard(item) {
            const template = this.config.cardTemplate(item);
            
            const photoHtml = template.photoUrl 
                ? `<div class="card-photo"><img src="${template.photoUrl}" alt="${this.escapeHtml(template.title)}"></div>`
                : `<div class="card-photo placeholder"><i class="${template.placeholderIcon || 'ti ti-photo'}"></i></div>`;
            
            const deleteBtn = template.onDelete 
                ? `<button class="card-delete" data-item-id="${item.id}" title="Delete">
                     <i class="ti ti-trash"></i>
                   </button>`
                : '';
            
            const subtitleHtml = template.subtitle 
                ? `<div class="card-subtitle">${template.subtitle}</div>`
                : '';
            
            return `
                <div class="card" data-item-id="${item.id}">
                    ${photoHtml}
                    <div class="card-header">
                        <div class="card-title">
                            ${template.icon ? `<i class="${template.icon}"></i>` : ''}
                            ${this.escapeHtml(template.title)}
                        </div>
                        ${subtitleHtml}
                    </div>
                    ${deleteBtn}
                </div>
            `;
        }
        
        /**
         * Wire up click handlers
         */
        wireUpHandlers() {
            const container = document.getElementById(this.config.containerId);
            if (!container) return;
            
            // Card click handlers
            container.querySelectorAll('.card').forEach(card => {
                const itemId = card.dataset.itemId;
                const item = this.data.find(i => i.id === itemId || i.slug === itemId);
                
                card.addEventListener('click', (e) => {
                    // Don't trigger if clicking delete button
                    if (e.target.closest('.card-delete')) return;
                    
                    if (this.config.onCardClick) {
                        this.config.onCardClick(item, itemId);
                    }
                });
            });
            
            // Delete button handlers
            container.querySelectorAll('.card-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemId = btn.dataset.itemId;
                    const item = this.data.find(i => i.id === itemId || i.slug === itemId);
                    
                    if (this.config.onDelete) {
                        this.config.onDelete(item, itemId);
                    }
                });
            });
        }
        
        /**
         * Filter cards by search term
         */
        filter(searchTerm) {
            if (!searchTerm) {
                this.filteredData = [...this.data];
            } else {
                const term = searchTerm.toLowerCase();
                this.filteredData = this.data.filter(item => {
                    const template = this.config.cardTemplate(item);
                    return template.title.toLowerCase().includes(term) ||
                           (template.subtitle && template.subtitle.toLowerCase().includes(term));
                });
            }
            
            this.renderCards();
        }
        
        /**
         * Refresh data and re-render
         */
        async refresh() {
            await this.loadData();
            this.renderCards();
        }
        
        /**
         * Escape HTML to prevent XSS
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }
    
    // Export
    window.CardsEverywhere = CardsEverywhere;
    
    console.log('[Cards Everywhere] Library loaded v1.0.0');
})();

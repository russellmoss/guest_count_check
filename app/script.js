// script.js - Modern Interactive Dashboard for Guest Count Check

class GuestCountDashboard {
    constructor() {
        this.orders = [];
        this.filteredOrders = [];
        this.selectedAssociates = new Set();
        this.sortConfig = { field: null, direction: 'asc' };
        this.currentView = 'table';
        
        this.initializeEventListeners();
        this.setDefaultDates();
    }

    initializeEventListeners() {
        // Load Orders Button
        document.getElementById('load-orders-btn').addEventListener('click', () => this.loadOrders());
        
        // Export Excel Button
        document.getElementById('export-excel-btn').addEventListener('click', () => this.exportToExcel());
        
        // Search Input
        document.getElementById('order-search').addEventListener('input', (e) => this.filterOrders());
        
        // Multi-select Dropdown
        this.initializeMultiSelect();
        
        // View Toggle Buttons
        document.getElementById('table-view-btn').addEventListener('click', () => this.switchView('table'));
        document.getElementById('card-view-btn').addEventListener('click', () => this.switchView('card'));
        
        // Modal Close
        document.getElementById('order-details-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') || e.target.classList.contains('modal-close')) {
                this.closeModal();
            }
        });
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    setDefaultDates() {
        const today = new Date();
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        document.getElementById('from-date').value = lastWeek.toISOString().split('T')[0];
        document.getElementById('to-date').value = today.toISOString().split('T')[0];
    }

    initializeMultiSelect() {
        const container = document.querySelector('.multi-select-container');
        const header = document.querySelector('.multi-select-header');
        
        header.addEventListener('click', () => {
            container.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('active');
            }
        });
        
        // Select All / Clear All buttons
        document.querySelector('.select-all-btn').addEventListener('click', () => this.selectAllAssociates());
        document.querySelector('.clear-all-btn').addEventListener('click', () => this.clearAllAssociates());
    }

    async loadOrders() {
        const fromDate = document.getElementById('from-date').value;
        const toDate = document.getElementById('to-date').value;
        
        if (!fromDate && !toDate) {
            this.showStatus('Please select at least one date.', 'error');
            return;
        }
        
        this.showStatus('Loading orders...', 'loading');
        
        try {
            const url = `/api/orders?from=${fromDate}&to=${toDate}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.orders = data.orders || [];
            
            this.populateAssociateFilter();
            this.filterOrders();
            this.updateResultsTitle();
            
            this.showStatus(`Loaded ${this.orders.length} orders`, 'success');
            document.getElementById('export-excel-btn').disabled = false;
            
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showStatus('Error loading orders. Please try again.', 'error');
        }
    }

    populateAssociateFilter() {
        const associates = [...new Set(this.orders.map(order => order.salesAssociate).filter(Boolean))];
        const optionsContainer = document.getElementById('associate-options');
        
        optionsContainer.innerHTML = '';
        
        associates.forEach(associate => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.innerHTML = `
                <input type="checkbox" id="associate-${associate}" value="${associate}">
                <label for="associate-${associate}">${associate}</label>
            `;
            
            const checkbox = option.querySelector('input');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedAssociates.add(associate);
                } else {
                    this.selectedAssociates.delete(associate);
                }
                this.updateAssociateSelectionText();
                this.filterOrders();
            });
            
            optionsContainer.appendChild(option);
        });
    }

    selectAllAssociates() {
        const checkboxes = document.querySelectorAll('#associate-options input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.selectedAssociates.add(checkbox.value);
        });
        this.updateAssociateSelectionText();
        this.filterOrders();
    }

    clearAllAssociates() {
        const checkboxes = document.querySelectorAll('#associate-options input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedAssociates.clear();
        this.updateAssociateSelectionText();
        this.filterOrders();
    }

    updateAssociateSelectionText() {
        const text = document.getElementById('associate-selection-text');
        if (this.selectedAssociates.size === 0) {
            text.textContent = 'All Associates';
        } else if (this.selectedAssociates.size === 1) {
            text.textContent = Array.from(this.selectedAssociates)[0];
        } else {
            text.textContent = `${this.selectedAssociates.size} Associates Selected`;
        }
    }

    filterOrders() {
        const searchTerm = document.getElementById('order-search').value.toLowerCase();
        
        this.filteredOrders = this.orders.filter(order => {
            // Filter by associate
            if (this.selectedAssociates.size > 0 && !this.selectedAssociates.has(order.salesAssociate)) {
                return false;
            }
            
            // Filter by search term
            if (searchTerm && !order.orderNumber.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            return true;
        });
        
        this.renderOrders();
        this.updateResultsTitle();
    }

    sortOrders(field) {
        if (this.sortConfig.field === field) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.field = field;
            this.sortConfig.direction = 'asc';
        }
        
        this.filteredOrders.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];
            
            // Handle date sorting
            if (field === 'orderDate') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            
            // Handle numeric sorting
            if (field === 'totalAmount') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }
            
            if (aVal < bVal) return this.sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        this.renderOrders();
        this.updateSortIcons();
    }

    updateSortIcons() {
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.textContent = '↕';
        });
        
        if (this.sortConfig.field) {
            const header = document.querySelector(`[data-sort="${this.sortConfig.field}"] .sort-icon`);
            if (header) {
                header.textContent = this.sortConfig.direction === 'asc' ? '↑' : '↓';
            }
        }
    }

    renderOrders() {
        if (this.currentView === 'table') {
            this.renderTableView();
        } else {
            this.renderCardView();
        }
    }

    renderTableView() {
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '';
        
        this.filteredOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="order-number" onclick="dashboard.showOrderDetails('${order.orderNumber}')">${order.orderNumber}</span></td>
                <td>${order.salesAssociate || 'Unknown'}</td>
                <td>${this.formatDate(order.orderDate)}</td>
                <td>$${this.formatCurrency(order.totalAmount)}</td>
                <td><button class="expand-btn" onclick="dashboard.showOrderDetails('${order.orderNumber}')">▶</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    renderCardView() {
        const container = document.getElementById('orders-cards-container');
        container.innerHTML = '';
        
        this.filteredOrders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-order-number" onclick="dashboard.showOrderDetails('${order.orderNumber}')">${order.orderNumber}</span>
                    <button class="card-expand-btn" onclick="dashboard.showOrderDetails('${order.orderNumber}')">▶</button>
                </div>
                <div class="card-details">
                    <div class="card-detail">
                        <span class="card-detail-label">Sales Associate</span>
                        <span class="card-detail-value">${order.salesAssociate || 'Unknown'}</span>
                    </div>
                    <div class="card-detail">
                        <span class="card-detail-label">Order Date</span>
                        <span class="card-detail-value">${this.formatDate(order.orderDate)}</span>
                    </div>
                    <div class="card-detail">
                        <span class="card-detail-label">Total Amount</span>
                        <span class="card-detail-value">$${this.formatCurrency(order.totalAmount)}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    switchView(view) {
        this.currentView = view;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}-view-btn`).classList.add('active');
        
        // Show/hide views
        document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
        document.getElementById('card-view').style.display = view === 'card' ? 'block' : 'none';
        
        this.renderOrders();
    }

    async showOrderDetails(orderNumber) {
        const order = this.orders.find(o => o.orderNumber === orderNumber);
        if (!order) return;
        
        this.showStatus('Loading order details...', 'loading');
        
        try {
            // Fetch detailed order information
            const response = await fetch(`/api/order/${orderNumber}`);
            const orderDetails = await response.json();
            
            this.displayOrderModal(orderDetails);
            this.showStatus('', 'success');
            
        } catch (error) {
            console.error('Error loading order details:', error);
            this.showStatus('Error loading order details', 'error');
        }
    }

    displayOrderModal(order) {
        const modal = document.getElementById('order-details-modal');
        const title = document.getElementById('modal-order-title');
        const body = document.getElementById('modal-order-details');
        
        title.textContent = `Order ${order.orderNumber}`;
        
        body.innerHTML = `
            <div class="order-detail-section">
                <h4>Order Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Order Number</span>
                        <span class="detail-value">${order.orderNumber}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Order Date</span>
                        <span class="detail-value">${this.formatDate(order.orderDate)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Sales Associate</span>
                        <span class="detail-value">${order.salesAssociate || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total Amount</span>
                        <span class="detail-value">$${this.formatCurrency(order.totalAmount)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Guest Count</span>
                        <span class="detail-value">${order.guestCount || 'Missing'}</span>
                    </div>
                </div>
            </div>
            
            <div class="order-detail-section">
                <h4>Customer Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Customer Name</span>
                        <span class="detail-value">${order.customer?.name || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${order.customer?.email || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${order.customer?.phone || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div class="order-detail-section">
                <h4>Order Items</h4>
                <div class="items-list">
                    ${order.items?.map(item => `
                        <div class="item-row">
                            <span class="item-name">${item.name}</span>
                            <span class="item-quantity">Qty: ${item.quantity}</span>
                            <span class="item-price">$${this.formatCurrency(item.price)}</span>
                        </div>
                    `).join('') || '<p>No items found</p>'}
                </div>
            </div>
            
            ${order.notes ? `
                <div class="order-detail-section">
                    <h4>Notes</h4>
                    <p>${order.notes}</p>
                </div>
            ` : ''}
        `;
        
        modal.classList.add('show');
    }

    closeModal() {
        document.getElementById('order-details-modal').classList.remove('show');
    }

    async exportToExcel() {
        if (this.filteredOrders.length === 0) {
            this.showStatus('No orders to export', 'error');
            return;
        }
        
        this.showStatus('Generating Excel file...', 'loading');
        
        try {
            const fromDate = document.getElementById('from-date').value;
            const toDate = document.getElementById('to-date').value;
            
            const url = `/export?from=${fromDate}&to=${toDate}&associates=${Array.from(this.selectedAssociates).join(',')}&search=${document.getElementById('order-search').value}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to generate Excel file');
            }
            
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `guest_count_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showStatus('Excel file downloaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            this.showStatus('Error generating Excel file', 'error');
        }
    }

    updateResultsTitle() {
        const title = document.getElementById('results-title');
        const count = this.filteredOrders.length;
        const total = this.orders.length;
        
        if (total === 0) {
            title.textContent = 'No orders loaded';
        } else if (count === total) {
            title.textContent = `${count} orders with missing guest counts`;
        } else {
            title.textContent = `${count} of ${total} orders (filtered)`;
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        const iconEl = statusEl.querySelector('.status-icon');
        const textEl = statusEl.querySelector('.status-text');
        
        if (!message) {
            statusEl.style.display = 'none';
            return;
        }
        
        const icons = {
            loading: '⏳',
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };
        
        iconEl.textContent = icons[type] || icons.info;
        textEl.textContent = message;
        statusEl.style.display = 'flex';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatCurrency(amount) {
        if (!amount) return '0.00';
        return parseFloat(amount).toFixed(2);
    }
}

// Initialize the dashboard when the page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new GuestCountDashboard();
    
    // Add sort event listeners to table headers
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const field = header.dataset.sort;
            dashboard.sortOrders(field);
        });
    });
});

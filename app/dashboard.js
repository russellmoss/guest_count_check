// dashboard.js - Modern Interactive Dashboard for Guest Count Check

class GuestCountDashboard {
    constructor() {
        // State Management
        this.state = {
            orders: [],
            filteredOrders: [],
            expandedOrderId: null,
            selectedAssociates: new Set(),
            sortConfig: { field: null, direction: 'asc' },
            currentView: 'table',
            isLoading: false,
            error: null
        };

        // DOM Elements
        this.elements = {
            loadOrdersBtn: document.getElementById('load-orders-btn'),
            exportExcelBtn: document.getElementById('export-excel-btn'),
            fromDateInput: document.getElementById('from-date'),
            toDateInput: document.getElementById('to-date'),
            orderSearchInput: document.getElementById('order-search'),
            associateDropdown: document.getElementById('associate-dropdown'),
            associateSelectionText: document.getElementById('associate-selection-text'),
            associateOptions: document.getElementById('associate-options'),
            selectAllBtn: document.querySelector('.select-all-btn'),
            clearAllBtn: document.querySelector('.clear-all-btn'),
            statusMessage: document.getElementById('status-message'),
            resultsTitle: document.getElementById('results-title'),
            tableViewBtn: document.getElementById('table-view-btn'),
            cardViewBtn: document.getElementById('card-view-btn'),
            tableView: document.getElementById('table-view'),
            cardView: document.getElementById('card-view'),
            ordersTableBody: document.getElementById('orders-table-body'),
            ordersCardsContainer: document.getElementById('orders-cards-container'),
            orderDetailsModal: document.getElementById('order-details-modal'),
            modalOrderTitle: document.getElementById('modal-order-title'),
            modalOrderDetails: document.getElementById('modal-order-details'),
            modalClose: document.querySelector('.modal-close')
        };

        this.initializeEventListeners();
        this.setDefaultDates();
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Load Orders Button
        this.elements.loadOrdersBtn.addEventListener('click', () => this.loadOrders());
        
        // Export Excel Button
        this.elements.exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        
        // Search Input
        this.elements.orderSearchInput.addEventListener('input', () => this.applyFilters());
        
        // Multi-select Dropdown
        this.initializeMultiSelect();
        
        // View Toggle Buttons
        this.elements.tableViewBtn.addEventListener('click', () => this.switchView('table'));
        this.elements.cardViewBtn.addEventListener('click', () => this.switchView('card'));
        
        // Modal Close
        this.elements.orderDetailsModal.addEventListener('click', (e) => {
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

        // Sort event listeners for table headers
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const field = header.dataset.sort;
                this.sortOrders(field);
            });
        });
    }

    // Set default dates (last week)
    setDefaultDates() {
        const today = new Date();
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        this.elements.fromDateInput.value = lastWeek.toISOString().split('T')[0];
        this.elements.toDateInput.value = today.toISOString().split('T')[0];
    }

    // Initialize multi-select dropdown functionality
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
        this.elements.selectAllBtn.addEventListener('click', () => this.selectAllAssociates());
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAllAssociates());
    }

    // Data Loading
    async loadOrders() {
        const fromDate = this.elements.fromDateInput.value;
        const toDate = this.elements.toDateInput.value;
        
        if (!fromDate && !toDate) {
            this.showStatus('Please select at least one date.', 'error');
            return;
        }
        
        this.setState({ isLoading: true, error: null });
        this.showStatus('Loading orders...', 'loading');
        
        try {
            const url = `/api/orders?from=${fromDate}&to=${toDate}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Debug: Log date fields for the first few orders
            if (data.orders && data.orders.length > 0) {
                console.log("Sample order date fields:");
                data.orders.slice(0, 3).forEach((order, index) => {
                    console.log(`Order ${index + 1} dates:`, {
                        orderNumber: order.orderNumber,
                        orderDate: order.orderDate,
                        orderPaidDate: order.orderPaidDate,
                        orderSubmittedDate: order.orderSubmittedDate,
                        createdAt: order.createdAt
                    });
                });
            }
            
            this.setState({ 
                orders: data.orders || [],
                isLoading: false 
            });
            
            this.populateAssociateFilter();
            this.applyFilters();
            this.updateResultsTitle();
            
            this.showStatus(`Loaded ${this.state.orders.length} orders`, 'success');
            this.elements.exportExcelBtn.disabled = false;
            
        } catch (error) {
            console.error('Error loading orders:', error);
            this.setState({ 
                isLoading: false, 
                error: error.message 
            });
            this.showStatus('Error loading orders. Please try again.', 'error');
        }
    }

    // Populate associate filter dropdown
    populateAssociateFilter() {
        const associates = [...new Set(
            this.state.orders
                .map(order => order.salesAssociate?.name)
                .filter(Boolean)
        )];
        
        this.elements.associateOptions.innerHTML = '';
        
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
                    this.state.selectedAssociates.add(associate);
                } else {
                    this.state.selectedAssociates.delete(associate);
                }
                this.updateAssociateSelectionText();
                this.applyFilters();
            });
            
            this.elements.associateOptions.appendChild(option);
        });
    }

    // Associate filter management
    selectAllAssociates() {
        const checkboxes = document.querySelectorAll('#associate-options input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.state.selectedAssociates.add(checkbox.value);
        });
        this.updateAssociateSelectionText();
        this.applyFilters();
    }

    clearAllAssociates() {
        const checkboxes = document.querySelectorAll('#associate-options input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.state.selectedAssociates.clear();
        this.updateAssociateSelectionText();
        this.applyFilters();
    }

    updateAssociateSelectionText() {
        if (this.state.selectedAssociates.size === 0) {
            this.elements.associateSelectionText.textContent = 'All Associates';
        } else if (this.state.selectedAssociates.size === 1) {
            this.elements.associateSelectionText.textContent = Array.from(this.state.selectedAssociates)[0];
        } else {
            this.elements.associateSelectionText.textContent = `${this.state.selectedAssociates.size} Associates Selected`;
        }
    }

    // Filtering & Sorting
    applyFilters() {
        const searchTerm = this.elements.orderSearchInput.value.toLowerCase();
        
        this.state.filteredOrders = this.state.orders.filter(order => {
            // Filter by associate
            if (this.state.selectedAssociates.size > 0 && 
                !this.state.selectedAssociates.has(order.salesAssociate?.name)) {
                return false;
            }
            
            // Filter by search term
            if (searchTerm && !order.orderNumber.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            return true;
        });
        
        // Apply current sort
        if (this.state.sortConfig.field) {
            this.sortOrders(this.state.sortConfig.field, false);
        }
        
        this.renderOrders();
        this.updateResultsTitle();
    }

    sortOrders(field, updateDisplay = true) {
        if (this.state.sortConfig.field === field) {
            this.state.sortConfig.direction = this.state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortConfig.field = field;
            this.state.sortConfig.direction = 'asc';
        }
        
        this.state.filteredOrders.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];
            
            // Handle nested properties
            if (field === 'salesAssociate') {
                aVal = a.salesAssociate?.name || '';
                bVal = b.salesAssociate?.name || '';
            } else if (field === 'orderDate') {
                aVal = new Date(a.orderDate || a.orderPaidDate);
                bVal = new Date(b.orderDate || b.orderPaidDate);
            } else if (field === 'totalAmount') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }
            
            if (aVal < bVal) return this.state.sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.state.sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        if (updateDisplay) {
            this.renderOrders();
            this.updateSortIcons();
        }
    }

    updateSortIcons() {
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.textContent = '↕';
        });
        
        if (this.state.sortConfig.field) {
            const header = document.querySelector(`[data-sort="${this.state.sortConfig.field}"] .sort-icon`);
            if (header) {
                header.textContent = this.state.sortConfig.direction === 'asc' ? '↑' : '↓';
            }
        }
    }

    // Order Expansion
    async showOrderDetails(orderId) {
        if (this.state.expandedOrderId === orderId) {
            this.closeModal();
            return;
        }
        
        this.showStatus('Loading order details...', 'loading');
        
        try {
            const response = await fetch(`/api/order/${orderId}`);
            const orderDetails = await response.json();
            
            this.displayOrderModal(orderDetails);
            this.state.expandedOrderId = orderId;
            this.showStatus('', 'success');
            
        } catch (error) {
            console.error('Error loading order details:', error);
            this.showStatus('Error loading order details', 'error');
        }
    }

    displayOrderModal(order) {
        this.elements.modalOrderTitle.textContent = `Order ${order.orderNumber}`;
        
        // Debug: Log the order items structure to help identify the correct field names
        console.log("Order items structure:", order.items);
        if (order.items && order.items.length > 0) {
            console.log("First item structure:", order.items[0]);
        }
        
        // Debug: Log all date fields to identify the correct one to use
        console.log("Date fields:", {
            orderDate: order.orderDate,
            orderPaidDate: order.orderPaidDate,
            orderSubmittedDate: order.orderSubmittedDate,
            orderFulfilledDate: order.orderFulfilledDate,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        });
        
        // Generate associate color class
        const associateColorClass = this.getAssociateColorClass(order.salesAssociate?.name);
        
        // Check if high-value order (over $500)
        const isHighValue = parseFloat(order.totalAmount) > 500;
        
        // Check if has reservation items
        const hasReservations = order.items?.some(item => 
            (item.productTitle || item.productName || item.name || '').toLowerCase().includes('reservation')
        );
        
        this.elements.modalOrderDetails.innerHTML = `
            <div class="order-details-container ${associateColorClass}">
                <!-- Order Header -->
                <div class="order-header">
                    <div class="order-header-main">
                        <div class="order-number-section">
                            <h2 class="order-number">${order.orderNumber}</h2>
                            <div class="order-badges">
                                ${!order.guestCount ? '<span class="badge badge-error">Missing Guest Count</span>' : ''}
                                ${isHighValue ? '<span class="badge badge-warning">High Value</span>' : ''}
                                ${hasReservations ? '<span class="badge badge-info">Has Reservations</span>' : ''}
                            </div>
                        </div>
                        <div class="order-meta">
                            <div class="order-date">${this.formatDate(order.orderDate || order.orderPaidDate)}</div>
                            <div class="order-total">${this.formatMoney(order.total || order.totalAmount)}</div>
                            <div class="order-status">${order.status || 'Completed'}</div>
                        </div>
                    </div>
                    <div class="order-customer">
                        <div class="customer-name">${order.customer?.name || 'N/A'}</div>
                        <div class="customer-contact">
                            ${order.customer?.email ? `<span class="contact-item">📧 ${order.customer.email}</span>` : ''}
                            ${order.customer?.phone ? `<span class="contact-item">📞 ${order.customer.phone}</span>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="quick-actions">
                    <button class="action-btn primary" onclick="dashboard.openInCommerce7('${order.id}')">
                        <span class="btn-icon">🔗</span>
                        Open in Commerce7
                    </button>
                    <button class="action-btn secondary" onclick="dashboard.copyOrderNumber('${order.orderNumber}')">
                        <span class="btn-icon">📋</span>
                        Copy Order #
                    </button>
                    <button class="action-btn toggle" onclick="dashboard.toggleFlagForReview('${order.id}')" data-flagged="false">
                        <span class="btn-icon">🚩</span>
                        Flag for Review
                    </button>
                </div>

                <!-- Items Table -->
                <div class="items-section">
                    <h3>Order Items</h3>
                    <div class="items-table-container">
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>SKU</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items?.map(item => `
                                    <tr class="item-row ${this.isReservationItem(item) ? 'reservation-item' : ''}">
                                        <td class="item-name-cell">
                                            <div class="item-name">${item.productTitle || item.productName || item.name || item.product?.name || 'Unknown Product'}</div>
                                            ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                                        </td>
                                        <td class="item-sku">${item.sku || item.productSku || item.product?.sku || 'N/A'}</td>
                                        <td class="item-quantity">${item.quantity}</td>
                                        <td class="item-price">$${this.formatCurrency(item.price || item.unitPrice || item.product?.price)}</td>
                                        <td class="item-total">$${this.formatCurrency((item.price || item.unitPrice || item.product?.price || 0) * item.quantity)}</td>
                                        <td class="item-type">
                                            ${this.isReservationItem(item) ? '<span class="type-badge reservation">Reservation</span>' : '<span class="type-badge product">Product</span>'}
                                        </td>
                                    </tr>
                                `).join('') || '<tr><td colspan="6" class="no-items">No items found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Order Financial Summary -->
                <div class="order-financial-summary">
                    <h3>Order Summary</h3>
                    <div class="financial-breakdown">
                        <div class="financial-row">
                            <span class="financial-label">Subtotal:</span>
                            <span class="financial-value">${this.formatMoney(order.subTotal)}</span>
                        </div>
                        ${order.taxTotal ? `
                        <div class="financial-row">
                            <span class="financial-label">Tax:</span>
                            <span class="financial-value">${this.formatMoney(order.taxTotal)}</span>
                        </div>
                        ` : ''}
                        ${order.tipTotal ? `
                        <div class="financial-row">
                            <span class="financial-label">Tip:</span>
                            <span class="financial-value">${this.formatMoney(order.tipTotal)}</span>
                        </div>
                        ` : ''}
                        ${order.shippingTotal ? `
                        <div class="financial-row">
                            <span class="financial-label">Shipping:</span>
                            <span class="financial-value">${this.formatMoney(order.shippingTotal)}</span>
                        </div>
                        ` : ''}
                        ${order.dutyTotal ? `
                        <div class="financial-row">
                            <span class="financial-label">Duty:</span>
                            <span class="financial-value">${this.formatMoney(order.dutyTotal)}</span>
                        </div>
                        ` : ''}
                        <div class="financial-row total-row">
                            <span class="financial-label"><strong>Total:</strong></span>
                            <span class="financial-value"><strong>${this.formatMoney(order.total || order.totalAmount)}</strong></span>
                        </div>
                    </div>
                </div>

                <!-- Additional Information -->
                <div class="additional-info">
                    <div class="info-section">
                        <h4>Sales Associate</h4>
                        <div class="associate-info">
                            <span class="associate-name">${order.salesAssociate?.name || 'Unknown'}</span>
                            <span class="associate-pill">${order.salesAssociate?.name || 'Unknown'}</span>
                        </div>
                    </div>
                    
                    ${order.notes ? `
                        <div class="info-section">
                            <h4>Order Notes</h4>
                            <div class="order-notes">${order.notes}</div>
                        </div>
                    ` : ''}
                    
                    ${order.shippingAddress ? `
                        <div class="info-section">
                            <h4>Shipping Address</h4>
                            <div class="address-info">
                                ${this.formatAddress(order.shippingAddress)}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.elements.orderDetailsModal.classList.add('show');
    }

    closeModal() {
        this.elements.orderDetailsModal.classList.remove('show');
        this.state.expandedOrderId = null;
    }

    // Rendering
    renderOrders() {
        if (this.state.currentView === 'table') {
            this.renderTableView();
        } else {
            this.renderCardView();
        }
    }

    renderTableView() {
        const tbody = this.elements.ordersTableBody;
        tbody.innerHTML = '';
        
        if (this.state.filteredOrders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #999;">
                        ${this.state.orders.length === 0 ? 'No orders loaded' : 'No orders match your filters'}
                    </td>
                </tr>
            `;
            return;
        }
        
        this.state.filteredOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="order-number" onclick="dashboard.showOrderDetails('${order.id}')">${order.orderNumber}</span></td>
                <td>${order.salesAssociate?.name || 'Unknown'}</td>
                <td>${this.formatDate(order.orderDate || order.orderPaidDate)}</td>
                <td>${this.formatMoney(order.total || order.totalAmount)}</td>
                <td><button class="expand-btn" onclick="dashboard.showOrderDetails('${order.id}')">▶</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    renderCardView() {
        const container = this.elements.ordersCardsContainer;
        container.innerHTML = '';
        
        if (this.state.filteredOrders.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999; grid-column: 1 / -1;">
                    ${this.state.orders.length === 0 ? 'No orders loaded' : 'No orders match your filters'}
                </div>
            `;
            return;
        }
        
        this.state.filteredOrders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-order-number" onclick="dashboard.showOrderDetails('${order.id}')">${order.orderNumber}</span>
                    <button class="card-expand-btn" onclick="dashboard.showOrderDetails('${order.id}')">▶</button>
                </div>
                <div class="card-details">
                    <div class="card-detail">
                        <span class="card-detail-label">Sales Associate</span>
                        <span class="card-detail-value">${order.salesAssociate?.name || 'Unknown'}</span>
                    </div>
                    <div class="card-detail">
                        <span class="card-detail-label">Order Date</span>
                        <span class="card-detail-value">${this.formatDate(order.orderDate || order.orderPaidDate)}</span>
                    </div>
                    <div class="card-detail">
                        <span class="card-detail-label">Total Amount</span>
                        <span class="card-detail-value">${this.formatMoney(order.total || order.totalAmount)}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    switchView(view) {
        this.state.currentView = view;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}-view-btn`).classList.add('active');
        
        // Show/hide views
        this.elements.tableView.style.display = view === 'table' ? 'block' : 'none';
        this.elements.cardView.style.display = view === 'card' ? 'block' : 'none';
        
        this.renderOrders();
    }

    // Excel Export
    async exportToExcel() {
        if (this.state.filteredOrders.length === 0) {
            this.showStatus('No orders to export', 'error');
            return;
        }
        
        this.showStatus('Generating Excel file...', 'loading');
        
        try {
            const fromDate = this.elements.fromDateInput.value;
            const toDate = this.elements.toDateInput.value;
            
            const url = `/export?from=${fromDate}&to=${toDate}&associates=${Array.from(this.state.selectedAssociates).join(',')}&search=${this.elements.orderSearchInput.value}`;
            
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

    // UI Helpers
    updateResultsTitle() {
        const count = this.state.filteredOrders.length;
        const total = this.state.orders.length;
        
        if (total === 0) {
            this.elements.resultsTitle.textContent = 'No orders loaded';
        } else if (count === total) {
            this.elements.resultsTitle.textContent = `${count} orders with missing guest counts`;
        } else {
            this.elements.resultsTitle.textContent = `${count} of ${total} orders (filtered)`;
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = this.elements.statusMessage;
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
        
        try {
            const date = new Date(dateString);
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.warn('Invalid date string:', dateString);
                return 'Invalid Date';
            }
            
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'America/New_York' // Adjust for your timezone
            });
        } catch (error) {
            console.error('Error formatting date:', dateString, error);
            return 'Date Error';
        }
    }

    formatCurrency(amount) {
        if (!amount) return '0.00';
        // Convert cents to dollars (Commerce7 stores prices in cents)
        return (parseFloat(amount) / 100).toFixed(2);
    }

    // Helper function for formatting money from cents
    formatMoney(cents) {
        if (!cents && cents !== 0) return '$0.00';
        return '$' + (parseFloat(cents) / 100).toFixed(2);
    }

    // State management helper
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    // Order details helper methods
    getAssociateColorClass(associateName) {
        if (!associateName) return 'associate-unknown';
        
        // Generate a consistent color class based on associate name
        const colors = ['associate-1', 'associate-2', 'associate-3', 'associate-4', 'associate-5'];
        const hash = associateName.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    }

    isReservationItem(item) {
        const name = (item.productTitle || item.productName || item.name || '').toLowerCase();
        return name.includes('reservation') || name.includes('tasting') || name.includes('tour');
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        
        const parts = [
            address.address1,
            address.address2,
            address.city,
            address.state,
            address.zip
        ].filter(Boolean);
        
        return parts.join(', ');
    }

    // Quick action methods
    openInCommerce7(orderId) {
        // Construct Commerce7 admin URL
        const baseUrl = 'https://app.commerce7.com';
        const tenantId = 'milea-estate-vineyard'; // This should match your tenant
        const url = `${baseUrl}/${tenantId}/orders/${orderId}`;
        
        window.open(url, '_blank');
        this.showToast('Opening in Commerce7...', 'info');
    }

    copyOrderNumber(orderNumber) {
        navigator.clipboard.writeText(orderNumber).then(() => {
            this.showToast(`Order ${orderNumber} copied to clipboard!`, 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = orderNumber;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast(`Order ${orderNumber} copied to clipboard!`, 'success');
        });
    }

    toggleFlagForReview(orderId) {
        const button = document.querySelector(`[onclick="dashboard.toggleFlagForReview('${orderId}')"]`);
        const isFlagged = button.dataset.flagged === 'true';
        
        button.dataset.flagged = !isFlagged;
        button.innerHTML = `
            <span class="btn-icon">${!isFlagged ? '🚩' : '✅'}</span>
            ${!isFlagged ? 'Flagged for Review' : 'Flag for Review'}
        `;
        
        // Toggle button styling
        if (!isFlagged) {
            button.classList.add('flagged');
        } else {
            button.classList.remove('flagged');
        }
        
        this.showToast(
            !isFlagged ? 'Order flagged for review' : 'Flag removed from order', 
            'info'
        );
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${this.getToastIcon(type)}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        return icons[type] || icons.info;
    }
}

// Initialize the dashboard when the page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new GuestCountDashboard();
});

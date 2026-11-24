/**
 * Billing Module - FoodWaste AI Project
 * Handles auth guard, table-wise grouping, history archiving on checkout, and date-wise history view
 */

const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Store grouped active tables in memory so checkout has exact items & quantities
let activeTableMap = {};

async function checkAuthGuard() {
    if (!supabaseClient) return;
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) {
            window.location.href = "login.html";
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = "login.html";
    }
}

if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = "login.html";
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthGuard();
    loadLoggedInUser();

    const dateDisplay = document.getElementById('currentDateDisplay');
    if (dateDisplay) {
        const today = new Date();
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        dateDisplay.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right: 6px; color: #10b981;"></i>${today.toLocaleDateString('en-US', options)}`;
    }

    // Default date filter to today (YYYY-MM-DD)
    const dateFilterInput = document.getElementById('historyDateFilter');
    const showAllBtn = document.getElementById('showAllHistoryBtn');
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateFilterInput) {
        dateFilterInput.value = todayStr;
        dateFilterInput.addEventListener('change', () => fetchSettledHistory(dateFilterInput.value));
    }
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            if (dateFilterInput) dateFilterInput.value = '';
            fetchSettledHistory(null);
        });
    }

    fetchReadyOrders();
    fetchSettledHistory(todayStr);

    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileCloseBtn = document.getElementById('mobileCloseBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.add('show');
            sidebarOverlay.classList.add('show');
        });
    }

    const closeSidebarMenu = () => {
        if (sidebar) sidebar.classList.remove('show');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    };

    if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', closeSidebarMenu);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarMenu);

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to log out?')) {
                if (supabaseClient) await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            }
        });
    }
});

async function loadLoggedInUser() {
    if (!supabaseClient) return;
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error || !user) return;
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Admin');
        const nameElem = document.getElementById('sidebarAdminName');
        if (nameElem && userName) nameElem.textContent = userName;
    } catch (err) {
        console.error('Failed to fetch user session:', err.message);
    }
}

async function fetchReadyOrders() {
    const container = document.getElementById('billingContainer');
    if (!container) return;

    container.innerHTML = `<div class="no-orders">Loading ready orders for billing...</div>`;

    if (!supabaseClient) {
        container.innerHTML = `<div class="no-orders">Supabase not connected.</div>`;
        return;
    }

    try {
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching bills:', error);
            container.innerHTML = `<div class="no-orders">Error loading bills from database.</div>`;
            return;
        }

        if (!orders || orders.length === 0) {
            activeTableMap = {};
            container.innerHTML = `<div class="no-orders">No active bills found.</div>`;
            return;
        }

        const tableMap = {};

        orders.forEach(order => {
            const tableNo = String(order.table_number || '1');

            if (!tableMap[tableNo]) {
                tableMap[tableNo] = {
                    tableNumber: tableNo,
                    orderIds: [],
                    items: [],
                    totalQty: 0,
                    totalAmount: 0,
                    latestTime: order.created_at
                };
            }

            tableMap[tableNo].orderIds.push(order.id);

            let parsedItems = [];
            try {
                parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
            } catch (e) {
                parsedItems = [{ name: order.dish_name || 'Meal Item', quantity: order.quantity || 1, price: 200 }];
            }

            if (Array.isArray(parsedItems)) {
                parsedItems.forEach(item => {
                    const price = Number(item.price) || 150;
                    const qty = Number(item.quantity || item.qty) || 1;
                    tableMap[tableNo].items.push({
                        name: item.name || item.dish_name || 'Item',
                        price,
                        qty
                    });
                    tableMap[tableNo].totalQty += qty;
                    tableMap[tableNo].totalAmount += price * qty;
                });
            }
        });

        activeTableMap = tableMap;
        container.innerHTML = '';

        Object.values(tableMap).forEach(tableData => {
            let itemsList = '';
            tableData.items.forEach(item => {
                const itemTotal = item.price * item.qty;
                itemsList += `
                    <li class="bill-item-row">
                        <span>${item.name} (x${item.qty})</span>
                        <span>₹${itemTotal}</span>
                    </li>
                `;
            });

            const card = document.createElement('div');
            card.className = 'bill-card';
            card.innerHTML = `
                <div>
                    <div class="bill-header">
                        <span class="table-tag">Table #${tableData.tableNumber}</span>
                        <span class="order-time">${new Date(tableData.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <ul class="bill-items">${itemsList}</ul>
                </div>
                <div>
                    <div class="bill-total">
                        <span>Total Amount:</span>
                        <span>₹${tableData.totalAmount}</span>
                    </div>
                    <button class="btn-print checkout-btn" data-table="${tableData.tableNumber}">
                        <i class="fa-solid fa-print"></i> Print & Checkout Table
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

        attachCheckoutListeners();

    } catch (err) {
        console.error('Unexpected error:', err);
        container.innerHTML = `<div class="no-orders">An unexpected error occurred.</div>`;
    }
}

function attachCheckoutListeners() {
    const buttons = document.querySelectorAll('.checkout-btn');
    buttons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const tableNo = e.currentTarget.getAttribute('data-table');
            const tableData = activeTableMap[tableNo];
            if (!tableData) return;

            const confirmCheckout = confirm(`Archive & Checkout Table #${tableNo} for Total Amount: ₹${tableData.totalAmount}?`);
            if (!confirmCheckout) return;

            // 1. Archive into order_history first
            const { error: archiveError } = await supabaseClient
                .from('order_history')
                .insert([{
                    table_number: tableData.tableNumber,
                    items: tableData.items,
                    total_qty: tableData.totalQty,
                    total_amount: tableData.totalAmount,
                    status: 'settled',
                    settled_at: new Date().toISOString()
                }]);

            if (archiveError) {
                alert('Error saving bill to history! Active order was NOT deleted.');
                console.error('Archive error:', archiveError);
                return;
            }

            // 2. Delete active rows from orders table so active queue stays clean
            const { error: deleteError } = await supabaseClient
                .from('orders')
                .delete()
                .in('id', tableData.orderIds);

            if (deleteError) {
                alert('Archived to history, but error clearing active orders table.');
                console.error('Delete error:', deleteError);
            } else {
                alert(`Table #${tableNo} settled and saved to History!`);
                fetchReadyOrders();
                const selectedDate = document.getElementById('historyDateFilter')?.value || null;
                fetchSettledHistory(selectedDate);
            }
        });
    });
}

async function fetchSettledHistory(selectedDateStr) {
    const tbody = document.getElementById('historyTableBody');
    const summaryEl = document.getElementById('historyTotalSummary');
    if (!tbody || !supabaseClient) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">Loading history...</td></tr>`;
    if (summaryEl) summaryEl.textContent = '';

    try {
        let query = supabaseClient
            .from('order_history')
            .select('*')
            .order('settled_at', { ascending: false });

        if (selectedDateStr) {
            const startOfDay = `${selectedDateStr}T00:00:00.000Z`;
            const endOfDay = `${selectedDateStr}T23:59:59.999Z`;
            query = query.gte('settled_at', startOfDay).lte('settled_at', endOfDay);
        }

        const { data: rows, error } = await query;

        if (error) {
            console.error('History fetch error:', error);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc2626;">Could not load order_history table. Check if table exists.</td></tr>`;
            return;
        }

        if (!rows || rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">No settled bills found for this selection.</td></tr>`;
            return;
        }

        let grandTotal = 0;
        tbody.innerHTML = '';

        rows.forEach(row => {
            const amount = Number(row.total_amount) || 0;
            grandTotal += amount;

            let itemsText = '';
            const itemsArr = Array.isArray(row.items) ? row.items : [];
            itemsText = itemsArr.map(i => `${i.name} (x${i.qty || i.quantity || 1})`).join(', ');

            const dt = new Date(row.settled_at);
            const formattedDateTime = dt.toLocaleString([], {
                year: 'numeric', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formattedDateTime}</td>
                <td><span class="table-tag">Table #${row.table_number}</span></td>
                <td>${itemsText || '-'}</td>
                <td>${row.total_qty || 0}</td>
                <td><strong>₹${amount}</strong></td>
            `;
            tbody.appendChild(tr);
        });

        if (summaryEl) {
            summaryEl.textContent = `Total Settled Amount: ₹${grandTotal} (${rows.length} record${rows.length > 1 ? 's' : ''})`;
        }

    } catch (err) {
        console.error('History error:', err);
    }
}
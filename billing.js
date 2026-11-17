/**
 * Billing Module - FoodWaste AI Project
 * Handles session authentication, dynamic user loading, table-wise grouping, and invoice checkout
 */

// Supabase Configuration
const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

// Initialize Supabase Client safely
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ==========================================================================
// AUTHENTICATION GUARD (Check if user is logged in before rendering page)
// ==========================================================================
async function checkAuthGuard() {
    if (!supabaseClient) {
        console.warn("Supabase client not initialized. Skipping guard.");
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error || !session) {
            console.warn("Unauthorized access detected. Redirecting to login...");
            window.location.href = "login.html";
        } else {
            console.log("User authenticated:", session.user.email);
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = "login.html";
    }
}

// Listen for auth state changes
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = "login.html";
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authentication check run karo
    await checkAuthGuard();

    // 2. Fetch and display logged-in user dynamically from Supabase Auth
    loadLoggedInUser();

    // 3. Header Date Display update
    const dateDisplay = document.getElementById('currentDateDisplay');
    if (dateDisplay) {
        const today = new Date();
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        dateDisplay.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right: 6px; color: #10b981;"></i>${today.toLocaleDateString('en-US', options)}`;
    }

    // 4. Fetch Ready Orders for Billing
    fetchReadyOrders();

    // 5. Sidebar Mobile Toggle & Close Controls
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
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

    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebarMenu);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarMenu);

    // 6. Logout button functionality handler
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to log out?')) {
                if (supabaseClient) {
                    await supabaseClient.auth.signOut();
                }
                window.location.href = 'index.html';
            }
        });
    }
});

// Function to fetch and display the logged-in user's details from Supabase Auth
async function loadLoggedInUser() {
    if (!supabaseClient) return;

    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.warn('Auth session error or not logged in:', error.message);
            return;
        }

        if (user) {
            const userName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'User');
            
            const nameElem = document.getElementById('sidebarAdminName');
            if (nameElem && userName) {
                nameElem.textContent = userName;
            }
        }
    } catch (err) {
        console.error('Failed to fetch user session:', err.message);
    }
}

// Database se orders fetch karke Table-wise Grouping karne ka function
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
            container.innerHTML = `<div class="no-orders">No active bills found.</div>`;
            return;
        }

        // Grouping orders by Table Number
        const tableMap = {};

        orders.forEach(order => {
            const tableNo = order.table_number || '1';
            
            if (!tableMap[tableNo]) {
                tableMap[tableNo] = {
                    tableNumber: tableNo,
                    orderIds: [], 
                    items: [],
                    latestTime: order.created_at
                };
            }

            tableMap[tableNo].orderIds.push(order.id);

            let parsedItems = [];
            try {
                parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            } catch (e) {
                parsedItems = [{ name: order.dish_name || 'Meal Item', quantity: order.quantity || 1, price: 200 }];
            }

            if (Array.isArray(parsedItems)) {
                parsedItems.forEach(item => {
                    tableMap[tableNo].items.push({
                        name: item.name || item.dish_name,
                        price: item.price || 150,
                        qty: item.quantity || item.qty || 1
                    });
                });
            }
        });

        container.innerHTML = '';

        Object.values(tableMap).forEach(tableData => {
            let itemsList = '';
            let totalAmount = 0;

            tableData.items.forEach(item => {
                let itemTotal = item.price * item.qty;
                totalAmount += itemTotal;
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
                    <ul class="bill-items">
                        ${itemsList}
                    </ul>
                </div>
                <div>
                    <div class="bill-total">
                        <span>Total Amount:</span>
                        <span>₹${totalAmount}</span>
                    </div>
                    <button class="btn-print checkout-btn" data-ids='${JSON.stringify(tableData.orderIds)}' data-table="${tableData.tableNumber}" data-amount="${totalAmount}">
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

// Checkout listener for Table-wise bulk delete
function attachCheckoutListeners() {
    const buttons = document.querySelectorAll('.checkout-btn');
    buttons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const orderIds = JSON.parse(e.currentTarget.getAttribute('data-ids'));
            const tableNo = e.currentTarget.getAttribute('data-table');
            const amount = e.currentTarget.getAttribute('data-amount');

            const confirmCheckout = confirm(`Generate Consolidated Invoice & Checkout Table #${tableNo} for Total Amount: ₹${amount}?`);
            
            if (confirmCheckout) {
                const { error } = await supabaseClient
                    .from('orders')
                    .delete()
                    .in('id', orderIds);

                if (error) {
                    alert('Error closing the table orders in database.');
                    console.error(error);
                } else {
                    alert(`Invoice printed successfully! Table #${tableNo} has been completely checked out.`);
                    fetchReadyOrders(); 
                }
            }
        });
    });
}
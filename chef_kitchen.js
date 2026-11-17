const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.addEventListener('DOMContentLoaded', () => {
    fetchLiveOrders();
    
    // Optional: Har 5 seconds mein auto-refresh karne ke liye taaki naye orders khud dikhein
    setInterval(fetchLiveOrders, 5000);
});

async function fetchLiveOrders() {
    if (!supabaseClient) {
        console.warn("Supabase client not found.");
        return;
    }

    try {
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .in('status', ['pending', 'preparing'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching orders:", error.message);
            return;
        }

        if (orders) {
            renderOrders(orders);
        }
    } catch (err) {
        console.error("KDS fetch exception:", err);
    }
}

function renderOrders(orders) {
    const container = document.getElementById('kdsOrdersContainer');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 40px;">No active orders in the kitchen right now.</p>`;
        return;
    }

    container.innerHTML = '';

    orders.forEach(order => {
        const statusBadge = order.status === 'preparing' 
            ? '<span class="badge-status status-preparing">Preparing</span>' 
            : '<span class="badge-status status-pending">Pending</span>';

        let itemsHtml = '';
        let items = order.items;
        
        // Agar items string form mein hain toh parse karein
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }
        
        if (Array.isArray(items)) {
            items.forEach(item => {
                itemsHtml += `<li><span>${item.name || 'Dish'}</span> <span class="item-qty">x ${item.quantity || 1}</span></li>`;
            });
        }

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-card-header">
                <span class="order-id">Table: ${order.table_number || 'Walk-in'}</span>
                ${statusBadge}
            </div>
            <div class="order-body">
                <ul class="item-list">
                    ${itemsHtml || '<li><span>Custom Order</span> <span class="item-qty">x 1</span></li>'}
                </ul>
            </div>
            <div class="order-footer">
                <button class="btn-kds btn-prepare" onclick="updateOrderStatus('${order.id}', 'preparing')"><i class="fa-solid fa-play"></i> Prepare</button>
                <button class="btn-kds btn-ready" onclick="updateOrderStatus('${order.id}', 'ready')"><i class="fa-solid fa-check"></i> Ready</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Order status update karne ka function (Prepare ya Ready click hone par)
window.updateOrderStatus = async function(orderId, newStatus) {
    if (!supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (error) {
            alert("Status update karne mein error aayi: " + error.message);
            return;
        }

        // Turant list ko refresh karein
        fetchLiveOrders();
    } catch (err) {
        console.error("Update exception:", err);
    }
}
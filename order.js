const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Mock menu items (Aap ise apne database se bhi fetch kar sakte hain)
const menuDishes = [
    { id: 1, name: 'Veg Thali', price: 150 },
    { id: 2, name: 'Paneer Tikka', price: 220 },
    { id: 3, name: 'Masala Dosa', price: 120 },
    { id: 4, name: 'Cold Coffee', price: 90 },
    { id: 5, name: 'Fresh Lime Soda', price: 60 }
];

let cart = [];

document.addEventListener('DOMContentLoaded', () => {
    // Current date set karein
    const dateEl = document.getElementById('currentDateDisplay');
    if(dateEl) {
        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        dateEl.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right: 6px; color: #10b981;"></i>${today}`;
    }

    renderMenu();
    initOrderForm();
});

function renderMenu() {
    const grid = document.getElementById('menuDishesGrid');
    const countEl = document.getElementById('menuCount');
    if (!grid) return;

    grid.innerHTML = '';
    menuDishes.forEach(dish => {
        const card = document.createElement('div');
        card.style.cssText = "background:white; padding:15px; border-radius:8px; border:1px solid #e2e8f0; display:flex; flex-direction:column; justify-content:space-between;";
        card.innerHTML = `
            <div>
                <h4 style="margin:0 0 5px 0; font-size:14px; color:#1e293b;">${dish.name}</h4>
                <span style="font-size:12px; color:#64748b;">₹${dish.price} / portion</span>
            </div>
            <button type="button" onclick="addToCart(${dish.id})" style="margin-top:10px; padding:6px; background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">
                <i class="fa-solid fa-plus"></i> Add to Cart
            </button>
        `;
        grid.appendChild(card);
    });

    if(countEl) countEl.innerText = `${menuDishes.length} Items Available`;
}

window.addToCart = function(dishId) {
    const dish = menuDishes.find(d => d.id === dishId);
    if(!dish) return;

    const existing = cart.find(item => item.id === dishId);
    if(existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id: dish.id, name: dish.name, quantity: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const listEl = document.getElementById('cartItemsList');
    const totalQtyEl = document.getElementById('cartTotalQty');
    const placeBtn = document.getElementById('placeOrderBtn');

    if(!listEl) return;

    if(cart.length === 0) {
        listEl.innerHTML = `<p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 10px 0;">No items selected yet.</p>`;
        if(totalQtyEl) totalQtyEl.innerText = '0';
        if(placeBtn) placeBtn.disabled = true;
        return;
    }

    let html = '';
    let totalQty = 0;

    cart.forEach((item, index) => {
        totalQty += item.quantity;
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px dashed #e2e8f0; font-size:13px;">
                <span>${item.name} (x${item.quantity})</span>
                <button type="button" onclick="removeFromCart(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    listEl.innerHTML = html;
    if(totalQtyEl) totalQtyEl.innerText = totalQty;
    if(placeBtn) placeBtn.disabled = false;
}

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function initOrderForm() {
    const form = document.getElementById('orderForm');
    if(!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tableNumber = document.getElementById('tableNumber').value;
        const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

        if(cart.length === 0) return;

        const orderData = {
            table_number: tableNumber,
            items: JSON.stringify(cart),
            total_qty: totalQty,
            status: 'pending'
        };

        if(supabaseClient) {
            const { error } = await supabaseClient.from('orders').insert([orderData]);
            if(error) {
                alert("Order place karne mein error aayi: " + error.message);
                return;
            }
        }

        alert("Order successfully Kitchen ko bhej diya gaya hai!");
        cart = [];
        updateCartUI();
        document.getElementById('tableNumber').value = '';
        
        // Chahe toh direct KDS page par redirect kar sakte hain
        window.location.href = 'chef_kitchen.html';
    });
}
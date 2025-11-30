const Cart = {
    getCart: (req) => {
        if (!req) return [];
        if (!req.session) req.session = {};
        if (!Array.isArray(req.session.cart)) req.session.cart = [];
        return req.session.cart;
    },

    addItem: (req, product, quantity = 1) => {
        if (!req || !product) return Cart.getCart(req);

        const cart = Cart.getCart(req);

        const productId = product.id ?? product.productId ?? product.ID ?? product.product_id;
        const productName = product.productName ?? product.name ?? product.title ?? '';
        const price = Number(product.price ?? product.unitPrice ?? 0) || 0;
        let qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) qty = 1;

        // find existing item by productId (loose compare after coercion to number/string)
        const existing = cart.find(item => String(item.productId) === String(productId));

        if (existing) {
            existing.quantity = Number(existing.quantity || 0) + qty;
        } else {
            cart.push({
                productId,
                productName,
                price,
                quantity: qty,
                image: product.image ?? product.img ?? null
            });
        }

        return cart;
    },

    updateItem: (req, productId, quantity) => {
        if (!req) return [];
        const cart = Cart.getCart(req);
        const qty = parseInt(quantity, 10);

        if (!cart.length) return cart;

        const idx = cart.findIndex(item => String(item.productId) === String(productId));
        if (idx === -1) return cart;

        if (isNaN(qty) || qty <= 0) {
            // remove item if quantity is zero or invalid
            cart.splice(idx, 1);
        } else {
            cart[idx].quantity = qty;
        }

        return cart;
    },

    removeItem: (req, productId) => {
        if (!req) return [];
        const cart = Cart.getCart(req);
        req.session.cart = cart.filter(item => String(item.productId) !== String(productId));
        return req.session.cart;
    },

    clearCart: (req) => {
        if (!req) return [];
        if (!req.session) req.session = {};
        req.session.cart = [];
        return req.session.cart;
    },

    getTotal: (cart) => {
        if (!Array.isArray(cart) || cart.length === 0) return 0;
        const total = cart.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            return sum + price * qty;
        }, 0);
        // return numeric total (rounded to 2 decimals)
        return Number(total.toFixed(2));
    }
};

module.exports = Cart;
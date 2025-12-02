// controllers/CartController.js
const Product = require('../models/product');
const Cart = require('../models/Cart');

const CartController = {
    addToCart: (req, res) => {
        // product id may come from params or body
        const productId = req.params.id || req.body.productId;
        const quantity = parseInt(req.body.quantity || req.query.quantity || '1', 10) || 1;

        if (!productId) {
            req.flash('error', 'No product specified.');
            return res.redirect('/shopping');
        }

        // Retrieve product details from Product model
        if (typeof Product.getProductById === 'function') {
            Product.getProductById(productId, (err, product) => {
                if (err) {
                    req.flash('error', 'Error fetching product.');
                    return res.redirect('/shopping');
                }

                // model may return array or single object
                if (Array.isArray(product) && product.length) product = product[0];

                if (!product) {
                    req.flash('error', 'Product not found.');
                    return res.redirect('/shopping');
                }

                const availableQty = Number(product.quantity || 0);

                // ✅ HARD CHECK: out of stock
                if (availableQty <= 0) {
                    req.flash('error', `Sorry, "${product.productName}" is out of stock.`);
                    return res.redirect('/shopping');
                }

                // ✅ HARD CHECK: requested more than stock
                if (quantity > availableQty) {
                    req.flash('error', `Only ${availableQty} unit(s) of "${product.productName}" are left in stock.`);
                    return res.redirect('/shopping');
                }

                // All good – add to cart
                Cart.addItem(req, product, quantity);
                req.flash('success', 'Product added to cart.');
                return res.redirect('/shopping');
            });
        } else {
            // Fallback: try generic query method if model differs
            req.flash('error', 'Product model does not support getProductById.');
            return res.redirect('/shopping');
        }
    },

    viewCart: (req, res) => {
        const cart = Cart.getCart(req) || [];
        const total = Cart.getTotal(cart);
        res.render('cart', {
            cart,
            total,
            user: req.session.user,
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            }
        });
    },

    updateCart: (req, res) => {
        // productId and quantity may come from body or params
        const productId = req.body.productId || req.params.id;
        const quantity = req.body.quantity || req.params.quantity;

        if (!productId) {
            req.flash('error', 'No product specified.');
            return res.redirect('/cart');
        }

        Cart.updateItem(req, productId, quantity);
        req.flash('success', 'Cart updated.');
        return res.redirect('/cart');
    },

    removeFromCart: (req, res) => {
        const productId = req.params.id || req.body.productId;
        if (!productId) {
            req.flash('error', 'No product specified.');
            return res.redirect('/cart');
        }

        Cart.removeItem(req, productId);
        req.flash('success', 'Item removed from cart.');
        return res.redirect('/cart');
    },

    clearCart: (req, res) => {
        Cart.clearCart(req);
        req.flash('success', 'Cart cleared.');
        return res.redirect('/cart');
    },

    // (optional old checkout not used anymore if you use OrderController.checkout)
    checkout: (req, res) => {
        const cart = Cart.getCart(req) || [];
        if (!Array.isArray(cart) || cart.length === 0) {
            req.flash('error', 'Your cart is empty.');
            return res.redirect('/cart');
        }

        const total = Cart.getTotal(cart);

        Cart.clearCart(req);
        req.flash('success', `Checkout successful. Total: ${total.toFixed(2)}`);
        return res.redirect('/shopping');
    }
};

module.exports = CartController;

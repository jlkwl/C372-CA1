const connection = require('./db');

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Controllers
const productController = require('./controllers/ProductController');
const OrderController = require('./controllers/OrderController');
const CartDB = require('./models/CartDB');   // NEW

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());

// Authentication middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/shopping');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Helper: sync cart from DB into session
function syncCartFromDB(req, done) {
    if (!req.session.user) {
        req.session.cart = [];
        return done(null);
    }
    CartDB.getCart(req.session.user.id, (err, rows) => {
        if (err) {
            console.error('Error loading cart from DB:', err);
            return done(err);
        }
        req.session.cart = rows || [];
        done(null);
    });
}

// ====================== PRODUCT & HOME ROUTES ======================

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Inventory route (admin only)
app.get('/inventory', checkAuthenticated, checkAdmin, productController.listAllProducts);

// Shopping route (all authenticated users)
app.get('/shopping', checkAuthenticated, productController.listAllProducts);

// Product detail
app.get('/product/:id', checkAuthenticated, productController.getProductById);

// Add product routes
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', { user: req.session.user });
});

app.post(
    '/addProduct',
    checkAuthenticated,
    checkAdmin,
    upload.single('image'),
    productController.addProduct
);

// Update product routes
app.get('/updateProduct/:id',
    checkAuthenticated,
    checkAdmin,
    productController.renderUpdateProductForm
);

app.post(
    '/updateProduct/:id',
    checkAuthenticated,
    checkAdmin,
    upload.single('image'),
    productController.updateProduct
);

// Delete product
app.get('/deleteProduct/:id',
    checkAuthenticated,
    checkAdmin,
    productController.deleteProduct
);

// ====================== CART ROUTES (PERSISTENT) ======================

// Add to cart (uses DB, then syncs to session)
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.id);
    const quantityToAdd = parseInt(req.body.quantity, 10) || 1;
    const userId = req.session.user.id;

    productController.fetchProductById(productId, (err, product) => {
        if (err || !product) {
            req.flash('error', 'Error adding to cart');
            return res.redirect('/shopping');
        }

        const available = Number(product.quantity) || 0;
        if (available <= 0) {
            req.flash('error', `${product.productName} is out of stock.`);
            return res.redirect('/shopping');
        }

        // Check existing quantity in DB
        CartDB.getItem(userId, productId, (err2, existing) => {
            if (err2) {
                console.error(err2);
                req.flash('error', 'Could not update cart.');
                return res.redirect('/shopping');
            }

            const currentQty = existing ? Number(existing.quantity) || 0 : 0;
            let newQty = currentQty + quantityToAdd;

            if (newQty > available) {
                newQty = available;
                req.flash('error', `Only ${available} units of ${product.productName} are available.`);
            } else {
                req.flash('success', 'Product added to cart.');
            }

            CartDB.setItemQuantity(userId, productId, newQty, (err3) => {
                if (err3) {
                    console.error(err3);
                    req.flash('error', 'Could not save cart.');
                    return res.redirect('/shopping');
                }

                syncCartFromDB(req, () => {
                    return res.redirect('/cart');
                });
            });
        });
    });
});

// Show cart (always load from DB first)
app.get('/cart', checkAuthenticated, (req, res) => {
    syncCartFromDB(req, (err) => {
        if (err) console.error(err);
        res.render('cart', {
            cart: req.session.cart || [],
            user: req.session.user,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    });
});

// REMOVE ITEM FROM CART
app.post('/remove-from-cart/:id', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const productId = req.params.id;

    CartDB.removeItem(userId, productId, (err) => {
        if (err) console.error(err);
        syncCartFromDB(req, () => {
            req.flash('success', 'Item removed from cart.');
            res.redirect('/cart');
        });
    });
});

// CLEAR ENTIRE CART
app.post('/clear-cart', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    CartDB.clearCart(userId, (err) => {
        if (err) console.error(err);
        req.session.cart = [];
        req.flash('success', 'Cart cleared.');
        res.redirect('/cart');
    });
});

// UPDATE ITEM QUANTITY
app.post('/cart/update', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { productId, quantity } = req.body;
    const requestedQty = Math.max(1, parseInt(quantity, 10) || 1);

    // Optional: enforce stock limit again
    productController.fetchProductById(productId, (err, product) => {
        if (err || !product) {
            req.flash('error', 'Error updating cart.');
            return res.redirect('/cart');
        }

        let finalQty = requestedQty;
        const available = Number(product.quantity) || 0;
        if (finalQty > available) {
            finalQty = available;
            req.flash('error', `Only ${available} units of ${product.productName} are available.`);
        }

        CartDB.setItemQuantity(userId, productId, finalQty, (err2) => {
            if (err2) console.error(err2);
            syncCartFromDB(req, () => {
                req.flash('success', 'Cart updated.');
                res.redirect('/cart');
            });
        });
    });
});

// ====================== AUTH ROUTES ======================

app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('error'),
        formData: req.flash('formData')[0]
    });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const sql =
        'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(
        sql,
        [username, email, password, address, contact, role],
        (err, result) => {
            if (err) {
                throw err;
            }
            console.log(result);
            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        }
    );
});

app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql =
        'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            req.session.user = results[0];

            // load that user's saved cart into session
            syncCartFromDB(req, () => {
                req.flash('success', 'Login successful!');
                if (req.session.user.role === 'user') {
                    res.redirect('/shopping');
                } else {
                    res.redirect('/inventory');
                }
            });
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ====================== ORDER ROUTES ======================

// Checkout: load DB cart into session first, then delegate to controller
app.post('/checkout', checkAuthenticated, (req, res) => {
    syncCartFromDB(req, (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not load your cart.');
            return res.redirect('/cart');
        }
        OrderController.checkout(req, res);
    });
});

// List current user's orders
app.get('/orders', checkAuthenticated, OrderController.listUserOrders);

// View single order details
app.get('/order/:id', checkAuthenticated, OrderController.viewOrder);

// LIVE SEARCH SUGGESTIONS
app.get('/search-suggestions', (req, res) => {
    const term = req.query.term || "";

    const sql = `
        SELECT productName 
        FROM products 
        WHERE productName LIKE ?
        LIMIT 5
    `;

    connection.query(sql, [`%${term}%`], (err, results) => {
        if (err) return res.json([]);
        res.json(results.map(r => r.productName));
    });
});

// ====================== START SERVER ======================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}/`)
);

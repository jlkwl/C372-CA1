// ====================== SETUP ======================

const express = require('express');
const app = express();
const connection = require('./db');

const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');

// Controllers
const ProductController = require('./controllers/ProductController');
const OrderController = require('./controllers/OrderController');
const FeedbackController = require('./controllers/FeedbackController');
const User = require('./models/User');
const CartDB = require('./models/CartDB');

// ====================== FILE UPLOAD (MULTER) ======================

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// ====================== APP CONFIG ======================

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
        secret: 'supermarket-secret',
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
    })
);

app.use(flash());

// ====================== AUTH MIDDLEWARE ======================

const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in first.');
    res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied.');
    res.redirect('/shopping');
};

// ====================== CART SYNC ======================

function syncCartFromDB(req, done) {
    if (!req.session.user) {
        req.session.cart = [];
        return done(null);
    }

    CartDB.getCart(req.session.user.id, (err, items) => {
        if (err) return done(err);
        req.session.cart = items || [];
        done(null);
    });
}

// ====================== ROUTES ======================

// HOME
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// SHOPPING
app.get('/shopping', checkAuthenticated, ProductController.listAllProducts);

// INVENTORY (ADMIN)
app.get('/inventory', checkAuthenticated, checkAdmin, ProductController.listAllProducts);

// PRODUCT DETAILS
app.get('/product/:id', checkAuthenticated, ProductController.getProductById);

// ====================== HELP / FEEDBACK ======================

app.get('/help', checkAuthenticated, (req, res) => {
    res.render('help', {
        user: req.session.user,
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// Submit feedback (DB)
app.post('/help/feedback', checkAuthenticated, FeedbackController.submitFeedback);

// Admin view feedback (DB)
app.get('/admin/feedback', checkAuthenticated, checkAdmin, FeedbackController.listFeedback);

// ====================== ADMIN USERS ======================

app.get('/admin/users', checkAuthenticated, checkAdmin, (req, res) => {
    User.getAll((err, users) => {
        if (err) throw err;
        res.render('users', {
            user: req.session.user,
            users
        });
    });
});

// ====================== PRODUCT MANAGEMENT ======================

app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', { user: req.session.user });
});

app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), ProductController.addProduct);

app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, ProductController.renderUpdateProductForm);

app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), ProductController.updateProduct);

app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, ProductController.deleteProduct);

// ====================== CART ======================

app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const productId = parseInt(req.params.id);
    const qtyToAdd = Math.max(1, parseInt(req.body.quantity));

    ProductController.fetchProductById(productId, (err, product) => {
        if (err || !product) {
            req.flash('error', 'Product not found.');
            return res.redirect('/shopping');
        }

        const available = Number(product.quantity);

        CartDB.getItem(userId, productId, (err2, existing) => {
            if (err2) {
                req.flash('error', 'Cart error.');
                return res.redirect('/shopping');
            }

            const currentQty = existing ? Number(existing.quantity) : 0;
            let newQty = currentQty + qtyToAdd;

            if (newQty > available) {
                newQty = available;
                req.flash('error', `Only ${available} units available.`);
            } else {
                req.flash('success', 'Product added to cart.');
            }

            CartDB.setItemQuantity(userId, productId, newQty, () => {
                syncCartFromDB(req, () => res.redirect('/cart'));
            });
        });
    });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    syncCartFromDB(req, () => {
        res.render('cart', {
            cart: req.session.cart,
            user: req.session.user,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    });
});

app.post('/cart/update', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const productId = req.body.productId;
    let newQty = Math.max(1, parseInt(req.body.quantity));

    ProductController.fetchProductById(productId, (err, product) => {
        if (err || !product) return res.redirect('/cart');

        const available = Number(product.quantity);
        if (newQty > available) {
            newQty = available;
            req.flash('error', `Only ${available} units available.`);
        }

        CartDB.setItemQuantity(userId, productId, newQty, () => {
            syncCartFromDB(req, () => {
                req.flash('success', 'Cart updated.');
                res.redirect('/cart');
            });
        });
    });
});

app.post('/remove-from-cart/:id', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const productId = req.params.id;

    CartDB.removeItem(userId, productId, () => {
        syncCartFromDB(req, () => {
            req.flash('success', 'Item removed.');
            res.redirect('/cart');
        });
    });
});

app.post('/clear-cart', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    CartDB.clearCart(userId, () => {
        req.session.cart = [];
        req.flash('success', 'Cart cleared.');
        res.redirect('/cart');
    });
});

// ====================== AUTH ======================

app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('error'),
        formData: req.flash('formData')[0]
    });
});

app.post('/register', (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/register');
    }

    const sql = `INSERT INTO users (username, email, password, address, contact, role)
                 VALUES (?, ?, SHA1(?), ?, ?, ?)`;

    connection.query(sql, [username, email, password, address, contact, role], err => {
        if (err) throw err;

        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = `SELECT * FROM users WHERE email = ? AND password = SHA1(?)`;

    connection.query(sql, [email, password], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            req.flash('error', 'Invalid login.');
            return res.redirect('/login');
        }

        req.session.user = results[0];

        syncCartFromDB(req, () => {
            if (req.session.user.role === 'admin')
                return res.redirect('/inventory');
            else
                return res.redirect('/shopping');
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// ====================== ORDERS ======================

app.post('/checkout', checkAuthenticated, (req, res) => {
    syncCartFromDB(req, () => {
        OrderController.checkout(req, res);
    });
});

app.get('/orders', checkAuthenticated, OrderController.listUserOrders);

app.get('/order/:id', checkAuthenticated, OrderController.viewOrder);

// ====================== START SERVER ======================

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));


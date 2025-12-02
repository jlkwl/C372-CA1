const connection = require('./db');

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Controllers
const productController = require('./controllers/ProductController');
const OrderController = require('./controllers/OrderController');

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
    if (req.session.user.role === 'admin') {
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

// ====================== CART ROUTES ======================

// Add to cart
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.id);
    const quantityToAdd = parseInt(req.body.quantity, 10) || 1;

    productController.fetchProductById(productId, (err, product) => {
        if (err) {
            req.flash('error', 'Error adding to cart');
            return res.redirect('/shopping');
        }

        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/shopping');
        }

        if (!req.session.cart) req.session.cart = [];

        const available = Number(product.quantity) || 0;
        const existingItem = req.session.cart.find(
            item => String(item.productId) === String(productId)
        );

        if (existingItem) {
            const newTotal =
                Number(existingItem.quantity || 0) +
                Number(quantityToAdd || 0);

            if (newTotal > available) {
                existingItem.quantity = available;
                req.flash(
                    'error',
                    `Only ${available} units of ${product.productName} are available.`
                );
            } else {
                existingItem.quantity = newTotal;
            }
        } else {
            let addQty = Number(quantityToAdd || 0);
            if (addQty > available) {
                addQty = available;
                req.flash(
                    'error',
                    `Only ${available} units of ${product.productName} are available.`
                );
            }

            if (addQty > 0) {
                req.session.cart.push({
                    productId: product.id,
                    productName: product.productName,
                    price: product.price,
                    quantity: addQty,
                    image: product.image
                });
            } else {
                req.flash('error', `${product.productName} is out of stock.`);
            }
        }

        return res.redirect('/cart');
    });
});

// Show cart
app.get('/cart', checkAuthenticated, (req, res) => {
    res.render('cart', {
        cart: req.session.cart || [],
        user: req.session.user,
        errors: req.flash('error'),
        messages: req.flash('success')
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
            req.flash('success', 'Login successful!');
            if (req.session.user.role === 'user') {
                res.redirect('/shopping');
            } else {
                res.redirect('/inventory');
            }
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

// Checkout: create order from cart, update inventory, clear cart
app.post('/checkout', checkAuthenticated, OrderController.checkout);

// List current user's orders
app.get('/orders', checkAuthenticated, OrderController.listUserOrders);

// View single order details
app.get('/order/:id', checkAuthenticated, OrderController.viewOrder);

// ====================== START SERVER ======================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}/`)
);


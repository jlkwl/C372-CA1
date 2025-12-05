const Product = require('../models/product');

const ProductController = {

    // ============================
    // LIST PRODUCTS (SHOP + INVENTORY)
    // ============================
    listAllProducts: (req, res) => {
        const search = req.query.search || "";
        const category = req.query.category || "All";

        // ---------- ADMIN INVENTORY ----------
        if (req.path.includes('/inventory')) {
            Product.getAllProducts((err, results) => {
                if (err) {
                    req.flash('error', 'Error fetching products');
                    return res.redirect('/');
                }
                return res.render('inventory', {
                    products: results,
                    user: req.session.user
                });
            });
            return;
        }

        // ---------- USER SHOPPING ----------
        Product.getFilteredProducts(search, category, (err, results) => {
            if (err) {
                req.flash('error', 'Error fetching products');
                return res.redirect('/');
            }

            res.render('shopping', {
                products: results,
                user: req.session.user,
                search,
                category
            });
        });
    },

    // ============================
    // VIEW SINGLE PRODUCT DETAILS
    // ============================
    getProductById: (req, res) => {
        const id = req.params.id;

        Product.getProductById(id, (err, product) => {
            if (err) {
                req.flash('error', 'Error fetching product');
                return res.redirect('/');
            }
            if (!product) {
                return res.status(404).send('Product not found');
            }

            res.render('product', {
                product,
                user: req.session.user
            });
        });
    },

    // Used by Add-to-Cart logic in app.js
    fetchProductById: (id, callback) => {
        Product.getProductById(id, callback);
    },

    // ============================
    // ADD PRODUCT (ADMIN)
    // ============================
    addProduct: (req, res) => {
        const { name, quantity, price, category } = req.body;
        const image = req.file ? req.file.filename : null;

        const productData = {
            productName: name,
            quantity: Number(quantity) || 0,
            price: parseFloat(price) || 0,
            image,
            category
        };

        Product.addProduct(productData, (err) => {
            if (err) {
                console.log(err);
                req.flash('error', 'Error adding product');
                return res.redirect('/addProduct');
            }
            req.flash('success', 'Product added successfully');
            res.redirect('/inventory');
        });
    },

    // ============================
    // UPDATE PRODUCT (ADMIN)
    // ============================
    renderUpdateProductForm: (req, res) => {
        const id = req.params.id;

        Product.getProductById(id, (err, product) => {
            if (err || !product) {
                req.flash('error', 'Product not found');
                return res.redirect('/inventory');
            }

            res.render('updateProduct', {
                product,
                user: req.session.user
            });
        });
    },

    updateProduct: (req, res) => {
        const id = req.params.id;
        const { name, quantity, price, category } = req.body;
        const image = req.file ? req.file.filename : req.body.currentImage;

        const productData = {
            productName: name,
            quantity: Number(quantity) || 0,
            price: parseFloat(price) || 0,
            image,
            category
        };

        Product.updateProduct(id, productData, (err) => {
            if (err) {
                console.log(err);
                req.flash('error', 'Error updating product');
                return res.redirect(`/updateProduct/${id}`);
            }
            req.flash('success', 'Product updated successfully');
            res.redirect('/inventory');
        });
    },

    // ============================
    // DELETE PRODUCT (ADMIN)
    // ============================
    deleteProduct: (req, res) => {
        const id = req.params.id;

        Product.deleteProduct(id, (err) => {
            if (err) {
                req.flash('error', 'Error deleting product');
                return res.redirect('/inventory');
            }
            req.flash('success', 'Product deleted successfully');
            res.redirect('/inventory');
        });
    }
};

module.exports = ProductController;
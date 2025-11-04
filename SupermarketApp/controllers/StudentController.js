const Product = require('../models/Students'); // Using existing Students model

const ProductController = {
    // List all products (for both inventory and shopping)
    listAllProducts: (req, res) => {
        Product.getAllProducts((err, results) => {
            if (err) {
                req.flash('error', 'Error fetching products');
                return res.redirect('/');
            }
            
            // Render inventory or shopping view based on path
            const view = req.path.includes('/inventory') ? 'inventory' : 'shopping';
            res.render(view, { 
                products: results, 
                user: req.session.user 
            });
        });
    },

    // Get single product
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

    // Helper method for cart
    fetchProductById: (id, callback) => {
        Product.getProductById(id, callback);
    },

    // Add new product
    addProduct: (req, res) => {
        const { name, quantity, price } = req.body;
        const image = req.file ? req.file.filename : null;

        const productData = {
            productName: name,
            quantity: Number(quantity) || 0,
            price: parseFloat(price) || 0,
            image
        };

        Product.addProduct(productData, (err) => {
            if (err) {
                req.flash('error', 'Error adding product');
                return res.redirect('/addProduct');
            }
            req.flash('success', 'Product added successfully');
            res.redirect('/inventory');
        });
    },

    // Render update form
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

    // Update product
    updateProduct: (req, res) => {
        const id = req.params.id;
        const { name, quantity, price } = req.body;
        const image = req.file ? req.file.filename : req.body.currentImage;

        const productData = {
            productName: name,
            quantity: Number(quantity) || 0,
            price: parseFloat(price) || 0,
            image
        };

        Product.updateProduct(id, productData, (err) => {
            if (err) {
                req.flash('error', 'Error updating product');
                return res.redirect(`/updateProduct/${id}`);
            }
            req.flash('success', 'Product updated successfully');
            res.redirect('/inventory');
        });
    },

    // Delete product
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
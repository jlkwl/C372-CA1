// ====================== SETUP ======================

const express = require("express");
const path = require("path");
const app = express();
const connection = require("./db");

const session = require("express-session");
const flash = require("connect-flash");
const multer = require("multer");

require("dotenv").config();

// Services
const paypal = require("./services/paypal");

// (Optional) NETS - keep if you want
let netsQr = null;
try {
  netsQr = require("./services/nets");
} catch (e) {
  // ignore if you removed nets
}

// Controllers
const ProductController = require("./controllers/ProductController");
const OrderController = require("./controllers/OrderController");
const FeedbackController = require("./controllers/FeedbackController");
const CartDB = require("./models/CartDB");

// ====================== MULTER (IMAGE UPLOAD) ======================

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public/images")),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// ====================== APP SETTINGS ======================

app.set("view engine", "ejs");

// ✅ IMPORTANT: always point to correct views folder
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    secret: "supermarket-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
  })
);

app.use(flash());

// ✅ Make user available in all EJS (no need to pass every time)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ====================== AUTH MIDDLEWARE ======================

const checkAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  req.flash("error", "Please log in first.");
  return res.redirect("/login");
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === "admin") return next();
  req.flash("error", "Access denied.");
  return res.redirect("/shopping");
};

// ====================== CART SYNC (DB → SESSION) ======================

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

function calcCartTotal(cart) {
  return (cart || []).reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
}

// ====================== ROUTES ======================

// HOME
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

// SHOPPING
app.get("/shopping", checkAuthenticated, ProductController.listAllProducts);

// PRODUCT DETAILS
app.get("/product/:id", checkAuthenticated, ProductController.getProductById);

// ====================== ADMIN INVENTORY ======================

app.get("/inventory", checkAuthenticated, checkAdmin, ProductController.listAllProducts);

app.get("/addProduct", checkAuthenticated, checkAdmin, (req, res) => {
  res.render("addProduct", { user: req.session.user });
});

app.post("/addProduct", checkAuthenticated, checkAdmin, upload.single("image"), ProductController.addProduct);

app.get("/updateProduct/:id", checkAuthenticated, checkAdmin, ProductController.renderUpdateProductForm);

app.post("/updateProduct/:id", checkAuthenticated, checkAdmin, upload.single("image"), ProductController.updateProduct);

app.get("/deleteProduct/:id", checkAuthenticated, checkAdmin, ProductController.deleteProduct);

// ====================== HELP CENTRE ======================

app.get("/help", checkAuthenticated, (req, res) => {
  res.render("help", {
    user: req.session.user,
    messages: req.flash("success"),
    errors: req.flash("error"),
  });
});

app.post("/help/feedback", checkAuthenticated, FeedbackController.submitFeedback);

// ====================== FEEDBACK (ADMIN) ======================

app.get("/admin/feedback", checkAuthenticated, checkAdmin, FeedbackController.listFeedback);
app.post("/admin/feedback/delete/:id", checkAuthenticated, checkAdmin, FeedbackController.deleteFeedback);
app.post("/admin/feedback/reply/:id", checkAuthenticated, checkAdmin, FeedbackController.replyFeedback);

// ====================== CART ======================

app.post("/add-to-cart/:id", checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const productId = parseInt(req.params.id, 10);
  const qtyToAdd = Math.max(1, parseInt(req.body.quantity, 10) || 1);

  ProductController.fetchProductById(productId, (err, product) => {
    if (err || !product) {
      req.flash("error", "Product not found.");
      return res.redirect("/shopping");
    }

    const available = Number(product.quantity);

    CartDB.getItem(userId, productId, (err2, existing) => {
      if (err2) {
        req.flash("error", "Cart error.");
        return res.redirect("/shopping");
      }

      const currentQty = existing ? Number(existing.quantity) : 0;
      let newQty = currentQty + qtyToAdd;

      if (newQty > available) {
        newQty = available;
        req.flash("error", `Only ${available} units available.`);
      } else {
        req.flash("success", "Product added to cart.");
      }

      CartDB.setItemQuantity(userId, productId, newQty, () => {
        syncCartFromDB(req, () => res.redirect("/cart"));
      });
    });
  });
});

// VIEW CART
app.get("/cart", checkAuthenticated, (req, res) => {
  syncCartFromDB(req, () => {
    res.render("cart", {
      cart: req.session.cart,
      user: req.session.user,
      errors: req.flash("error"),
      messages: req.flash("success"),
    });
  });
});

// UPDATE CART QUANTITY
app.post("/cart/update", checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const productId = parseInt(req.body.productId, 10);
  let newQty = Math.max(1, parseInt(req.body.quantity, 10) || 1);

  ProductController.fetchProductById(productId, (err, product) => {
    if (err || !product) return res.redirect("/cart");

    const available = Number(product.quantity);
    if (newQty > available) {
      newQty = available;
      req.flash("error", `Only ${available} units available.`);
    }

    CartDB.setItemQuantity(userId, productId, newQty, () => {
      syncCartFromDB(req, () => {
        req.flash("success", "Cart updated.");
        res.redirect("/cart");
      });
    });
  });
});

// REMOVE ITEM
app.post("/remove-from-cart/:id", checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const productId = parseInt(req.params.id, 10);

  CartDB.removeItem(userId, productId, () => {
    syncCartFromDB(req, () => {
      req.flash("success", "Item removed.");
      res.redirect("/cart");
    });
  });
});

// CLEAR CART
app.post("/clear-cart", checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  CartDB.clearCart(userId, () => {
    req.session.cart = [];
    req.flash("success", "Cart cleared.");
    res.redirect("/cart");
  });
});

// ====================== CHECKOUT PAGE (INVOICE + PAYMENT) ======================

app.get("/checkout", checkAuthenticated, (req, res) => {
  syncCartFromDB(req, () => {
    const cart = req.session.cart || [];
    const total = calcCartTotal(cart);

    if (!cart.length) {
      req.flash("error", "Your cart is empty.");
      return res.redirect("/cart");
    }

    res.render("checkout", {
      user: req.session.user,
      cart,
      total,
      PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || "",
    });
  });
});

// ====================== AUTH ======================

app.get("/register", (req, res) => {
  res.render("register", {
    messages: req.flash("error"),
    formData: req.flash("formData")[0],
  });
});

app.post("/register", (req, res) => {
  const { username, email, password, address, contact, role } = req.body;

  if (!username || !email || !password || !address || !contact || !role) {
    req.flash("error", "All fields are required.");
    return res.redirect("/register");
  }

  const sql = `
    INSERT INTO users (username, email, password, address, contact, role)
    VALUES (?, ?, SHA1(?), ?, ?, ?)
  `;

  connection.query(sql, [username, email, password, address, contact, role], (err) => {
    if (err) throw err;
    req.flash("success", "Registration successful! Please log in.");
    res.redirect("/login");
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    messages: req.flash("success"),
    errors: req.flash("error"),
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT * FROM users
    WHERE email = ? AND password = SHA1(?)
  `;

  connection.query(sql, [email, password], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      req.flash("error", "Invalid login.");
      return res.redirect("/login");
    }

    req.session.user = results[0];

    syncCartFromDB(req, () => {
      if (req.session.user.role === "admin") return res.redirect("/inventory");
      return res.redirect("/shopping");
    });
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ====================== ORDERS ======================

app.post("/place-order", checkAuthenticated, (req, res) => {
  // If your OrderController.checkout already exists, keep using it:
  syncCartFromDB(req, () => OrderController.checkout(req, res));
});

app.get("/orders", checkAuthenticated, OrderController.listUserOrders);
app.get("/order/:id", checkAuthenticated, OrderController.viewOrder);

// ====================== PAYPAL API ======================

// Create PayPal order
app.post("/api/paypal/create-order", checkAuthenticated, async (req, res) => {
  try {
    await new Promise((resolve) => syncCartFromDB(req, () => resolve()));

    const cart = req.session.cart || [];
    const total = calcCartTotal(cart);

    if (!cart.length || total <= 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const order = await paypal.createOrder(total);

    if (order && order.id) return res.json({ id: order.id });
    return res.status(500).json({ error: "Failed to create PayPal order", details: order });
  } catch (err) {
    console.error("PayPal create-order error:", err.message);
    return res.status(500).json({ error: "Failed to create PayPal order", message: err.message });
  }
});

// Capture PayPal order
app.post("/api/paypal/capture-order", checkAuthenticated, async (req, res) => {
  try {
    const { orderID } = req.body;
    if (!orderID) return res.status(400).json({ error: "Missing orderID" });

    const capture = await paypal.captureOrder(orderID);

    if (capture && capture.status === "COMPLETED") {
      return res.json({ status: "COMPLETED" });
    }

    return res.status(400).json({ error: "Payment not completed", details: capture });
  } catch (err) {
    console.error("PayPal capture-order error:", err.message);
    return res.status(500).json({ error: "Failed to capture PayPal order", message: err.message });
  }
});

// PayPal success page
app.get("/paypal/success", checkAuthenticated, (req, res) => {
  syncCartFromDB(req, () => {
    const cart = req.session.cart || [];
    const total = calcCartTotal(cart);

    // Clear cart after successful payment
    CartDB.clearCart(req.session.user.id, () => {
      req.session.cart = [];
      res.render("paymentSuccess", { user: req.session.user, cart, total });
    });
  });
});

// ====================== NETS (OPTIONAL) ======================

if (netsQr) {
  app.post("/pay/nets", checkAuthenticated, (req, res) => netsQr.generateQrCode(req, res));
}

// ====================== SERVER START ======================

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

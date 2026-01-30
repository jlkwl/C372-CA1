const axios = require('axios');
require('dotenv').config();

exports.generateQrCode = async (req, res) => {
  const cartTotal = parseFloat(req.body.cartTotal);

  // ✅ DEBUG LOG
  console.log("Cart Total Received:", cartTotal);

  try {
    if (!cartTotal || cartTotal <= 0) {
      return res.render("netsQrFail", {
        title: "Payment Error",
        responseCode: "N.A.",
        instructions: "",
        errorMsg: "Cart total is invalid or cart is empty.",
        total: (Number.isFinite(cartTotal) ? cartTotal : 0).toFixed(2),
        user: req.session.user,
      });
    }

    const payload = {
      merchant: {
        qrTxnReference: `TXN${Date.now()}`,
        txnDate: new Date().toISOString().slice(0, 10),
        txnTime: new Date().toTimeString().slice(0, 8),
        amount: cartTotal.toFixed(2),
        merchantName: process.env.NETS_MERCHANT_NAME || "Supermarket App",
      },
    };

    const response = await axios.post(process.env.NETS_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.NETS_API_KEY,
      },
    });

    const qrData = response?.data?.result?.data;
    if (!qrData) {
      return res.render("netsQrFail", {
        title: "Payment Error",
        responseCode: "N.A.",
        instructions: "",
        errorMsg: "NETS returned an invalid response.",
        total: cartTotal.toFixed(2),
        user: req.session.user,
      });
    }

    const responseCode = qrData.response?.header?.responseCode;
    if (responseCode !== "0000") {
      return res.render("netsQrFail", {
        title: "Payment Failed",
        responseCode: responseCode || "N.A.",
        instructions: qrData.response?.header?.description || "",
        errorMsg: "NETS payment initiation failed.",
        total: cartTotal.toFixed(2),
        user: req.session.user,
      });
    }

    return res.render("netsQr", {
      title: "NETS QR Payment",
      qrImage: qrData.qrCode || "",
      txnRef: payload.merchant.qrTxnReference,
      total: cartTotal.toFixed(2),
      user: req.session.user,
    });

  } catch (err) {
    console.error("NETS QR Error:", err?.response?.data || err.message);

    return res.render("netsQrFail", {
      title: "Payment Failed",
      errorMsg: "Unexpected error generating NETS QR.",
      responseCode: "SERVER_ERROR",
      instructions: "Please try again.",
      total: (Number.isFinite(cartTotal) ? cartTotal : 0).toFixed(2),
      user: req.session.user,
    });
  }
};

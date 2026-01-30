const axios = require("axios");

function getCourseInitIdParam() {
  try {
    require.resolve("./../course_init_id");
    const { courseInitId } = require("../course_init_id");
    return courseInitId ? `${courseInitId}` : "";
  } catch (error) {
    return "";
  }
}

exports.generateQrCode = async (req, res) => {
  const cartTotal = Number(req.body.cartTotal || 0);

  try {
    if (!cartTotal || cartTotal <= 0) {
      return res.render("netsQrFail", {
        title: "Payment Error",
        responseCode: "N.A.",
        instructions: "",
        errorMsg: "Cart total is invalid.",
        user: req.session.user,
      });
    }

    const requestBody = {
      txn_id: "sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b", // sandbox default
      amt_in_dollars: cartTotal,
      notify_mobile: 0,
    };

    const response = await axios.post(
      "https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/request",
      requestBody,
      {
        headers: {
          "api-key": process.env.API_KEY,
          "project-id": process.env.PROJECT_ID,
        },
      }
    );

    const qrData = response?.data?.result?.data;
    if (!qrData) {
      return res.render("netsQrFail", {
        title: "Payment Error",
        responseCode: "N.A.",
        instructions: "",
        errorMsg: "NETS returned an invalid response.",
        user: req.session.user,
      });
    }

    const txnRetrievalRef = qrData.txn_retrieval_ref;
    const courseInitId = getCourseInitIdParam();

    // You can keep this if your teacher demo expects it
    const webhookUrl =
      `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets/webhook` +
      `?txn_retrieval_ref=${encodeURIComponent(txnRetrievalRef || "")}` +
      `&course_init_id=${encodeURIComponent(courseInitId)}`;

    // ✅ Accept if response_code is "00" and qr_code exists (txn may still be pending)
    const ok = qrData.response_code === "00" && !!qrData.qr_code;

    if (ok) {
      return res.render("netsQr", {
        title: "Scan to Pay",
        total: cartTotal.toFixed(2),
        qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
        txnRetrievalRef,
        courseInitId,
        webhookUrl,
        timer: 300,
        user: req.session.user, // ✅ FIX: user exists now
      });
    }

    // Otherwise render fail details
    return res.render("netsQrFail", {
      title: "NETS QR Error",
      responseCode: qrData.response_code || "N.A.",
      instructions: qrData.instruction || "",
      errorMsg:
        qrData.error_message ||
        "An error occurred while generating the QR code. Please try again.",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Error in generateQrCode:", error?.message);
    return res.render("netsQrFail", {
      title: "Payment Error",
      responseCode: "ERROR",
      instructions: "",
      errorMsg:
        `API Error: ${error.message}. ` +
        `Check NETS credentials in .env (API_KEY, PROJECT_ID).`,
      user: req.session.user,
    });
  }
};

exports.getPaymentStatus = async (txnRetrievalRef) => {
  try {
    const requestBody = { txn_retrieval_ref: txnRetrievalRef };

    const response = await axios.post(
      "https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets/query",
      requestBody,
      {
        headers: {
          "api-key": process.env.API_KEY,
          "project-id": process.env.PROJECT_ID,
        },
      }
    );

    const data = response?.data?.result?.data || {};
    const txnStatus = Number(data.txn_status);

    return {
      txn_retrieval_ref: txnRetrievalRef,
      txn_status: txnStatus,          // often 0=pending, 1=success, 2=failed (depends on sandbox)
      response_code: data.response_code,
      paid: txnStatus === 1,
      failed: txnStatus === 2,
      raw: data,
    };
  } catch (error) {
    return {
      txn_retrieval_ref: txnRetrievalRef,
      paid: false,
      failed: false,
      error: error.message,
    };
  }
};

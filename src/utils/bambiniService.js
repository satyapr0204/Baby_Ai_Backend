const axios = require("axios");
const xmlbuilder = require("xmlbuilder");

const createBambiniOrder = async (orderData) => {
  try {
    const key = process.env.BAMBINI_API_KEY;
    const email = process.env.BAMBINI_API_EMAIL;

    const addressObj = {
      address: {
        firstname: orderData.shipping_address.firstname || "John",
        lastname: orderData.shipping_address.lastname || "Doe",
        company: orderData.shipping_address.company || "",
        alias: "home",
        address1: orderData.shipping_address.address1,
        address2: orderData.shipping_address.address2 || "",
        city: orderData.shipping_address.city,
        id_state: orderData.shipping_address.state, 
        postcode: orderData.shipping_address.postcode,
        id_country: orderData.shipping_address.country || "US",
      },
    };
    const addressXml = xmlbuilder.create(addressObj).end({ pretty: false });

    const cartObj = {
      cart: {
        cart_rows: {
          cart_row: orderData.items.map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
          })),
        },
        coupon_rows: {
          coupon_row: (orderData.coupons || []).map((cp) => ({
            coupon: cp,
          })),
        },
      },
    };
    const cartXml = xmlbuilder.create(cartObj).end({ pretty: false });

    const auth = Buffer.from(`${email}:${key}`).toString("base64");

    const params = new URLSearchParams();
    params.append("address", addressXml);
    params.append("cart", cartXml);

    const response = await axios.post(
      "https://www.bambinilayette.com/webservices/order.php",
      params,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const result = response.data;

    if (result.errors && result.errors.length > 0) {
      return { status: false, errors: result.errors };
    } else if (result.refnumber) {
      return { status: true, order_id: result.refnumber };
    }

    return {
      status: false,
      message: "Unknown response from Bambini",
      raw: result,
    };
  } catch (error) {
    console.error(
      "Bambini API Error:",
      error.response ? error.response.data : error.message,
    );
    return { status: false, message: error.message };
  }
};

const trackBambiniOrder = async (orderNumbers) => {
  try {
    const key = process.env.BAMBINI_API_KEY;
    const email = process.env.BAMBINI_API_EMAIL;

    const auth = Buffer.from(`${email}:${key}`).toString("base64");

    const params = new URLSearchParams();
    params.append("orders", orderNumbers);

    const response = await axios.post(
      "https://www.bambinilayette.com/webservices/ordertracking.php",
      params,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const result = response.data;

    if (result.errors && result.errors.length > 0) {
      return {
        status: false,
        errors: result.errors,
        http_code: response.status,
      };
    }

    if (result.ordersresult) {
      return {
        status: true,
        data: result.ordersresult,
      };
    }

    return {
      status: false,
      message: "Unknown response",
      response: result,
    };
  } catch (error) {
    console.error("Bambini Tracking Error:", error.message);
    return {
      status: false,
      message: error.message,
    };
  }
};

module.exports = { createBambiniOrder, trackBambiniOrder };

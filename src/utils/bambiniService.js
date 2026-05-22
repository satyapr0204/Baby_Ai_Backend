// const axios = require("axios");
// const xmlbuilder = require("xmlbuilder");

// const createBambiniOrder = async (orderData) => {
//   try {
//     const key = process.env.BAMBINI_API_KEY;
//     const email = process.env.BAMBINI_API_EMAIL;

//     const addressObj = {
//       address: {
//         firstname: orderData.shipping_address.firstname || "John",
//         lastname: orderData.shipping_address.lastname || "Doe",
//         company: orderData.shipping_address.company || "",
//         alias: orderData.shipping_address.address_type,
//         address1: orderData.shipping_address.apartment,
//         address2: orderData.shipping_address.street_address || "",
//         city: orderData.shipping_address.city,
//         id_state: orderData.shipping_address.state_id,
//         postcode: orderData.shipping_address.post_code,
//         id_country: orderData.shipping_address.country_id || "US",
//       },
//     };
//     const addressXml = xmlbuilder.create(addressObj).end({ pretty: false });

//     const cartObj = {
//       cart: {
//         cart_rows: {
//           cart_row: orderData.items.map((item) => ({
//             sku: item.sku,
//             quantity: item.quantity,
//           })),
//         },
//         coupon_rows: {
//           coupon_row: (orderData.coupons || []).map((cp) => ({
//             coupon: cp,
//           })),
//         },
//       },
//     };
//     const cartXml = xmlbuilder.create(cartObj).end({ pretty: false });

//     const auth = Buffer.from(`${email}:${key}`).toString("base64");

//     const params = new URLSearchParams();
//     params.append("address", addressXml);
//     params.append("cart", cartXml);

//     const response = await axios.post(
//       "https://www.bambinilayette.com/webservices/order.php",
//       params,
//       {
//         headers: {
//           Authorization: `Basic ${auth}`,
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       },
//     );

//     const result = response.data;

//     if (result.errors && result.errors.length > 0) {
//       return { status: false, errors: result.errors };
//     } else if (result.refnumber) {
//       return { status: true, order_id: result.refnumber };
//     }

//     return {
//       status: false,
//       message: "Unknown response from Bambini",
//       raw: result,
//     };
//   } catch (error) {
//     console.error(
//       "Bambini API Error:",
//       error.response ? error.response.data : error.message,
//     );
//     return { status: false, message: error.message };
//   }
// };

// const trackBambiniOrder = async (orderNumbers) => {
//   try {
//     const key = process.env.BAMBINI_API_KEY;
//     const email = process.env.BAMBINI_API_EMAIL;

//     const auth = Buffer.from(`${email}:${key}`).toString("base64");

//     const params = new URLSearchParams();
//     params.append("orders", orderNumbers);

//     const response = await axios.post(
//       "https://www.bambinilayette.com/webservices/ordertracking.php",
//       params,
//       {
//         headers: {
//           Authorization: `Basic ${auth}`,
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       },
//     );

//     const result = response.data;

//     if (result.errors && result.errors.length > 0) {
//       return {
//         status: false,
//         errors: result.errors,
//         http_code: response.status,
//       };
//     }

//     if (result.ordersresult) {
//       return {
//         status: true,
//         data: result.ordersresult,
//       };
//     }

//     return {
//       status: false,
//       message: "Unknown response",
//       response: result,
//     };
//   } catch (error) {
//     console.error("Bambini Tracking Error:", error.message);
//     return {
//       status: false,
//       message: error.message,
//     };
//   }
// };

// module.exports = { createBambiniOrder, trackBambiniOrder };

const fetch = require("node-fetch");
const xml2js = require("xml2js");
const Order = require("../modals/orderModal");
const Address = require("../modals/addressModal");

function buildXml(rootName, data) {
  const builder = new xml2js.Builder({
    rootName: rootName,
    renderOpts: { pretty: false },
    headless: true,
  });
  return builder.buildObject(data);
}

const createOrder = async (orderId, userData) => {
  const orderData = await Order.findOne({
    where: {
      id: orderId,
      user_id: userData.id,
    },
    include: [
      {
        model: Address,
        as: "order_address",
        attributes: { exclude: ["createdAt", "updatedAt"] },
      },
    ],
  });
  
  const key = "45GLHF538F5VIXEZ";
  const email = "jayfisher901@gmail.com";

  const addressData = {
    firstname: userData.name || "John",
    lastname: "",
    company: "Baby Ai",
    alias: orderData.order_address.address_type || "home",
    address1: orderData.order_address.apartment || "123 Main Street",
    address2: orderData.order_address.street_address || "Apt 4B",
    city: orderData.order_address.city || "New York",
    id_state: orderData.order_address.state_id || "NY",
    postcode: orderData.order_address.post_code || "10001",
    id_country: orderData.order_address.country_id || "US",
  };
  const addressXml = buildXml("address", addressData);

  const cartData = {
    cart_rows: {
      cart_row: [{ sku: "Test_Item", quantity: 5 }],
    },
    coupon_rows: {
      coupon_row: [{ coupon: "TESTIE27" }],
    },
  };
  const cartXml = buildXml("cart", cartData);

  const authHeader =
    "Basic " + Buffer.from(`${email}:${key}`).toString("base64");

  const formData = new URLSearchParams();
  formData.append("address", addressXml);
  formData.append("cart", cartXml);

  try {
    const response = await fetch(
      "https://www.bambinilayette.com/webservices/order.php",
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      },
    );

    const httpcode = response.status;
    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return {
        status: false,
        message: "Invalid JSON response",
        raw: responseText,
      };
    }

    if (result.errors && result.errors.length > 0) {
      return {
        status: false,
        errors: result.errors,
        http_code: httpcode,
      };
    } else if (result.refnumber) {
      return {
        status: true,
        order_id: result.refnumber,
        http_code: httpcode,
      };
    }

    return {
      status: false,
      message: "Unknown response",
      raw: result,
    };
  } catch (error) {
    return { status: false, message: error.message };
  }
};

const trackOrder = async () => {
  const key = "45GLHF538F5VIXEZ";
  const email = "jayfisher901@gmail.com";
  const orders = "Bam33746";

  const authHeader =
    "Basic " + Buffer.from(`${email}:${key}`).toString("base64");

  const formData = new URLSearchParams();
  formData.append("orders", orders);

  try {
    const response = await fetch(
      "https://www.bambinilayette.com/webservices/ordertracking.php",
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      },
    );

    const httpcode = response.status;
    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return {
        status: false,
        message: "Invalid JSON response",
        raw: responseText,
      };
    }

    if (result.errors && result.errors.length > 0) {
      return {
        status: false,
        errors: result.errors,
        http_code: httpcode,
      };
    }

    if (result.ordersresult) {
      return {
        status: true,
        data: result.ordersresult,
        http_code: httpcode,
      };
    }

    return {
      status: false,
      message: "Unknown response",
      response: result,
    };
  } catch (error) {
    return { status: false, message: error.message };
  }
};

module.exports = { createOrder, trackOrder };

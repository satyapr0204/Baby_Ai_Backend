const formatFullAddress = (addressData) => {
  if (!addressData) return "Address not found";

  const {
    address_type,
    street_address,
    apartment,
    city,
    state,
    country_id,
    post_code,
  } = addressData;

  const mainAddress = [
    street_address,
    apartment,
    city,
    state,
    country_id,
  ].filter((val) => val && val !== "null" && val !== "");

  let fullAddress = mainAddress.join(", ");

  if (post_code && post_code !== "null") {
    fullAddress += ` - ${post_code}`;
  }
  const finalOutput = address_type
    ? `[${address_type}] ${fullAddress}`
    : fullAddress;

  return finalOutput;
};

module.exports = { formatFullAddress };

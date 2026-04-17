/**
 * @param {number} cost
 * @param {number} addonPct
 * @param {number} discountPct
 */
const calculateSafeMargin =  (cost, addonPct, discountPct) => {
  const safeCost = parseFloat(cost) || 0;
  if (safeCost <= 0) {
    return {
      error: "Invalid Cost",
      sellingPrice: 0,
      marginAmt: 0,
      marginPct: 0,
    };
  }

  // Case 2: Addon Calculation
  const addonAmount = safeCost * (addonPct / 100);
  const markedPrice = safeCost + addonAmount;

  // Case 3: Discount Calculation
  const discountAmount = markedPrice * (discountPct / 100);
  const sellingPrice = markedPrice - discountAmount;

  // Case 4: Margin Calculation
  const marginAmt = sellingPrice - safeCost;

  // Margin Percentage (on Selling Price)
  const marginPct = sellingPrice > 0 ? (marginAmt / sellingPrice) * 100 : 0;

  // Case 5: Loss Prevention Alert
  let status = "Profit";
  if (marginAmt < 0) {
    status = "Loss";
  } else if (marginAmt === 0) {
    status = "Break-Even (No Profit No Loss)";
  }

  return {
    originalCost: safeCost.toFixed(2),
    markedPrice: markedPrice.toFixed(2),
    sellingPrice: sellingPrice.toFixed(2),
    marginAmt: marginAmt.toFixed(2),
    marginPct: marginPct.toFixed(2),
    status: status,
  };
};

module.exports = { calculateSafeMargin };

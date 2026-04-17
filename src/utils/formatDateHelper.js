// const formatDate = (dateStr) => {
//   if (!dateStr) return null;
//   if (dateStr.includes("/")) {
//     const [day, month, year] = dateStr.split("/");
//     return new Date(`${year}-${month}-${day}`); // YYYY-MM-DD format
//   }
//   return new Date(dateStr);
// };

// module.exports = { formatDate };

const formatDate = (dateStr) => {
  if (!dateStr) return null;

  // 1. Agar date pehle se hi ISO format (YYYY-MM-DD) mein hai to direct return
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return new Date(dateStr);
  }

  // 2. Separators (/ ya -) ke base par date ko todna
  const parts = dateStr.split(/[-/]/);
  if (parts.length !== 3) return new Date(dateStr); // Fallback to default

  let day, month, year;

  // 3. Logic: Kaunsa part Year hai aur kaunsa Day?
  if (parts[0].length === 4) {
    // Format: YYYY/MM/DD
    [year, month, day] = parts;
  } else if (parts[2].length === 4) {
    // Format: DD/MM/YYYY ya MM/DD/YYYY
    // Hum Indian format (DD/MM/YYYY) ko priority de rahe hain
    [day, month, year] = parts;
  }

  // ISO Format (YYYY-MM-DD) string banakar Date object return karna
  // Month - 1 isliye kyunki JS mein months 0-11 hote hain
  const finalDate = new Date(year, month - 1, day);

  // Check agar date valid bani hai
  return isNaN(finalDate.getTime()) ? null : finalDate;
};

module.exports = { formatDate };

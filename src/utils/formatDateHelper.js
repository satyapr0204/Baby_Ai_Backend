const formatDate = (dateStr) => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return new Date(dateStr);
  }
  const parts = dateStr.split(/[-/]/);
  if (parts.length !== 3) return new Date(dateStr); 

  let day, month, year;
  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else if (parts[2].length === 4) {
    [day, month, year] = parts;
  }
  const finalDate = new Date(year, month - 1, day);

  return isNaN(finalDate.getTime()) ? null : finalDate;
};

module.exports = { formatDate };

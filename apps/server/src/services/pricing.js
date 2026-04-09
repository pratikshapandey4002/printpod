const PRICES = {
  bw: {
    'one-sided': parseFloat(process.env.PRICE_BW_SINGLE) || 2.0,
    'two-sided-long-edge': parseFloat(process.env.PRICE_BW_DOUBLE) || 3.0,
  },
  color: {
    'one-sided': parseFloat(process.env.PRICE_COLOR_SINGLE) || 8.0,
    'two-sided-long-edge': parseFloat(process.env.PRICE_COLOR_DOUBLE) || 12.0,
  },
};

function calculatePrice({ pageCount, copies = 1, color = 'mono', sides = 'one-sided' }) {
  const colorKey = color === 'color' ? 'color' : 'bw';
  const pricePerPage = PRICES[colorKey][sides] || PRICES.bw['one-sided'];
  const totalPages = pageCount * copies;
  const totalAmount = parseFloat((totalPages * pricePerPage).toFixed(2));
  return { pricePerPage, totalAmount };
}

function getPriceList() {
  return {
    mono: {
      singleSided: PRICES.bw['one-sided'],
      doubleSided: PRICES.bw['two-sided-long-edge'],
    },
    color: {
      singleSided: PRICES.color['one-sided'],
      doubleSided: PRICES.color['two-sided-long-edge'],
    },
  };
}

module.exports = { calculatePrice, getPriceList };

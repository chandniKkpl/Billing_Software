export function calcSaleTotals(cart, billDiscount = { type: 'none', value: 0, freight: '', labor: '' }, roundOff = '') {
  let subtotal = 0;
  let gst = 0;

  cart.forEach((c) => {
    const qty = Number(c.qty) || 0;
    const price = Number(c.sellingPrice) || 0;
    const itemGstPct = Number(c.gst) || 0;
    subtotal += price * qty;
    gst += (price * qty) * (itemGstPct / 100);
  });

  let discount = 0;
  const val = Number(billDiscount.value) || 0;
  if (billDiscount.type === 'percent') {
    discount = (subtotal + gst) * (val / 100);
  } else if (billDiscount.type === 'flat') {
    discount = val;
  }

  const freight = Number(billDiscount.freight) || 0;
  const labor = Number(billDiscount.labor) || 0;
  let grandTotal = Math.max(0, subtotal + gst - discount) + freight + labor;

  let actualRoundOff = 0;
  if (String(roundOff || '').trim() !== '') {
    const finalGrandTotal = Number(roundOff) || 0;
    actualRoundOff = finalGrandTotal - grandTotal;
    grandTotal = finalGrandTotal;
  }

  return { subtotal, gst, grandTotal, discount, freight, labor, roundOff: actualRoundOff };
}

export function getSaleBankInfo(paymentMode, bankDetails = {}) {
  if (['RTGS', 'NEFT'].includes(paymentMode)) {
    if (!bankDetails.utr || !bankDetails.date) {
      throw new Error(`Please enter UTR Number and Date for ${paymentMode}`);
    }
    return `UTR: ${bankDetails.utr} | Date: ${bankDetails.date}`;
  }

  if (paymentMode === 'Cheque') {
    if (!bankDetails.chequeNo || !bankDetails.bankName || !bankDetails.date) {
      throw new Error('Please enter Cheque Number, Bank Name, and Date');
    }
    return `Chq: ${bankDetails.chequeNo} | Bank: ${bankDetails.bankName} | Date: ${bankDetails.date}`;
  }

  return '';
}

export function getNextBillNumber(sales = [], editingSaleId = null) {
  const maxBillNo = Math.max(0, ...sales.map((s) => Number(s.billNo) || 0));

  if (editingSaleId) {
    return sales.find((s) => s.id === editingSaleId)?.billNo || (maxBillNo > 0 ? maxBillNo + 1 : 1001);
  }

  return maxBillNo > 0 ? maxBillNo + 1 : 1001;
}

export function buildSalePayload({
  state,
  cart,
  paymentMode = 'Cash',
  bankDetails = {},
  cashPaid = '',
  dueDate = '',
  selectedCustomerId = '',
  warehouseId = 'main',
  billDiscount = { type: 'none', value: 0, freight: '', labor: '' },
  roundOff = '',
  editingSaleId = null,
}) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Cart is empty');
  }

  if (paymentMode === 'Debt' && !selectedCustomerId) {
    throw new Error('Please select a customer for Debt');
  }

  const existingSale = editingSaleId ? state.sales.find((s) => s.id === editingSaleId) : null;
  const saleId = existingSale ? existingSale.id : Date.now().toString();
  const saleDate = existingSale ? existingSale.date : new Date().toISOString();
  const finalBankInfo = getSaleBankInfo(paymentMode, bankDetails);
  const selectedCustObj = selectedCustomerId
    ? (state.customers || []).find((c) => String(c.id) === String(selectedCustomerId))
    : null;
  const nextBillNo = getNextBillNumber(state.sales || [], editingSaleId);
  const { subtotal, gst, grandTotal, discount, freight, labor, roundOff: actualRoundOff } = calcSaleTotals(cart, billDiscount, roundOff);

  return {
    id: saleId,
    billNo: nextBillNo,
    date: saleDate,
    items: cart,
    subtotal,
    gst,
    grandTotal,
    discount,
    freight,
    labor,
    roundOff: actualRoundOff,
    billDiscount,
    paymentMode,
    bankInfo: finalBankInfo,
    dueDate: paymentMode === 'Debt' ? dueDate || null : null,
    customerId: selectedCustomerId || null,
    customerName: selectedCustObj?.name || null,
    customerPhone: selectedCustObj?.phone || null,
    customerGst: selectedCustObj?.gst || selectedCustObj?.gstNo || null,
    customerPan: selectedCustObj?.pan || null,
    cashPaid: paymentMode === 'Cash'
      ? (parseFloat(cashPaid) || grandTotal)
      : (paymentMode === 'Debt' ? (parseFloat(cashPaid) || 0) : grandTotal),
    warehouseId,
  };
}

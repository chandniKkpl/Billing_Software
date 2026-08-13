import { buildSalePayload } from '../sales';
import { logAssistantAudit } from './audit';
import { generateAssistantText, getAiSetupMessage, isAiConfigError } from './geminiClient';

const LOW_STOCK_LIMIT = 5;

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return normalizeText(value).split(' ').filter(Boolean);
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Assistant returned invalid JSON');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function scoreNameMatch(candidate, query) {
  const candidateText = normalizeText(candidate);
  const queryText = normalizeText(query);
  if (!candidateText || !queryText) return 0;
  if (candidateText === queryText) return 100;
  if (candidateText.startsWith(queryText)) return 90;
  if (candidateText.includes(queryText)) return 80;

  const candidateTokens = tokens(candidateText);
  const queryTokens = tokens(queryText);
  let score = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.includes(token)) score += 15;
    else if (candidateText.includes(token)) score += 8;
  });
  return score;
}

function findBestMatch(items, query, fields = ['name']) {
  if (!query) return null;
  const scored = items
    .map((item) => {
      const score = Math.max(...fields.map((field) => scoreNameMatch(item[field], query)));
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score >= 20 ? scored[0].item : null;
}

function getTodayDateString() {
  return new Date().toDateString();
}

function resolveProduct(state, productName) {
  return findBestMatch(state.products || [], productName, ['name', 'brand', 'barcode']);
}

function resolveCustomer(state, customerName) {
  return findBestMatch(state.customers || [], customerName, ['name', 'phone']);
}

function getLowStockProducts(state, maxQuantity = LOW_STOCK_LIMIT) {
  return (state.products || []).filter(
    (product) => product.itemType !== 'Service' && (product.stock || 0) <= maxQuantity
  );
}

function buildWhatsappMessage(customer, amount = customer.udhaarBalance) {
  const dueDateStr = customer.dueDate ? ` by ${customer.dueDate}` : ' at your earliest convenience';
  return `Hello ${customer.name}, this is a gentle reminder that your pending dues are ₹${Number(amount || 0).toFixed(2)}. Please settle the amount${dueDateStr}. Thank you! - Cosmo Store`;
}

function openWhatsappWindow(customer, message) {
  const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
  const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function createCartItemsFromRequest(state, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('I could not find any bill items in your request.');
  }

  return items.map((requestedItem) => {
    const product = resolveProduct(state, requestedItem.name);
    if (!product) {
      throw new Error(`I couldn't find the product "${requestedItem.name}".`);
    }

    const qty = Number(requestedItem.qty) || 0;
    if (qty <= 0) {
      throw new Error(`Please provide a valid quantity for ${product.name}.`);
    }

    if ((product.stock || 0) < qty) {
      throw new Error(`${product.name} has only ${product.stock || 0} units available.`);
    }

    return {
      ...product,
      qty,
      discount: 0,
      sellingPrice: requestedItem.sellingPrice ? Number(requestedItem.sellingPrice) : Number(product.sellingPrice) || 0,
    };
  });
}

function fallbackInterpretation(command, state) {
  const text = normalizeText(command);

  if (text.includes('today sale') || text.includes('todays sale') || text.includes('aaj ki sale') || text.includes('aaj ki total sale') || text.includes('sale kitni') || text.includes('sale batao')) {
    return { intent: 'get_today_sales', confirmationRequired: false, parameters: {} };
  }

  if (text.includes('low stock') || text.includes('stock kam') || text.includes('kam hai') || text.includes('stock dikhao')) {
    return { intent: 'get_low_stock', confirmationRequired: false, parameters: { maxQuantity: LOW_STOCK_LIMIT } };
  }

  if (text.includes('balance') || text.includes('udhaar') || text.includes('batao') || text.includes('kitna hai')) {
    const customer = findBestMatch(state.customers || [], command, ['name']);
    if (customer) {
      return {
        intent: 'get_customer_balance',
        confirmationRequired: false,
        parameters: { customerName: customer.name },
      };
    }
  }

  if (text.includes('stock') || text.includes('left') || text.includes('search product') || text.includes('find product')) {
    const product = findBestMatch(state.products || [], command, ['name', 'brand']);
    if (product) {
      return {
        intent: 'search_product',
        confirmationRequired: false,
        parameters: { productName: product.name },
      };
    }
  }

  return {
    intent: 'unknown',
    confirmationRequired: false,
    parameters: {},
    missingFields: [],
    naturalAction: '',
  };
}

async function interpretCommand(command, state) {
  const lightweightContext = {
    productNames: (state.products || []).slice(0, 120).map((product) => product.name),
    customerNames: (state.customers || []).slice(0, 120).map((customer) => customer.name),
    supportedIntents: [
      'search_product',
      'create_product',
      'update_product_stock',
      'search_customer',
      'create_customer',
      'get_customer_balance',
      'get_today_sales',
      'get_low_stock',
      'create_bill',
      'search_bill',
      'generate_whatsapp_reminder',
    ],
  };

  const prompt = `You are WinTogether AI for a billing and inventory web application. Interpret the user's command and return ONLY valid JSON.

Rules:
- Support English, Hindi, and Hinglish.
- This assistant controls business software, not general chat.
- Never invent business data.
- For create/update/delete/financial/external actions, set confirmationRequired to true.
- For read-only actions, set confirmationRequired to false.
- If details are missing, include them in missingFields.
- If command is unclear, use intent "unknown".
- For bill creation, return parameters.items as [{"name":"Product Name","qty":number}].
- For product stock update, use intent "update_product_stock" and include productName and quantity.
- For WhatsApp payment reminders, use intent "generate_whatsapp_reminder".
- For search bill commands, if a bill number is given include billNo. If the user asks for a customer's last bill, include customerName and searchMode "last_for_customer".

Context:\n${JSON.stringify(lightweightContext)}

Return this schema exactly:
{
  "intent": "string",
  "confirmationRequired": true,
  "naturalAction": "short business action summary",
  "parameters": {},
  "missingFields": []
}

User command: ${JSON.stringify(command)}`;

  try {
    const text = await generateAssistantText(prompt);
    return extractJsonObject(text);
  } catch (error) {
    console.error('Assistant interpretation failed, falling back to heuristics', error);

    const fallback = fallbackInterpretation(command, state);
    if (fallback.intent !== 'unknown') {
      return fallback;
    }

    if (isAiConfigError(error)) {
      return {
        intent: 'ai_unavailable',
        confirmationRequired: false,
        parameters: {},
        missingFields: [],
        setupMessage: getAiSetupMessage(),
      };
    }

    return fallback;
  }
}

async function executeSearchProduct({ state, parameters }) {
  const product = resolveProduct(state, parameters.productName);
  if (!product) {
    throw new Error("I couldn't find that product.");
  }

  return {
    responseText: `${product.name} is available with ${product.stock || 0} units in stock. Selling price is ${formatCurrency(product.sellingPrice)}.`,
    action: 'search_product',
    entity: product.name,
    result: product,
  };
}

async function executeCreateProduct({ state, app, parameters }) {
  const name = String(parameters.productName || parameters.name || '').trim();
  const existingProduct = resolveProduct(state, name);

  if (existingProduct && parameters.quantity && !parameters.sellingPrice && !parameters.purchasePrice && !parameters.mrp) {
    const warehouseStock = { ...(existingProduct.warehouseStock || {}) };
    if (Object.keys(warehouseStock).length === 0 && (existingProduct.stock || 0) > 0) {
      warehouseStock.main = existingProduct.stock;
    }
    warehouseStock.main = (warehouseStock.main || 0) + Number(parameters.quantity);
    const newStock = Object.values(warehouseStock).reduce((sum, value) => sum + value, 0);
    const updatedProduct = { ...existingProduct, warehouseStock, stock: newStock };
    await app.updateProduct(updatedProduct);
    return {
      responseText: `Done. ${existingProduct.name} stock is now ${newStock}.`,
      action: 'update_product_stock',
      entity: existingProduct.name,
      result: updatedProduct,
    };
  }

  if (!name) {
    throw new Error('I did not understand which product you want to add.');
  }

  if (parameters.sellingPrice === undefined || parameters.sellingPrice === null || parameters.sellingPrice === '') {
    return {
      incomplete: true,
      responseText: 'What is the selling price?',
      action: 'create_product',
      entity: name,
    };
  }

  const quantity = Number(parameters.quantity || parameters.stock || 0);
  const warehouseStock = quantity > 0 ? { main: quantity } : {};
  const product = {
    id: Date.now().toString(),
    name,
    barcode: parameters.barcode || '',
    itemType: 'Goods',
    category: parameters.category || 'Hardware',
    brand: parameters.brand || '',
    purchasedFrom: parameters.purchasedFrom || '',
    purchasePrice: Number(parameters.purchasePrice || 0),
    sellingPrice: Number(parameters.sellingPrice || 0),
    mrp: Number(parameters.mrp || parameters.sellingPrice || 0),
    stock: quantity,
    gst: Number(parameters.gst ?? 18),
    godown: 'main',
    warehouseStock,
  };

  await app.addProduct(product);
  return {
    responseText: `Done. ${product.name} has been added${quantity ? ` with ${quantity} units` : ''}.`,
    action: 'create_product',
    entity: product.name,
    result: product,
  };
}

async function executeUpdateProductStock({ state, app, parameters }) {
  const product = resolveProduct(state, parameters.productName);
  if (!product) {
    throw new Error("I couldn't find that product.");
  }

  const quantity = Number(parameters.quantity);
  if (Number.isNaN(quantity) || quantity < 0) {
    throw new Error('Please provide a valid stock quantity.');
  }

  const targetWarehouse = parameters.warehouseId || 'main';
  const warehouseStock = { ...(product.warehouseStock || {}) };
  if (Object.keys(warehouseStock).length === 0 && (product.stock || 0) > 0) {
    warehouseStock.main = product.stock;
  }
  warehouseStock[targetWarehouse] = quantity;
  const newStock = Object.values(warehouseStock).reduce((sum, value) => sum + Number(value || 0), 0);

  const updatedProduct = { ...product, warehouseStock, stock: newStock };
  await app.updateProduct(updatedProduct);

  return {
    responseText: `${product.name} quantity has been updated to ${quantity}${targetWarehouse !== 'main' ? ` in ${targetWarehouse}` : ''}.`,
    action: 'update_product_stock',
    entity: product.name,
    result: updatedProduct,
  };
}

async function executeSearchCustomer({ state, parameters }) {
  const customer = resolveCustomer(state, parameters.customerName);
  if (!customer) {
    throw new Error("I couldn't find that customer.");
  }

  return {
    responseText: `${customer.name} was found${customer.phone ? ` with phone ${customer.phone}` : ''}. Current pending balance is ${formatCurrency(customer.udhaarBalance)}.`,
    action: 'search_customer',
    entity: customer.name,
    result: customer,
  };
}

async function executeCreateCustomer({ app, parameters }) {
  const name = String(parameters.customerName || parameters.name || '').trim();
  const phone = String(parameters.phone || '').trim();

  if (!name) {
    throw new Error('I did not understand which customer you want to add.');
  }

  if (!phone) {
    return {
      incomplete: true,
      responseText: 'What is the phone number?',
      action: 'create_customer',
      entity: name,
    };
  }

  const customer = {
    id: Date.now().toString(),
    name,
    phone,
    type: parameters.type || 'new',
    membershipTier: parameters.membershipTier || 'None',
    udhaarBalance: Number(parameters.udhaarBalance || 0),
    dueDate: parameters.dueDate || '',
    pan: parameters.pan || '',
    gst: parameters.gst || '',
  };

  await app.addCustomer(customer);
  return {
    responseText: `Done. ${customer.name} has been added.`,
    action: 'create_customer',
    entity: customer.name,
    result: customer,
  };
}

async function executeCustomerBalance({ state, parameters }) {
  const customer = resolveCustomer(state, parameters.customerName);
  if (!customer) {
    throw new Error("I couldn't find that customer.");
  }

  return {
    responseText: `${customer.name} ka ${formatCurrency(customer.udhaarBalance)} pending hai.`,
    action: 'get_customer_balance',
    entity: customer.name,
    result: { balance: customer.udhaarBalance, customer },
  };
}

async function executeTodaySales({ state }) {
  const todaySales = (state.sales || []).filter((sale) => new Date(sale.date).toDateString() === getTodayDateString());
  const total = todaySales.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0);

  return {
    responseText: `Aaj ki total sale ${formatCurrency(total)} hai across ${todaySales.length} bills.`,
    action: 'get_today_sales',
    entity: 'sales',
    result: { total, count: todaySales.length, sales: todaySales },
  };
}

async function executeLowStock({ state, parameters }) {
  const maxQuantity = Number(parameters.maxQuantity || LOW_STOCK_LIMIT);
  const products = getLowStockProducts(state, maxQuantity);

  if (products.length === 0) {
    return {
      responseText: 'All products are well stocked right now.',
      action: 'get_low_stock',
      entity: 'inventory',
      result: [],
    };
  }

  const preview = products
    .slice(0, 5)
    .map((product) => `${product.name} (${product.stock || 0})`)
    .join(', ');

  return {
    responseText: `${products.length} products low stock mein hain. ${preview}.`,
    action: 'get_low_stock',
    entity: 'inventory',
    result: products,
  };
}

async function executeSearchBill({ state, parameters }) {
  let sale = null;

  if (parameters.billNo !== undefined && parameters.billNo !== null && parameters.billNo !== '') {
    sale = (state.sales || []).find((entry) => String(entry.billNo) === String(parameters.billNo));
  } else if (parameters.searchMode === 'last_for_customer' || parameters.customerName) {
    const customer = resolveCustomer(state, parameters.customerName);
    if (!customer) {
      throw new Error("I couldn't find that customer.");
    }
    sale = (state.sales || [])
      .filter((entry) => String(entry.customerId) === String(customer.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
  }

  if (!sale) {
    throw new Error("I couldn't find that bill.");
  }

  return {
    responseText: `Bill #${sale.billNo} was found for ${sale.customerName || 'walk-in customer'} with total ${formatCurrency(sale.grandTotal)} paid by ${sale.paymentMode}.`,
    action: 'search_bill',
    entity: `bill-${sale.billNo}`,
    result: sale,
  };
}

async function executeCreateBill({ state, app, parameters }) {
  const paymentMode = parameters.paymentMode || 'Cash';
  const customer = parameters.customerName ? resolveCustomer(state, parameters.customerName) : null;
  if (parameters.customerName && !customer) {
    throw new Error("I couldn't find that customer.");
  }

  const cart = createCartItemsFromRequest(state, parameters.items || []);
  const billDiscount = {
    type: parameters.discountType || (parameters.discountPercent ? 'percent' : parameters.discountAmount ? 'flat' : 'none'),
    value: parameters.discountPercent || parameters.discountAmount || 0,
    freight: parameters.freight || '',
    labor: parameters.labor || '',
  };

  const sale = buildSalePayload({
    state,
    cart,
    paymentMode,
    bankDetails: parameters.bankDetails || {},
    cashPaid: parameters.cashPaid || '',
    dueDate: parameters.dueDate || '',
    selectedCustomerId: customer?.id || '',
    warehouseId: parameters.warehouseId || 'main',
    billDiscount,
    roundOff: parameters.roundOff || '',
    editingSaleId: null,
  });

  await app.completeSale(sale);

  return {
    responseText: `Done. Bill #${sale.billNo} has been created for ${sale.customerName || 'walk-in customer'} with total ${formatCurrency(sale.grandTotal)}.`,
    action: 'create_bill',
    entity: `bill-${sale.billNo}`,
    result: sale,
  };
}

async function executeWhatsappReminder({ state, app, parameters }) {
  const customer = resolveCustomer(state, parameters.customerName);
  if (!customer) {
    throw new Error("I couldn't find that customer.");
  }
  if (!customer.phone) {
    throw new Error(`${customer.name} does not have a phone number saved.`);
  }
  if (!(Number(customer.udhaarBalance) > 0)) {
    throw new Error(`${customer.name} does not have any outstanding balance.`);
  }

  const amount = Number(parameters.amount || customer.udhaarBalance);
  const message = buildWhatsappMessage(customer, amount);
  openWhatsappWindow(customer, message);
  await app.updateCustomer({ ...customer, lastReminderSentAt: new Date().toISOString().split('T')[0] });

  return {
    responseText: `WhatsApp payment reminder sent to ${customer.name}.`,
    action: 'send_whatsapp_message',
    entity: customer.name,
    result: { customer, amount, message },
  };
}

function buildConfirmationText(interpreted) {
  const parameters = interpreted.parameters || {};
  switch (interpreted.intent) {
    case 'create_product':
      return `Add product ${parameters.productName || parameters.name || 'this product'}${parameters.quantity ? ` with quantity ${parameters.quantity}` : ''}. Do you want me to continue?`;
    case 'update_product_stock':
      return `Update ${parameters.productName || 'this product'} quantity to ${parameters.quantity}. Do you want me to continue?`;
    case 'create_customer':
      return `Add customer ${parameters.customerName || parameters.name || 'this customer'}. Do you want me to continue?`;
    case 'create_bill':
      return `Create a bill for ${parameters.customerName || 'the selected customer'}${Array.isArray(parameters.items) && parameters.items.length ? ` with ${parameters.items.map((item) => `${item.qty} ${item.name}`).join(', ')}` : ''}. Do you want me to continue?`;
    case 'generate_whatsapp_reminder':
      return `Send a WhatsApp payment reminder to ${parameters.customerName || 'this customer'}. Do you want me to continue?`;
    default:
      return interpreted.naturalAction || 'Please confirm this action.';
  }
}

function buildPendingAction(interpreted, executionContext) {
  return {
    interpreted,
    executionContext,
  };
}

async function runIntent(interpreted, executionContext) {
  switch (interpreted.intent) {
    case 'search_product':
      return executeSearchProduct(executionContext);
    case 'create_product':
      return executeCreateProduct(executionContext);
    case 'update_product_stock':
      return executeUpdateProductStock(executionContext);
    case 'search_customer':
      return executeSearchCustomer(executionContext);
    case 'create_customer':
      return executeCreateCustomer(executionContext);
    case 'get_customer_balance':
      return executeCustomerBalance(executionContext);
    case 'get_today_sales':
      return executeTodaySales(executionContext);
    case 'get_low_stock':
      return executeLowStock(executionContext);
    case 'search_bill':
      return executeSearchBill(executionContext);
    case 'create_bill':
      return executeCreateBill(executionContext);
    case 'generate_whatsapp_reminder':
      return executeWhatsappReminder(executionContext);
    default:
      return {
        responseText: "I didn't understand that request yet.",
        action: 'unknown',
        entity: '',
        result: null,
      };
  }
}

export async function processAssistantCommand({ command, source = 'text', app }) {
  const interpreted = await interpretCommand(command, app.state);
  const executionContext = { state: app.state, app, parameters: interpreted.parameters || {} };

  if (!interpreted.intent || interpreted.intent === 'unknown') {
    await logAssistantAudit({ command, action: 'unknown', entity: '', success: false, source, details: 'unrecognized' });
    return {
      status: 'error',
      responseText: "I didn't understand that request. Please try again with more detail.",
    };
  }

  if (interpreted.intent === 'ai_unavailable') {
    await logAssistantAudit({ command, action: 'ai_unavailable', entity: '', success: false, source, details: 'ai-not-configured' });
    return {
      status: 'error',
      responseText: interpreted.setupMessage || getAiSetupMessage(),
    };
  }

  if (Array.isArray(interpreted.missingFields) && interpreted.missingFields.length > 0) {
    await logAssistantAudit({ command, action: interpreted.intent, entity: '', success: false, source, details: `missing:${interpreted.missingFields.join(',')}` });
    return {
      status: 'error',
      responseText: `I need a little more information: ${interpreted.missingFields.join(', ')}.`,
    };
  }

  if (interpreted.confirmationRequired) {
    return {
      status: 'confirmation',
      responseText: buildConfirmationText(interpreted),
      pendingAction: buildPendingAction(interpreted, executionContext),
    };
  }

  try {
    const result = await runIntent(interpreted, executionContext);
    const success = !result.incomplete;
    await logAssistantAudit({ command, action: result.action, entity: result.entity, success, source, details: success ? 'executed' : 'incomplete' });
    return {
      status: success ? 'success' : 'error',
      responseText: result.responseText,
      result: result.result,
    };
  } catch (error) {
    await logAssistantAudit({ command, action: interpreted.intent, entity: '', success: false, source, details: error.message });
    return {
      status: 'error',
      responseText: error.message || "I couldn't complete that action. Nothing was changed.",
    };
  }
}

export async function confirmAssistantAction({ pendingAction, command, source = 'text' }) {
  const { interpreted, executionContext } = pendingAction || {};
  if (!interpreted || !executionContext) {
    return {
      status: 'error',
      responseText: 'There is no pending action to confirm.',
    };
  }

  try {
    const result = await runIntent(interpreted, executionContext);
    const success = !result.incomplete;
    await logAssistantAudit({ command, action: result.action, entity: result.entity, success, source, details: 'confirmed' });
    return {
      status: success ? 'success' : 'error',
      responseText: result.responseText,
      result: result.result,
    };
  } catch (error) {
    await logAssistantAudit({ command, action: interpreted.intent, entity: '', success: false, source, details: error.message });
    return {
      status: 'error',
      responseText: error.message || "I couldn't complete that action. Nothing was changed.",
    };
  }
}

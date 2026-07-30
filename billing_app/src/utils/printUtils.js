export const generateReceiptHTML = (sale) => {
  const dateObj = new Date(sale.date);
  const dateStr = dateObj.toLocaleDateString('en-GB'); // dd/mm/yyyy
  const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const billNo = `#${sale.id.slice(-6).toUpperCase()}`;

  let itemsHtml = sale.items.map(i => {
    const rate = i.sellingPrice.toFixed(2);
    const amt = (i.qty * i.sellingPrice).toFixed(2);
    const mrpStr = i.mrp ? `₹${i.mrp.toFixed(2)}` : '';
    const saveStr = (i.mrp && i.mrp > i.sellingPrice) ? (i.mrp - i.sellingPrice).toFixed(2) : '-';
    const barcode = i.barcode ? `[${i.barcode}]` : '';

    return `
      <tr>
        <td class="item-name">${i.name}</td>
        <td class="center strike">${mrpStr}</td>
        <td class="center">₹${rate}</td>
        <td class="center">${i.qty}</td>
        <td class="center">${saveStr}</td>
        <td class="right bold">₹${amt}</td>
      </tr>
      ${barcode ? `<tr><td colspan="6" class="item-barcode">${barcode}</td></tr>` : ''}
    `;
  }).join('');

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
          body {
            font-family: 'Courier Prime', 'Courier New', monospace;
            padding: 10px;
            max-width: 400px;
            margin: 0 auto;
            color: #000;
            font-size: 13px;
          }
          h1 {
            text-align: center;
            font-size: 24px;
            margin: 0 0 5px 0;
            font-weight: 900;
            letter-spacing: 1px;
          }
          .address {
            text-align: center;
            font-size: 12px;
            margin-bottom: 2px;
          }
          .phone {
            text-align: center;
            font-size: 12px;
            margin-bottom: 10px;
          }
          .dashed-line {
            border-top: 1px dashed #000;
            margin: 10px 0;
          }
          .thick-line {
            border-top: 3px solid #000;
            margin: 5px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .info-label {
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 5px 0;
            font-size: 11px;
            font-weight: bold;
          }
          th.left { text-align: left; }
          th.center { text-align: center; }
          th.right { text-align: right; }
          
          td {
            padding: 4px 0 0 0;
            font-size: 12px;
            vertical-align: top;
          }
          td.left { text-align: left; }
          td.center { text-align: center; }
          td.right { text-align: right; }
          td.bold { font-weight: bold; }
          td.strike { text-decoration: line-through; color: #555; }
          
          .item-name {
            font-weight: bold;
          }
          .item-barcode {
            color: #777;
            font-size: 11px;
            padding-bottom: 6px;
          }

          .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 13px;
          }
          .grand-total {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            padding: 5px 0;
          }

          .qr-container {
            text-align: center;
            margin-top: 15px;
          }
          .qr-title {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .qr-container img {
            width: 100px;
            height: 100px;
          }
          .qr-sub {
            font-size: 9px;
            color: #666;
            margin-top: 4px;
          }

          .footer-thanks {
            text-align: center;
            font-size: 11px;
            margin-top: 15px;
            line-height: 1.4;
          }
          
          .developer {
            text-align: center;
            font-size: 10px;
            color: #666;
            margin-top: 15px;
          }
          .developer img {
            height: 18px;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <h1>Well Pharmacy</h1>
        <div class="address">Shop No 1. Grover Market, Near azad chowk, Rewari 123401</div>
        <div class="phone">Mob no- 7015167948.</div>
        
        <div class="dashed-line"></div>
        
        <div class="info-row">
          <div><span class="info-label">Bill: </span>${billNo}</div>
          <div>${dateStr}</div>
        </div>
        <div class="info-row">
          <div><span class="info-label">Time: </span>${timeStr}</div>
        </div>
        <div class="info-row">
          <div><span class="info-label">Mode: </span>${sale.paymentMode}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th class="left">ITEM</th>
              <th class="center">MRP</th>
              <th class="center">RATE</th>
              <th class="center">QTY</th>
              <th class="center">SAVE</th>
              <th class="right">AMT</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="dashed-line"></div>
        
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>₹${sale.subtotal.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>GST:</span>
          <span>₹${sale.gst.toFixed(2)}</span>
        </div>
        ${sale.discount > 0 ? `
        <div class="totals-row">
          <span>Discount:</span>
          <span>-₹${sale.discount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${sale.freight > 0 ? `
        <div class="totals-row">
          <span>Freight/Shipping:</span>
          <span>+₹${sale.freight.toFixed(2)}</span>
        </div>
        ` : ''}
        ${sale.labor > 0 ? `
        <div class="totals-row">
          <span>Labor Charges:</span>
          <span>+₹${sale.labor.toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div class="thick-line"></div>
        
        <div class="grand-total">
          <span>GRAND TOTAL:</span>
          <span>₹${sale.grandTotal.toFixed(2)}</span>
        </div>
        
        <div class="thick-line"></div>
        
        <div class="qr-container">
          <div class="qr-title">📱 SCAN TO PAY</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=store@upi&pn=Store&am=${sale.grandTotal.toFixed(2)}" alt="QR Code" />
          <div class="qr-sub">PhonePe | BHIM UPI | GPay | Paytm</div>
        </div>
        
        <div class="dashed-line"></div>
        
        <div class="footer-thanks">
          Thank you for shopping at Well Pharmacy!<br/>
          *** No Refund / No Exchange ***
        </div>
        
        <div class="dashed-line"></div>
        
        <div class="developer">
          Designed & Developed by<br/>
          <strong>WINTOGETHER</strong> Technology
        </div>
      </body>
    </html>
  `;
};

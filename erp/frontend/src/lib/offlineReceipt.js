/**
 * offlineReceipt.js — Generador de comprobantes offline
 *
 * Genera un comprobante de venta/pago imprimible 100% en el cliente.
 * No requiere conexión al servidor.
 * Se abre en una nueva ventana y se imprime directo con window.print().
 */

/**
 * Generate and print a receipt for a sale.
 *
 * @param {object} sale
 * @param {string} sale.localId — ID local (offline-xxx) o ID real del server
 * @param {string} [sale.number] — Número de comprobante (puede ser temporal)
 * @param {string} sale.date — Fecha ISO o legible
 * @param {string} sale.clientName — Nombre del cliente
 * @param {string} [sale.clientDoc] — DNI/CUIT del cliente
 * @param {string} [sale.localName] — Nombre del local
 * @param {Array} sale.items — Items de la venta
 * @param {string} sale.items[].name — Nombre del producto
 * @param {string} [sale.items[].sku] — SKU
 * @param {string} [sale.items[].size] — Talle
 * @param {string} [sale.items[].color] — Color
 * @param {number} sale.items[].quantity — Cantidad
 * @param {number} sale.items[].unit_price — Precio unitario
 * @param {number} sale.subtotal — Subtotal sin IVA
 * @param {number} sale.tax — IVA
 * @param {number} sale.total — Total
 * @param {string} [sale.paymentMethod] — Método de pago
 * @param {boolean} [sale.isOffline] — Si fue generada offline
 */
export function printReceipt(sale, { companyName = "ERP Sistema" } = {}) {
  const receiptNumber = sale.number || sale.localId || "PENDIENTE";
  const dateStr = sale.date
    ? new Date(sale.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const fmtMoney = (v) => `$${Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

  const itemsRows = (sale.items || []).map((item) => `
    <tr>
      <td style="padding:3px 6px;border-bottom:1px solid #eee;font-size:12px;">
        ${item.name || "Producto"}
        ${item.size ? `<br><span style="color:#888;font-size:10px;">Talle: ${item.size} ${item.color ? `/ Color: ${item.color}` : ""}</span>` : ""}
      </td>
      <td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${item.quantity}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">${fmtMoney(item.unit_price)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:bold;">${fmtMoney(item.quantity * item.unit_price)}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante ${receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 380px; margin: 0 auto; color: #333; }
    @media print {
      body { padding: 5px; max-width: 100%; }
      .no-print { display: none !important; }
    }
    .header { text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #333; }
    .header h1 { font-size: 18px; font-weight: bold; }
    .header p { font-size: 11px; color: #666; }
    .info { margin-bottom: 12px; font-size: 12px; }
    .info div { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .info .label { color: #888; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { padding: 4px 6px; text-align: left; font-size: 11px; background: #f5f5f5; border-bottom: 2px solid #ddd; }
    .totals { border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; }
    .totals div { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px; }
    .totals .total-final { font-size: 18px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 5px; margin-top: 5px; }
    .footer { text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 10px; color: #999; }
    .offline-badge { background: #f59e0b; color: white; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; margin-top: 5px; }
    .btn-print { display: block; width: 100%; padding: 12px; background: #7c3aed; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; margin-top: 15px; }
    .btn-print:hover { background: #6d28d9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>MUNDO OUTDOOR</h1>
    <p>Comprobante de Venta</p>
    ${sale.isOffline ? '<span class="offline-badge">GENERADO OFFLINE — Número provisional</span>' : ""}
  </div>

  <div class="info">
    <div><span class="label">Comprobante:</span> <b>${receiptNumber}</b></div>
    <div><span class="label">Fecha:</span> <span>${dateStr}</span></div>
    ${sale.localName ? `<div><span class="label">Local:</span> <span>${sale.localName}</span></div>` : ""}
    ${sale.clientName ? `<div><span class="label">Cliente:</span> <span>${sale.clientName}</span></div>` : ""}
    ${sale.clientDoc ? `<div><span class="label">DNI/CUIT:</span> <span>${sale.clientDoc}</span></div>` : ""}
    ${sale.paymentMethod ? `<div><span class="label">Pago:</span> <span>${sale.paymentMethod}</span></div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:center;">Cant.</th>
        <th style="text-align:right;">P.Unit.</th>
        <th style="text-align:right;">Subtot.</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal:</span> <span>${fmtMoney(sale.subtotal)}</span></div>
    ${sale.tax ? `<div><span>IVA (21%):</span> <span>${fmtMoney(sale.tax)}</span></div>` : ""}
    <div class="total-final"><span>TOTAL:</span> <span>${fmtMoney(sale.total)}</span></div>
  </div>

  <div class="footer">
    <p>Gracias por su compra</p>
    <p>${companyName} — ERP v1.0</p>
    ${sale.isOffline ? "<p style='color:#f59e0b;font-weight:bold;margin-top:5px;'>⚠ Este comprobante será confirmado cuando se restaure la conexión</p>" : ""}
  </div>

  <button class="btn-print no-print" onclick="window.print()">🖨 Imprimir comprobante</button>
</body>
</html>`;

  const win = window.open("", "_blank", "width=420,height=650");
  if (win) {
    win.document.write(html);
    win.document.close();
    // Auto-print after brief delay for rendering
    setTimeout(() => {
      try { win.print(); } catch {}
    }, 300);
  } else {
    // Popup blocked — fallback to blob download
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprobante-${receiptNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

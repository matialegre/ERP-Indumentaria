/**
 * minutaPDF.js — Generador de minuta de pago para GestionPagos
 * Genera un documento imprimible con los detalles del comprobante de pago.
 */

export function printMinuta(voucher, { companyName = "ERP Sistema" } = {}) {
  const dateStr = (d) =>
    d
      ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "—";
  const fmtMoney = (v) =>
    `$${Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  const nro = voucher.voucher_number || voucher.id || "PENDIENTE";

  const invoiceRows = (voucher.linked_invoices || [])
    .map(
      (inv) => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:11px;">${inv.type || ""} ${inv.number || "—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;">${dateStr(inv.date)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-size:11px;">${fmtMoney(inv.amount)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;">${inv.remito_venta_number || "—"}</td>
    </tr>
  `
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Minuta de Pago ${nro}</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif;padding:25px;max-width:700px;margin:0 auto;color:#333;font-size:13px; }
    @media print { .no-print{display:none!important} }
    .header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #1e40af; }
    .company { font-size:20px;font-weight:bold;color:#1e40af; }
    .doc-info { text-align:right; }
    .doc-info h2 { font-size:16px;font-weight:bold;color:#333;margin-bottom:4px; }
    .doc-info p { font-size:11px;color:#666; }
    .section { margin:15px 0; }
    .section-title { font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#666;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e5e7eb; }
    .grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
    .field { margin-bottom:6px; }
    .field label { font-size:10px;color:#888;display:block; }
    .field span { font-size:13px;font-weight:500; }
    table { width:100%;border-collapse:collapse;margin:8px 0; }
    th { padding:5px 8px;text-align:left;font-size:10px;background:#f3f4f6;border-bottom:2px solid #e5e7eb;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280; }
    .totals { margin-top:15px;border-top:2px solid #333;padding-top:10px; }
    .totals-row { display:flex;justify-content:space-between;padding:3px 0;font-size:12px; }
    .total-final { font-size:18px;font-weight:bold;color:#1e40af;border-top:1px solid #ddd;padding-top:8px;margin-top:5px; }
    .firma-section { display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px; }
    .firma-box { border-top:1px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#666; }
    .badge { display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold; }
    .badge-pagado { background:#d1fae5;color:#065f46; }
    .badge-pendiente { background:#fef3c7;color:#92400e; }
    .print-btn { display:block;width:100%;padding:12px;background:#1e40af;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;margin-top:20px; }
    .print-btn:hover { background:#1d4ed8; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">MUNDO OUTDOOR</div>
      <div style="font-size:11px;color:#666;margin-top:2px;">RM Indumentaria S.A.</div>
    </div>
    <div class="doc-info">
      <h2>MINUTA DE PAGO</h2>
      <p>N° ${nro}</p>
      <p>Fecha: ${dateStr(voucher.payment_date || new Date())}</p>
      <span class="badge ${voucher.status === "PAGADO" ? "badge-pagado" : "badge-pendiente"}">${voucher.status || "PENDIENTE"}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Proveedor</div>
    <div class="grid-2">
      <div>
        <div class="field"><label>Razón Social</label><span>${voucher.provider_name || "—"}</span></div>
        <div class="field"><label>CUIT</label><span>${voucher.provider_cuit || "—"}</span></div>
      </div>
      <div>
        <div class="field"><label>Método de Pago</label><span>${voucher.payment_method || "—"}</span></div>
        <div class="field"><label>Vencimiento</label><span>${dateStr(voucher.due_date)}</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Facturas / Documentos vinculados</div>
    <table>
      <thead>
        <tr>
          <th>Documento</th>
          <th style="text-align:center">Fecha</th>
          <th style="text-align:right">Importe</th>
          <th style="text-align:center">RV</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRows || `<tr><td colspan="4" style="text-align:center;padding:8px;color:#9ca3af;font-size:11px;">Sin documentos vinculados</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="section totals">
    <div class="section-title">Liquidación</div>
    <div class="totals-row"><span>Importe bruto:</span><span>${fmtMoney(voucher.amount_gross)}</span></div>
    ${voucher.amount_iva ? `<div class="totals-row"><span>Ret. IVA:</span><span style="color:#dc2626">-${fmtMoney(voucher.amount_iva)}</span></div>` : ""}
    ${voucher.amount_iibb ? `<div class="totals-row"><span>Ret. IIBB:</span><span style="color:#dc2626">-${fmtMoney(voucher.amount_iibb)}</span></div>` : ""}
    ${voucher.amount_ganancias ? `<div class="totals-row"><span>Ret. Ganancias:</span><span style="color:#dc2626">-${fmtMoney(voucher.amount_ganancias)}</span></div>` : ""}
    ${voucher.amount_suss ? `<div class="totals-row"><span>Ret. SUSS:</span><span style="color:#dc2626">-${fmtMoney(voucher.amount_suss)}</span></div>` : ""}
    ${voucher.amount_nc ? `<div class="totals-row"><span>Notas de crédito:</span><span style="color:#dc2626">-${fmtMoney(voucher.amount_nc)}</span></div>` : ""}
    <div class="totals-row total-final"><span>NETO A PAGAR:</span><span>${fmtMoney(voucher.amount_paid || voucher.amount_net)}</span></div>
  </div>

  <div class="firma-section">
    <div class="firma-box">Firma Autorizante</div>
    <div class="firma-box">Firma Conformidad Proveedor</div>
  </div>

  <div style="margin-top:20px;padding:10px;background:#f9fafb;border-radius:8px;font-size:10px;color:#9ca3af;text-align:center;">
    ${companyName} — Documento generado el ${new Date().toLocaleString("es-AR")}
  </div>

  <button class="print-btn no-print" onclick="window.print()">🖨 Imprimir Minuta</button>
</body>
</html>`;

  const win = window.open("", "_blank", "width=750,height=900");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try {
        win.print();
      } catch {}
    }, 400);
  } else {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minuta-pago-${nro}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

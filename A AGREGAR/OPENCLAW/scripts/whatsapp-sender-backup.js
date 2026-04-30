/**
 * whatsapp-sender.js
 * ─────────────────────────────────────────────────────────
 * Servidor HTTP local (puerto 3456) que mantiene sesión de
 * WhatsApp Web. La primera vez muestra un QR para escanear.
 * La sesión queda guardada en .ww-session/ y no pide QR de nuevo.
 *
 * Uso:
 *   node whatsapp-sender.js
 *
 * Endpoint:
 *   POST http://localhost:3456/send
 *   Body: { "numero": "5492932517802", "mensaje": "Hola!" }
 * ─────────────────────────────────────────────────────────
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode        = require('qrcode-terminal');
const QRCode        = require('qrcode');
const express       = require('express');

const app  = express();
app.use(express.json());

// ── Cliente WhatsApp ──────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.ww-session' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

let listo    = false;
let qrDataUrl = null;   // imagen PNG en base64 del último QR

client.on('qr', async (qr) => {
    qrDataUrl = await QRCode.toDataURL(qr, { scale: 10 });
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo');
    console.log('  Escaneá este QR:\n');
    qrcode.generate(qr, { small: true });
    console.log('  👉  También podés escanearlo en: http://localhost:3456/qr');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

client.on('ready', () => {
    listo     = true;
    qrDataUrl = null;   // ya no hace falta el QR
    console.log('✅  WhatsApp conectado y listo para enviar mensajes.');
});

client.on('disconnected', (reason) => {
    listo = false;
    console.warn('⚠️  WhatsApp desconectado:', reason);
});

client.initialize();

// ── HTTP server ───────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { numero, mensaje } = req.body;

    if (!listo) {
        return res.status(503).json({ ok: false, error: 'WhatsApp no conectado todavía' });
    }
    if (!numero || !mensaje) {
        return res.status(400).json({ ok: false, error: 'Faltan numero o mensaje' });
    }

    try {
        // Normaliza el número: solo dígitos + @c.us
        const chatId = numero.replace(/\D/g, '') + '@c.us';
        await client.sendMessage(chatId, mensaje);
        console.log(`  ✓ Mensaje enviado a ${numero}`);
        res.json({ ok: true });
    } catch (e) {
        console.error(`  ✗ Error enviando a ${numero}:`, e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.get('/status', (req, res) => {
    res.json({ listo });
});

// ── QR en el browser ─────────────────────────────────────
app.get('/qr', (req, res) => {
    if (listo) {
        return res.send('<h2 style="font-family:sans-serif;text-align:center;margin-top:80px">✅ WhatsApp ya está conectado. No hace falta escanear nada.</h2>');
    }
    if (!qrDataUrl) {
        return res.send('<h2 style="font-family:sans-serif;text-align:center;margin-top:80px">⏳ Generando QR... Recargá en unos segundos.</h2><script>setTimeout(()=>location.reload(),3000)</script>');
    }
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title>
    <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;font-family:sans-serif}
    img{width:380px;height:380px;border:8px solid #25d366;border-radius:12px}
    p{font-size:1.1rem;margin-top:20px;opacity:.8}small{opacity:.5}</style>
    <meta http-equiv="refresh" content="25"></head>
    <body><h2>Escaneá con WhatsApp</h2>
    <img src="${qrDataUrl}" />
    <p>Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
    <small>La página se actualiza sola cada 25 segundos</small>
    </body></html>`);
});

app.listen(3456, () => {
    console.log('🚀  Servidor HTTP escuchando en http://localhost:3456');
    console.log('   Esperando conexión de WhatsApp...\n');
});

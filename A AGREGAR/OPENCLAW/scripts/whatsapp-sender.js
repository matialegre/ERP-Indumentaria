const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
app.use(express.json());

let listo = false;
let qrDataUrl = null;
let conectandose = false;
let ultimoError = null;
let ultimoEvento = 'idle';
let client = null;
let reintentoTimer = null;

function resumenError(error) {
    if (!error) return 'Error desconocido';
    return error.message || String(error);
}

async function destruirCliente() {
    if (!client) return;

    const clienteActual = client;
    client = null;

    try {
        clienteActual.removeAllListeners();
        await clienteActual.destroy();
    } catch (error) {
        console.warn('[WhatsApp] Error cerrando cliente:', resumenError(error));
    }
}

function programarReintento(ms = 15000) {
    if (reintentoTimer) return;

    ultimoEvento = 'reintentando';
    reintentoTimer = setTimeout(() => {
        reintentoTimer = null;
        inicializarCliente(true).catch((error) => {
            console.error('[WhatsApp] Error reintentando:', resumenError(error));
        });
    }, ms);
}

function crearCliente() {
    if (client) return client;

    ultimoError = null;
    ultimoEvento = 'creando_cliente';

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.ww-session' }),
        webVersion: '2.3000.1017054665',
        webVersionCache: {
            type: 'local',
            path: './.wwebjs_cache',
            strict: false,
        },
        authTimeoutMs: 60000,
        qrMaxRetries: 0,
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
            ],
        },
    });

    client.on('qr', async (qr) => {
        ultimoEvento = 'qr_recibido';
        ultimoError = null;
        console.log('[WhatsApp] Nuevo QR generado');

        try {
            qrDataUrl = await QRCode.toDataURL(qr, { scale: 10 });
        } catch (error) {
            console.warn('[WhatsApp] Error generando QR:', resumenError(error));
            qrDataUrl = null;
        }

        console.log('\n' + '━'.repeat(60));
        console.log('  ESCANEA ESTE QR CON WHATSAPP:');
        console.log('  Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo\n');
        qrcode.generate(qr, { small: true });
        console.log('\n  O accedé a: http://localhost:3456/qr');
        console.log('━'.repeat(60) + '\n');
    });

    client.on('authenticated', () => {
        ultimoEvento = 'authenticated';
        ultimoError = null;
        console.log('✅ Autenticación exitosa');
    });

    client.on('ready', () => {
        ultimoEvento = 'ready';
        ultimoError = null;
        listo = true;
        conectandose = false;
        qrDataUrl = null;
        console.log('✅ WhatsApp LISTO para enviar mensajes');
    });

    client.on('auth_failure', async (msg) => {
        ultimoEvento = 'auth_failure';
        ultimoError = typeof msg === 'string' ? msg : resumenError(msg);
        listo = false;
        conectandose = false;
        qrDataUrl = null;
        console.error('❌ Error de autenticación:', ultimoError);
        await destruirCliente();
        programarReintento();
    });

    client.on('disconnected', async (reason) => {
        ultimoEvento = 'disconnected';
        ultimoError = `Desconectado: ${reason || 'sin detalle'}`;
        listo = false;
        conectandose = false;
        qrDataUrl = null;
        console.warn('⚠️  WhatsApp desconectado:', reason);
        await destruirCliente();
        programarReintento();
    });

    client.on('loading_screen', (percent, message) => {
        ultimoEvento = `loading_${percent}`;
        if (message) {
            console.log(`[WhatsApp] ${message} ${percent}%`);
        }
    });

    return client;
}

async function inicializarCliente(force = false) {
    if (listo || conectandose) return;

    if (force) {
        await destruirCliente();
    }

    if (client) return;

    conectandose = true;
    ultimoError = null;
    ultimoEvento = 'initializing';
    console.log('[WhatsApp] Inicializando cliente...');

    try {
        const cli = crearCliente();
        await cli.initialize();
        console.log('[WhatsApp] Inicialización lanzada');
    } catch (error) {
        const mensaje = resumenError(error);
        console.error('[WhatsApp] Error en inicialización:', mensaje);
        ultimoEvento = 'init_error';
        ultimoError = mensaje;
        listo = false;
        conectandose = false;
        qrDataUrl = null;
        await destruirCliente();
        programarReintento();
    }
}

app.post('/send', async (req, res) => {
    const { numero, mensaje } = req.body;

    if (!listo || !client) {
        return res.status(503).json({
            ok: false,
            error: 'WhatsApp no conectado todavía',
            listo: false,
            conectandose,
            ultimoError,
        });
    }

    if (!numero || !mensaje) {
        return res.status(400).json({ ok: false, error: 'Faltan numero o mensaje' });
    }

    try {
        const chatId = numero.replace(/\D/g, '') + '@c.us';
        await client.sendMessage(chatId, mensaje);
        console.log(`✓ Mensaje enviado a ${numero}`);
        res.json({ ok: true });
    } catch (error) {
        const mensajeError = resumenError(error);
        ultimoError = mensajeError;
        console.error(`✗ Error enviando a ${numero}:`, mensajeError);
        res.status(500).json({ ok: false, error: mensajeError });
    }
});

app.get('/status', (req, res) => {
    if (!listo && !conectandose && !client) {
        inicializarCliente().catch((error) => {
            console.error('[WhatsApp] Error auto-iniciando desde /status:', resumenError(error));
        });
    }

    res.json({
        listo,
        conectandose,
        tieneQR: !!qrDataUrl,
        ultimoError,
        ultimoEvento,
        reintentando: !!reintentoTimer,
    });
});

app.get('/qr', (req, res) => {
    if (!listo && !conectandose && !client) {
        inicializarCliente().catch((error) => {
            console.error('[WhatsApp] Error inicializando desde /qr:', resumenError(error));
        });
    }

    if (listo) {
        return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title>
        <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;font-family:sans-serif}
        h2{color:#25d366}</style></head>
        <body><h2>✅ WhatsApp conectado</h2>
        <p>No hace falta escanear nada</p>
        </body></html>`);
    }

    if (!qrDataUrl) {
        const detalle = ultimoError
            ? `<p style="max-width:420px;text-align:center;color:#fca5a5">${ultimoError}</p>`
            : '<p style="font-size:0.9rem;opacity:0.7">La página se actualiza automáticamente</p>';

        return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title>
        <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;font-family:sans-serif}
        .spinner{border:4px solid #333;border-top:4px solid #25d366;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        code{margin-top:14px;padding:6px 10px;background:#1f2937;border-radius:8px;color:#93c5fd}</style>
        <meta http-equiv="refresh" content="2"></head>
        <body>
        <div class="spinner"></div>
        <p>Generando QR...</p>
        ${detalle}
        <code>${ultimoEvento}</code>
        </body></html>`);
    }

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title>
    <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#fff;font-family:sans-serif}
    img{width:380px;height:380px;border:8px solid #25d366;border-radius:12px;box-shadow:0 0 20px rgba(37,211,102,0.3)}
    h2{color:#25d366}
    p{font-size:1.1rem;margin-top:20px;opacity:.8}
    small{opacity:.5}
    .footer{font-size:0.9rem;margin-top:30px;opacity:0.6;text-align:center}</style>
    <meta http-equiv="refresh" content="25"></head>
    <body>
    <h2>Escaneá con WhatsApp</h2>
    <img src="${qrDataUrl}" alt="QR Code" />
    <p>Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
    <div class="footer">
        <small>La página se actualiza cada 25 segundos</small>
    </div>
    </body></html>`);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: {
            listo,
            conectandose,
            tieneQR: !!qrDataUrl,
            clienteIniciado: !!client,
            ultimoError,
            ultimoEvento,
        },
    });
});

async function cerrarProceso(senal) {
    console.log(`\n[WhatsApp] Recibido ${senal}, desconectando...`);
    listo = false;
    conectandose = false;
    qrDataUrl = null;

    if (reintentoTimer) {
        clearTimeout(reintentoTimer);
        reintentoTimer = null;
    }

    await destruirCliente();
    process.exit(0);
}

process.on('SIGTERM', () => {
    cerrarProceso('SIGTERM');
});

process.on('SIGINT', () => {
    cerrarProceso('SIGINT');
});

app.listen(3456, '127.0.0.1', () => {
    console.log('🚀 Servidor escuchando en http://localhost:3456');
    console.log('📱 Esperando conexión de WhatsApp...\n');

    inicializarCliente().catch((error) => {
        console.error('[Startup] Error:', resumenError(error));
    });
});

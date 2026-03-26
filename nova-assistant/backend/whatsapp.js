const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const ollama = require('ollama').default;

class WhatsAppClient {
    constructor(broadcastFunc, notifyFunc) {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                handleSIGINT: false,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--no-first-run',
                    '--no-default-browser-check'
                ]
            }
        });
        this.broadcast = broadcastFunc;
        this.notify = notifyFunc || (() => {});
        this.repliedContacts = new Set();
        this.lastQR = null;
        this.init();
    }

    init() {
        this.client.on('qr', (qr) => {
            console.log('\n[WhatsApp] === ESCANEA ESTE CÓDIGO QR PARA VINCULAR A SAM ===');
            this.lastQR = qr;
            qrcode.generate(qr, { small: true });
            this.broadcast({ type: 'WA_QR', value: qr });
        });

        this.client.on('ready', () => {
            console.log('[WhatsApp] Cliente listo y conectado.');
            this.broadcast({ type: 'WA_READY', value: true });
            this.broadcast({ type: 'SPEAK', text: 'Bienvenido de vuelta jefe.' });
        });

        this.client.on('message', async (msg) => {
            // Ignorar mensajes de grupos para evitar spam (por ahora)
            if (msg.from.includes('@g.us')) return;

            const contact = await msg.getContact();
            const name = contact.pushname || contact.name || contact.number;
            
            // 1. Auto-responder fijo (PRIORIDAD)
            if (!this.repliedContacts.has(msg.from)) {
                this.repliedContacts.add(msg.from);
                console.log(`[WhatsApp] Auto-respondiendo a ${name}`);
                try {
                    await msg.reply("Hola, soy sam, Jean te contestara en un momento en cuanto se desocupe");
                } catch (error) {
                    console.error('[WhatsApp] Error auto-reply:', error);
                }
            }

            // 2. Notificar al usuario proactivamente por VOZ (DESPUÉS del reply)
            this.notify(`Jefe, tienes un nuevo mensaje de ${name}: "${msg.body}"`);
        });

        this.client.initialize().catch(err => {
            console.error('[WhatsApp] Error al inicializar:', err);
        });
    }

    // Buscar contacto por nombre (búsqueda parcial)
    async findContact(name) {
        if (!this.client) return null;
        const contacts = await this.client.getContacts();
        return contacts.find(c => c.name?.toLowerCase().includes(name.toLowerCase()));
    }

    // Enviar mensaje
    async sendMessage(target, text) {
        if (!this.client) return "WhatsApp no está listo.";
        try {
            let chatId = target;
            if (!target.includes("@c.us")) {
                const contact = await this.findContact(target);
                if (contact) {
                    chatId = contact.id._serialized;
                } else {
                    return `No encontré al contacto ${target}.`;
                }
            }
            await this.client.sendMessage(chatId, text);
            return `Mensaje enviado a ${target}.`;
        } catch (e) {
            console.error("[WhatsApp Send Error]:", e);
            return "Error al enviar el mensaje.";
        }
    }

    async getUnreadMessages() {
        try {
            const chats = await this.client.getChats();
            const unreadChats = chats.filter(chat => chat.unreadCount > 0);
            
            if (unreadChats.length === 0) {
                return "No tienes mensajes nuevos en este momento.";
            }

            let summary = `Tienes mensajes de ${unreadChats.length} chats. `;
            for (const chat of unreadChats) {
                const messages = await chat.fetchMessages({ limit: chat.unreadCount });
                const contact = await chat.getContact();
                const name = contact.pushname || contact.name || contact.number;
                summary += `De ${name}: "${messages[messages.length - 1].body}". `;
            }
            return summary;
        } catch (e) {
            console.error('[WhatsApp] Error obteniendo mensajes:', e);
            return "Tuve un problema al intentar leer tus mensajes.";
        }
    }
}

module.exports = WhatsAppClient;

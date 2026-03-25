const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('./crypto_utils');

class SamMemory {
    constructor() {
        this.memoryPath = path.join(__dirname, 'memory.json');
        this.data = this.load();
    }

    load() {
        if (!fs.existsSync(this.memoryPath)) {
            return { 
                user_info: { name: "Jean" }, 
                facts: [], 
                preferences: {} 
            };
        }
        try {
            const rawData = fs.readFileSync(this.memoryPath, 'utf8');
            const encryptedData = JSON.parse(rawData);
            const decryptedString = decrypt(encryptedData);
            return JSON.parse(decryptedString);
        } catch (e) {
            console.error("[Memory] Error cargando memoria (puede que no esté cifrada todavía):", e.message);
            // Intentar cargar como texto plano si falla el descifrado (migración inicial)
            try {
                const plainData = fs.readFileSync(this.memoryPath, 'utf8');
                return JSON.parse(plainData);
            } catch(e2) {
                return { user_info: {}, facts: [], preferences: {} };
            }
        }
    }

    save() {
        try {
            const encryptedData = encrypt(JSON.stringify(this.data));
            fs.writeFileSync(this.memoryPath, JSON.stringify(encryptedData, null, 2));
        } catch (e) {
            console.error("[Memory] Error guardando memoria cifrada:", e);
        }
    }

    addFact(fact) {
        this.data.facts.push({
            text: fact,
            timestamp: new Date().toISOString()
        });
        this.save();
    }

    getFactsSummary() {
        if (!this.data.facts || this.data.facts.length === 0) return "No tengo recuerdos específicos aún.";
        return this.data.facts.slice(-10).map(f => f.text).join(". ");
    }

    updateUserInfo(key, value) {
        this.data.user_info[key] = value;
        this.save();
    }
}

module.exports = new SamMemory();

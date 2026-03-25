const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('../crypto_utils');

class PIMSkills {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.calendarPath = path.join(__dirname, '../calendar.json');
        this.remindersPath = path.join(__dirname, '../reminders.json');
    }

    _loadData(filePath) {
        if (!fs.existsSync(filePath)) return [];
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const decrypted = decrypt(JSON.parse(raw));
            return JSON.parse(decrypted);
        } catch (e) { return []; }
    }

    _saveData(filePath, data) {
        const encrypted = encrypt(JSON.stringify(data));
        fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2));
    }

    getActions() {
        return {
            "add_event": async (param, speakFunc) => {
                const events = this._loadData(this.calendarPath);
                events.push({ title: param, date: new Date().toISOString() });
                this._saveData(this.calendarPath, events);
                speakFunc(`Evento añadido al calendario: ${param}`);
            },
            "read_calendar": async (param, speakFunc) => {
                const events = this._loadData(this.calendarPath);
                if (events.length === 0) return speakFunc("No tienes eventos programados.");
                const list = events.slice(-5).map(e => e.title).join(", ");
                speakFunc(`Tus próximos eventos son: ${list}`);
            },
            "add_reminder": async (param, speakFunc) => {
                const reminders = this._loadData(this.remindersPath);
                reminders.push({ text: param, created: new Date().toISOString() });
                this._saveData(this.remindersPath, reminders);
                speakFunc(`Recordatorio guardado: ${param}`);
            }
        };
    }
}

module.exports = PIMSkills;

class RemindersSkills {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.reminders = [];
    }

    getActions() {
        return {
            "set_reminder": async (param, speakFunc) => {
                // Param format: "Tiempo en minutos|Mensaje"
                const parts = param.split("|");
                if (parts.length < 2) return speakFunc("No entendí bien el recordatorio. Necesito el tiempo y el mensaje.");
                
                const minutes = parseFloat(parts[0]);
                const text = parts[1];
                
                if (isNaN(minutes)) return speakFunc("Lo siento, no entendí el tiempo para el recordatorio.");

                const ms = minutes * 60000;
                const id = setTimeout(() => {
                    speakFunc(`¡Jefe! No olvides que: ${text}`);
                    // Limpiar
                    this.reminders = this.reminders.filter(r => r.id !== id);
                }, ms);

                this.reminders.push({ id, text, time: new Date(Date.now() + ms) });
                
                speakFunc(`Vale, te lo recordaré en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`);
            },
            "list_reminders": async (param, speakFunc) => {
                if (this.reminders.length === 0) return speakFunc("No tienes recordatorios pendientes ahora mismo.");
                
                let list = "Tienes los siguientes recordatorios: ";
                this.reminders.forEach((r, i) => {
                    const diff = Math.round((r.time - Date.now()) / 60000);
                    list += `${i + 1}. ${r.text} en ${diff} minutos. `;
                });
                speakFunc(list);
            }
        };
    }
}

module.exports = RemindersSkills;

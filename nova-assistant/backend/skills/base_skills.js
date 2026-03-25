const open = require('open');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const memory = require('../memory');

class BaseSkills {
    constructor(interpreter) {
        this.interpreter = interpreter;
    }

    getActions() {
        return {
            "open_anything": async (param, speakFunc) => {
                if (!param) return speakFunc("No me dijiste qué quieres abrir.");
                try {
                    await open(param);
                } catch (e) {
                    const appPath = this.interpreter.findAppLink(param);
                    if (appPath) {
                        await open(appPath);
                    } else if (param.includes("spotify")) {
                        await open("https://open.spotify.com");
                    } else {
                        speakFunc(`Lo siento, no encontré la aplicación ${param}.`);
                    }
                }
            },
            "close_app": async (param, speakFunc) => {
                exec(`taskkill /F /IM ${param}`, (err) => {
                    if (err) console.log(`No se pudo cerrar ${param}`);
                });
            },
            "speak": async (param, speakFunc) => {
                speakFunc(param);
            },
            "add_fact": async (param, speakFunc) => {
                if (!param) return;
                memory.addFact(param);
                console.log(`[Memory] Nuevo dato guardado: ${param}`);
                // No siempre es necesario que Sam confirme en voz alta que guardó algo si es automático, 
                // pero para esta fase de prueba le daré una respuesta sutil.
                speakFunc("Entendido, lo recordaré.");
            }
        };
    }
}

module.exports = BaseSkills;

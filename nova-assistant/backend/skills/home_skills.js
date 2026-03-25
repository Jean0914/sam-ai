const os = require('os');
const systeminformation = require('systeminformation');

class HomeSkills {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.states = {
            lights: "apagadas",
            temperature: 22,
            fan: "off"
        };
    }

    getActions() {
        return {
            "adjust_volume": async (param, speakFunc) => {
                const { exec } = require('child_process');
                const level = param.match(/\d+/) ? param.match(/\d+/)[0] : 50;
                exec(`powershell -Command "$obj = New-Object -ComObject WScript.Shell; for($i=0; $i<50; $i++) { $obj.SendKeys([char]174) }; for($i=0; $i<${level/2}; $i++) { $obj.SendKeys([char]175) }"`);
                speakFunc(`Volumen al ${level}%.`);
            },
            "adjust_brightness": async (param, speakFunc) => {
                const { exec } = require('child_process');
                const level = param.match(/\d+/) ? param.match(/\d+/)[0] : 100;
                exec(`powershell -Command "(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${level})"`);
                speakFunc(`Brillo al ${level}%.`);
            },
            "whatsapp_send": async (param, speakFunc) => {
                // Param format: "Nombre|Mensaje"
                const [target, ...textParts] = param.split("|");
                const text = textParts.join("|");
                const result = await this.interpreter.waClient?.sendMessage(target, text);
                speakFunc(result || "No pude enviar el mensaje.");
            },
            "system_status": async (param, speakFunc) => {
                try {
                    const cpu = await systeminformation.cpuTemperature();
                    const load = await systeminformation.currentLoad();
                    const mem = await systeminformation.mem();
                    
                    const cpuLoad = Math.round(load.currentLoad);
                    const memUsed = Math.round((mem.active / mem.total) * 100);
                    const cpuTemp = cpu.main ? `${cpu.main}°C` : 'N/A';
                    
                    const report = `El sistema está al ${cpuLoad}% de CPU (${cpuTemp}) y ${memUsed}% de memoria RAM.`;
                    speakFunc(report);
                    
                    // Enviar datos técnicos al frontend para widgets
                    this.interpreter.broadcast({ 
                        type: 'NOTIFICATION', 
                        text: `CPU: ${cpuLoad}% | RAM: ${memUsed}%`, 
                        nType: 'stats' 
                    });
                } catch (e) {
                    speakFunc("No pude leer todos los sensores del sistema.");
                }
            }
        };
    }
}

module.exports = HomeSkills;

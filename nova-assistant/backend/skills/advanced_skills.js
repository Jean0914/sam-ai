const { webSearch, captureScreen, readPDF, readDOCX, searchFiles } = require('../interpreter_utils');
const path = require('path');
const fs = require('fs');
const memory = require('../memory');

class AdvancedSkills {
    constructor(interpreter) {
        this.interpreter = interpreter;
    }

    getActions() {
        return {
            "web_search": async (param, speakFunc) => {
                const results = await webSearch(param);
                speakFunc(`He buscado en la web: ${results}`);
            },
            "capture_screen": async (param, speakFunc) => {
                const text = await captureScreen();
                speakFunc(`En tu pantalla dice: ${text.substring(0, 500)}`);
            },
            "read_pdf": async (param, speakFunc) => {
                const text = await readPDF(param);
                speakFunc(`PDF leído: ${text.substring(0, 300)}`);
            },
            "read_docx": async (param, speakFunc) => {
                const text = await readDOCX(param);
                speakFunc(`DOCX leído: ${text.substring(0, 300)}`);
            },
            "search_files": async (param, speakFunc) => {
                const results = searchFiles(param, process.env.USERPROFILE || 'C:\\');
                if (results.length > 0) {
                    speakFunc(`Encontré archivos, el primero es ${path.basename(results[0])}`);
                } else {
                    speakFunc("No encontré nada.");
                }
            },
            "study_folder": async (param, speakFunc) => {
                if (!param) return speakFunc("Necesito que me digas qué carpeta estudiar.");
                // Guardia anti-alucinaciones: Si el parámetro es un placeholder o está vacío
                if (!param || param.includes("[") || param.includes("Ruta") || param.length < 3) {
                    return speakFunc("Dime la ruta completa de la carpeta, cielo. No puedo adivinar dónde está tu proyecto.");
                }
                const folderPath = path.resolve(param);
                if (!fs.existsSync(folderPath)) return speakFunc(`No pude encontrar la carpeta en ${param}. Asegúrate de darme la ruta completa.`);

                speakFunc(`Vale, voy a estudiar el contenido de ${path.basename(folderPath)}. Dame un momento...`);
                
                try {
                    const files = fs.readdirSync(folderPath);
                    const extensions = ['.pdf', '.docx', '.txt', '.js', '.py', '.ts', '.html', '.css', '.json'];
                    const relevantFiles = files.filter(f => extensions.some(ext => f.endsWith(ext))).slice(0, 15);
                    
                    let foundKnowledge = [];
                    for (const file of relevantFiles) {
                        const fullPath = path.join(folderPath, file);
                        let content = "";
                        if (file.endsWith('.pdf')) content = await readPDF(fullPath);
                        else if (file.endsWith('.docx')) content = await readDOCX(fullPath);
                        else content = fs.readFileSync(fullPath, 'utf8');
                        
                        if (content) {
                            const summary = `Archivo ${file}: ${content.substring(0, 200)}...`;
                            foundKnowledge.push(summary);
                        }
                    }

                    if (foundKnowledge.length > 0) {
                        const finalSummary = `He estudiado la carpeta ${path.basename(folderPath)}. Contiene información sobre: ${foundKnowledge.join(". ")}`;
                        memory.addFact(`Conocimiento local (${path.basename(folderPath)}): ${finalSummary.substring(0, 500)}`);
                        speakFunc(`He terminado de estudiar la carpeta. Ya sé qué hay en ella.`);
                    } else {
                        speakFunc("Estudié la carpeta pero no encontré archivos legibles.");
                    }
                } catch (e) {
                    console.error("[Study Folder Error]:", e);
                    speakFunc("Tuve un problema al intentar estudiar esa carpeta.");
                }
            }
        };
    }
}

module.exports = AdvancedSkills;

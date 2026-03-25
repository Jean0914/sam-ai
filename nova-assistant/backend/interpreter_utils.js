const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { search } = require('duck-duck-scrape');
const screenshot = require('screenshot-desktop');
const Tesseract = require('tesseract.js');

async function webSearch(query) {
    try {
        const searchResults = await search(query, { safeSearch: search.SafeSearchType.STRICT });
        if (searchResults.results && searchResults.results.length > 0) {
            return searchResults.results.slice(0, 2).map(r => `${r.title}: ${r.description}`).join(". ");
        }
        return "No encontré resultados relevantes.";
    } catch (e) {
        return "Error en búsqueda web.";
    }
}

async function captureScreen() {
    try {
        const timestamp = Date.now();
        const imgPath = path.join(__dirname, `screenshot_${timestamp}.jpg`);
        await screenshot({ filename: imgPath });
        const { data: { text } } = await Tesseract.recognize(imgPath, 'spa');
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        return text || "No pude leer nada en la pantalla.";
    } catch (e) {
        return "Error capturando pantalla.";
    }
}

async function readPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (e) {
        return "Error leyendo PDF.";
    }
}

async function readDOCX(filePath) {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || "Word vacío.";
    } catch (e) {
        return "Error leyendo Word.";
    }
}

function findAppLink(appName) {
    if (!appName) return null;
    const searchPaths = [
        path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
        path.join(process.env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs')
    ];
    appName = appName.toLowerCase();
    for (const startPath of searchPaths) {
        if (!fs.existsSync(startPath)) continue;
        const files = scanDirRecursive(startPath, '.lnk');
        const match = files.find(f => path.basename(f).toLowerCase().includes(appName));
        if (match) return match;
    }
    return null;
}

function scanDirRecursive(dir, ext) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(scanDirRecursive(fullPath, ext));
            } else if (file.toLowerCase().endsWith(ext)) {
                results.push(fullPath);
            }
        } catch(e) {}
    });
    return results;
}

function searchFiles(query, startDir) {
    let results = [];
    if (!fs.existsSync(startDir)) return results;
    const files = fs.readdirSync(startDir);
    for (const file of files) {
        const fullPath = path.join(startDir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (!['node_modules', 'AppData', 'Windows'].includes(file)) {
                    results = results.concat(searchFiles(query, fullPath));
                }
            } else if (file.toLowerCase().includes(query.toLowerCase())) {
                results.push(fullPath);
            }
            if (results.length > 5) break;
        } catch (e) {}
    }
    return results;
}

module.exports = {
    webSearch,
    captureScreen,
    readPDF,
    readDOCX,
    findAppLink,
    searchFiles
};

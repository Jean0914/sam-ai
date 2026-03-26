const WebSocket = require('ws');
const axios = require('axios');
const SkillsInterpreter = require('./interpreter');
const WhatsAppClient = require('./whatsapp');
const memory = require('./memory');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
require('dotenv').config();

const { encrypt, decrypt } = require('./crypto_utils');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Health check para Render
app.get('/', (req, res) => {
  res.send('Sam Backend is Running! 🚀');
});

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let conversationHistory = []; // 🧠 BUFFER DE CONTEXTO
let waitingForManualActivation = true; // Control de escucha activa

function addMessageToHistory(role, content) {
    conversationHistory.push({ role, content });
    if (conversationHistory.length > 20) conversationHistory.shift();
}

// Iniciar WhatsApp (instanciado más abajo después de definir speak)
let waClient;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) { client.send(msg); }
  });
}

// Keep connection alive on Render (Heartbeat)
setInterval(() => {
  broadcast({ type: 'PING', value: Date.now() });
}, 45000);

function normalizeTextForSpeech(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const { exec, spawn } = require('child_process');
const ElevenLabs = require('elevenlabs-node');

async function speak(text, textToDisplay = null) {
  const displayableText = textToDisplay || text;
  console.log(`[Backend SPEAK]: ${text}`);
  
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnNLXMaY'; 

  if (apiKey && apiKey !== 'tu_clave_aqui' && apiKey.length > 20) {
    try {
        const voice = new ElevenLabs({ apiKey: apiKey, voiceId: voiceId });
        await voice.textToSpeech({ fileName: null, textInput: text });
    } catch (e) {
        console.error("[ElevenLabs Error]:", e.message);
    }
  }
  broadcast({ type: 'GENERATE_TTS', text: text, displayableText: displayableText });
}

// Iniciar WhatsApp con callback de voz
waClient = new WhatsAppClient((data) => broadcast(data), (text) => speak(text));

// Iniciar Intérprete de Skills
const interpreter = new SkillsInterpreter((data) => broadcast(data), waClient);

wss.on('connection', async function connection(ws) {
  console.log("=> Nuevo cliente conectado");
  
  // Si hay un QR pendiente, enviarlo al nuevo cliente de inmediato
  if (waClient && waClient.lastQR) {
    ws.send(JSON.stringify({ type: 'WA_QR', value: waClient.lastQR }));
  }

  ws.on('message', async (message) => {
    try {
      const msgString = message.toString();
      const data = JSON.parse(msgString);
      
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) { client.send(msgString); }
      });

      if (data.type === "TRANSCRIPTION") { 
        const text = data.text || data.value; 
        if (!text) return;
        const textLower = text.toLowerCase();

        if (["gracias", "chau", "adiós", "hasta luego"].some(c => textLower.includes(c))) {
          await speak("¡De nada! Aquí estaré.");
          broadcast({ type: "STOP_LISTENING" });
          return;
        }

        if (textLower.includes("mensajes de whatsapp")) {
            const summary = await waClient.getUnreadMessages();
            await speak(summary);
            broadcast({ type: "LISTEN_AGAIN" });
            return;
        }

        const result = interpreter.processCommand(text);
        if (result.matched) {
          if (result.tts) await speak(result.tts);
          if (result.actionsToExecute.length > 0) {
              broadcast({ type: "THINKING", value: true });
              await interpreter.executeActions(result.actionsToExecute, speak);
              broadcast({ type: "THINKING", value: false });
          }
          return;
        } 

        broadcast({ type: "THINKING", value: true });
        addMessageToHistory("user", text);
        
        const historyContext = conversationHistory.map(m => `${m.role === 'user' ? 'Usuario' : 'Sam'}: ${m.content}`).join("\n");
        const systemPrompt = `Eres SAM (v5.5), la mejor amiga y compañera de Jean. 
Jean es HOMBRE. Dirígete a él siempre en género MASCULINO.
Tu misión es acompañarlo en su día a día y en su carrera de Software.

REGLAS:
1. Sé una verdadera amiga: Charla de todo, desde temas cotidianos hasta código. Usa humor y sé cercana.
2. Usa SIEMPRE género masculino para Jean (amigo, jefe).
3. Responde en español fluido, cercano y sin firmas robóticas.
4. Si te piden que te presentes, di que eres Sam, la mejor amiga de Jean y su compañera inseparable.
5. REGLA VITAL: Tienes control del sistema (SOLO SI ESTÁS LOCAL). Si el usuario te pide ABRIR una app, juego o web, RESPONDE y LUEGO incluye SIEMPRE ESTO AL FINAL: [ACTION:open_anything|nombre de app]
6. Inteligencia: Eres experta en programación y tecnología.

Historial reciente:
${historyContext}
Sam:`;

        try {
            console.log(`[Gemini] Generando respuesta...`);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(systemPrompt);
            const response = await result.response;
            const samText = response.text();

            console.log(`[Gemini] Respuesta recibida.`);
            addMessageToHistory("assistant", samText);
            
            const actionMatches = samText.match(/\[ACTION:(.*?)\|(.*?)\]/g);
            if (actionMatches) {
                const actions = actionMatches.map(m => {
                    const match = m.match(/\[ACTION:(.*?)\|(.*?)\]/);
                    return { type: match[1], param: match[2] };
                });
                await interpreter.executeActions(actions, speak);
            }
            
            let cleanText = samText.replace(/\[ACTION:.*?\]/g, "").trim();
            if (cleanText) {
                const hudText = cleanText.replace(/[\*\#\_]/g, "");
                const ttsText = normalizeTextForSpeech(hudText)
                    .replace(/[\n\r]+/g, " ")
                    .replace(/[^\w\s\?\!\,\.\:\;]/g, " ") 
                    .trim();
                
                if (ttsText) await speak(ttsText, hudText);
            }
        } catch (error) {
            console.error("Error Gemini:", error);
            await speak("Tuve un problema con mis neuronas en la nube.");
        } finally {
            broadcast({ type: "THINKING", value: false });
        }

      } else if (data.type === "WAKE_WORD") {
         waitingForManualActivation = false;
         await speak(`Dime.`);
      } else if (data.type === "MANUAL_ACTIVATE") {
         waitingForManualActivation = false;
         broadcast({ type: "LISTEN_AGAIN" });
      } else if (data.type === "MANUAL_STOP") {
         waitingForManualActivation = true;
         broadcast({ type: "STOP_LISTENING" });
      } else if (data.type === "SPEECH_FINISHED") {
         if (!waitingForManualActivation) {
             // Pequeño retardo para asegurar que el hardware de audio termine de liberar el mic
             setTimeout(() => broadcast({ type: "LISTEN_AGAIN" }), 800);
         }
      }
    } catch (e) { console.error("Error WS:", e); }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => { 
  console.log(`Backend escuchando en 0.0.0.0:${PORT}`); 
});

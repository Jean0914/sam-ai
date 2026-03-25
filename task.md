# Voice Assistant Development Tasks

## Fase 1: Mínimo Viable (MVP)
- [x] Inicializar proyecto Node.js (Backend) con Express y WebSockets
- [x] Configurar proyecto Python para procesamiento de voz (Wake Word + STT)
- [x] Integrar Porcupine para detección de Wake Word
- [x] Integrar sistema STT (entender comandos de voz después del wake word)
- [x] Crear servidor de WebSockets en Node.js para recibir transcripciones de Python
- [x] Implementar 2 comandos básicos en el Backend (Hardcoded por ahora):
  - [x] Comando: Saludo
  - [x] Comando: Abrir App (Usando `child_process`)

## Fase 2: Sistema de Skills y TTS
- [x] Diseñar el intérprete central (NLP básico o parseo de strings)
- [x] Implementar motor de lectura de archivos [.mds](file:///C:/Users/cjean/.gemini/antigravity/playground/core-kepler/nova-assistant/backend/skills/rutina_manana.mds) para las Skills
- [x] Crear Skill de "Rutina mañanera"
- [x] Integrar Text-to-Speech (TTS) (Coqui u otra opción para enviar respuestas audibles)
- [x] Mejorar el backend para ejecutar las acciones definidas en las Skills

## Fase 3: Interfaz Visual (Frontend)
- [x] Inicializar proyecto de React con Vite y TailwindCSS
- [x] Crear UI base: Dashboard, Estado del sistema, Glassmorphism y animaciones modernas
- [x] Conectar Frontend con Backend mediante WebSockets para mostrar transcripciones en tiempo real
- [x] Mover la funcionalidad TTS (`speechSynthesis`) al Frontend para evadir bloqueos de Windows
- [ ] Integración avanzada con otros programas (ej: Adobe) por scripts de automatización

## Fase 5: Voces Premium (Sin Claves API)
- [x] Implementar Selector de Voces en la UI
- [x] Optimizar uso de voces "Neural/Online" de Microsoft Edge (Gratis y Fluidas)
- [x] Forzar ejecución en Microsoft Edge para compatibilidad neural
- [x] Opcional: Soporte ElevenLabs (Desactivado por defecto para evitar errores)
- [x] Añadir control de 'Velocidad' y 'Tono' en la UI para personalización manual

## Fase 4: Inteligencia Artificial Local (Ollama) e Interfaz
- [x] Instalar Ollama y descargar modelo `llama3` (Usuario)
- [x] Integrar librería `ollama` en el Backend
- [x] Implementar fallback local hacia 127.0.0.1:11434
- [x] Añadir Selector de Voces en la Interfaz (Personalización)
- [x] Crear Lanzador Unificado (.bat) [FORZAR EDGE]
- [x] Crear Script de Inicio Silencioso (.vbs)
- [x] Configurar Arranque con Windows (Instrucción)
- [x] Automatización avanzada IoT con IA Local
- [x] Estabilización de Daemon de Voz y Sincronización VISUAL_SPEAK

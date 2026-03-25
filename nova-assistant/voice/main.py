import os
import sys
import json
import asyncio
import websockets
import pyaudio
import edge_tts
import pygame
import base64
import tempfile
import pyttsx3
from vosk import Model, KaldiRecognizer

WS_URI = "ws://localhost:8080"
VOSK_MODEL_PATH = "model"
TTS_VOICE = "es-MX-DaliaNeural"

import ctypes

def speak_offline(text):
    """Fallback local para cuando no hay internet"""
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        for v in voices:
            if "spanish" in v.name.lower() or "mexico" in v.name.lower():
                engine.setProperty('voice', v.id)
                break
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            temp_path = f.name
        engine.save_to_file(text, temp_path)
        engine.runAndWait()
        with open(temp_path, "rb") as f:
            audio_data = f.read()
        os.unlink(temp_path)
        return base64.b64encode(audio_data).decode('utf-8')
    except Exception as e:
        sys.stderr.write(f"Error en pyttsx3: {str(e)}\n")
        return None

async def generate_tts(text):
    if not text.strip(): return None
    audio_b64 = None
    try:
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        if audio_data:
            audio_b64 = base64.b64encode(audio_data).decode('utf-8')
    except Exception as e:
        sys.stderr.write(f"Edge TTS falló: {str(e)}\n")
    
    if not audio_b64:
        audio_b64 = speak_offline(text)
    return audio_b64

# Native Windows MP3 Playback (sin usar pygame para evitar bloqueos del driver de audio)
def play_audio(filename):
    try:
        abs_path = os.path.abspath(filename)
        # Limpiar cualquier reproducción anterior por si acaso
        ctypes.windll.winmm.mciSendStringW('close myaudio', None, 0, None)
        # Abrir archivo y reproducir esperando al final (wait)
        ctypes.windll.winmm.mciSendStringW(f'open "{abs_path}" type mpegvideo alias myaudio', None, 0, None)
        ctypes.windll.winmm.mciSendStringW('play myaudio wait', None, 0, None)
        ctypes.windll.winmm.mciSendStringW('close myaudio', None, 0, None)
    except Exception as e:
        print(f"Error nativo al reproducir audio: {e}")

class AssistantState:
    def __init__(self):
        self.is_listening_to_command = False
        self.is_sam_speaking = False
        self.silence_frames = 0.0

async def handle_tts(websocket, recognizer, state):
    async for message in websocket:
        try:
            data = json.loads(message)
            m_type = data.get("type")
            if m_type == "AUDIO":
                # Avisar que empezamos a hablar (silenciar micro)
                state.is_sam_speaking = True
                print("[Sam] Hablando... (Micro silenciado)")
            elif m_type == "LISTEN_AGAIN":
                # La IA o el Servidor nos pide volver a escuchar
                print("[Sam] Escuchando de nuevo...")
                await asyncio.sleep(0.5)
                state.is_sam_speaking = False
                state.is_listening_to_command = True
                state.silence_frames = 0.0
                recognizer.Reset()
            elif m_type == "STOP_LISTENING" or m_type == "SPEECH_FINISHED":
                # Sam terminó o se forzó stop
                state.is_sam_speaking = False
                print("[Sam] Silencio. (Micro reactivado)")
            elif m_type == "SPEAK":
                print(f"[Sam Dice]: {data.get('text')}")
            elif m_type == "GENERATE_TTS":
                # PROCESAR TTS RESIDENTE
                text_to_speak = data.get("text", "")
                display_text = data.get("displayableText", text_to_speak)
                
                print(f"[TTS Daemon] Generando audio para: {text_to_speak[:30]}...")
                audio_b64 = await generate_tts(text_to_speak)
                
                if audio_b64:
                    # Enviar el audio generado de vuelta al servidor (quien lo manda al Frontend)
                    await websocket.send(json.dumps({"type": "AUDIO", "audio": audio_b64}))
                    await websocket.send(json.dumps({"type": "SPEAK", "text": display_text}))
                    state.is_sam_speaking = True
                    print("[Sam] Hablando... (Micro auto-silenciado)")
        except Exception as e:
            print(f"Error procesando mensaje WS: {e}")

def get_audio_stream(pa, sample_rate):
    try:
        return pa.open(
            rate=sample_rate,
            channels=1,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=4000
        )
    except Exception as e:
        print(f"[Hardware Warning] No se pudo inicializar micrófono: {e}")
        return None

async def run_daemon():
    if not os.path.exists(VOSK_MODEL_PATH):
        print(f"Error: No se encontró modelo Vosk '{VOSK_MODEL_PATH}'.")
        return
        
    print("Cargando modelo de voz (Vosk)...")
    model = Model(VOSK_MODEL_PATH)
    sample_rate = 16000
    recognizer = KaldiRecognizer(model, sample_rate)
    recognizer.SetWords(False)

    pa = pyaudio.PyAudio()
    audio_stream = get_audio_stream(pa, sample_rate)

    print("--- Daemon de Voz Iniciado ---")
    state = AssistantState()

    while True:
        try:
            print(f"Conectando al servidor Node.js en {WS_URI}...")
            async with websockets.connect(WS_URI) as websocket:
                print("Conexión establecida con éxito.")
                print("\n>> Di 'Sam' para activar el asistente <<")
                
                asyncio.create_task(handle_tts(websocket, recognizer, state))
                
                while True:
                    # RECONEXIÓN DE MICRÓFONO (AUTO-RECOVERY)
                    if audio_stream is None or not audio_stream.is_active():
                        if audio_stream is not None:
                            try:
                                audio_stream.close()
                            except:
                                pass
                        print("[Hardware] Intentando reconectar micrófono en 2s...")
                        await asyncio.sleep(2)
                        audio_stream = get_audio_stream(pa, sample_rate)
                        if audio_stream is None:
                            continue
                        print("[Hardware] Micrófono reconectado exitosamente.")

                    # RECALIBRACIÓN: Purga profunda del buffer
                    if state.is_listening_to_command and state.silence_frames == 0.0:
                        try:
                            while audio_stream.get_read_available() > 2000:
                                audio_stream.read(audio_stream.get_read_available(), exception_on_overflow=False)
                            recognizer.Reset()
                        except:
                            pass

                    try:
                        pcm = await asyncio.to_thread(audio_stream.read, 2000, False)
                    except Exception as mic_e:
                        print(f"[Hardware Error] Micrófono desconectado o fallido: {mic_e}")
                        audio_stream = None
                        continue
                    
                    # SI SAM ESTÁ HABLANDO, IGNORAMOS EL PCM PARA NO AUTO-ACTIVARSE
                    if state.is_sam_speaking:
                        await asyncio.sleep(0.01)
                        continue

                    if recognizer.AcceptWaveform(pcm):
                        result_map = json.loads(recognizer.Result())
                        text = result_map.get("text", "")
                        
                        if state.is_listening_to_command and text:
                            print(f"[Transcripción]: '{text}'")
                            await websocket.send(json.dumps({"type": "TRANSCRIPTION", "text": text}))
                            state.is_listening_to_command = False
                        elif not state.is_listening_to_command and text:
                            text_check = text.lower()
                            if any(word in text_check for word in ["sam", "san", "sami", "sama", "zan", "zam"]):
                                print("\n[WAKE WORD] 'Sam' detectado (Final Result)!")
                                await websocket.send(json.dumps({"type": "WAKE_WORD", "keyword": "sam"}))
                                state.is_listening_to_command = True
                                state.is_sam_speaking = False
                                state.silence_frames = 0.0
                                print("> Escuchando comando...")
                                recognizer.Reset()
                            
                    else:
                        partial_map = json.loads(recognizer.PartialResult())
                        partial_text = partial_map.get("partial", "")
                        
                        if partial_text:
                            print(f"[DEBUG PARCIAL] {partial_text}")
                            
                        if not state.is_listening_to_command:
                            text_check = partial_text.lower()
                            if any(word in text_check for word in ["sam", "san", "sami", "sama", "zan", "zam"]):
                                print("\n[WAKE WORD] 'Sam' detectado (Partial)!")
                                await websocket.send(json.dumps({"type": "WAKE_WORD", "keyword": "sam"}))
                                state.is_listening_to_command = True
                                state.is_sam_speaking = False # Por si acaso
                                state.silence_frames = 0.0
                                print("> Escuchando comando...")
                                recognizer.Reset()
                        else:
                            # Debug log cada cierto tiempo para ver que el micro recibe algo
                            if state.silence_frames % 5 == 0:
                                print(".", end="", flush=True) 
                            state.silence_frames += 0.25
                            if state.silence_frames > 15.0: # Más tiempo
                                print("\n[TIMEOUT] Sin voz detectada.")
                                state.is_listening_to_command = False
                                recognizer.Reset()
                                state.silence_frames = 0.0
                    await asyncio.sleep(0.01)
                    
        except Exception as e:
            print(f"Error de conexión: {e}. Reintentando en 5 segundos...")
            await asyncio.sleep(5)


if __name__ == '__main__':
    # Fix for Windows asyncio loop with edges_tts
    if sys.platform.startswith('win'):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_daemon())

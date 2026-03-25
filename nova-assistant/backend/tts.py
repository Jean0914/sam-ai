import asyncio
import edge_tts
import sys
import base64
import os
import tempfile
import pyttsx3

def speak_offline(text):
    """Fallback local para cuando no hay internet"""
    try:
        engine = pyttsx3.init()
        # Intentar obtener voz femenina en español
        voices = engine.getProperty('voices')
        for v in voices:
            if "spanish" in v.name.lower() or "mexico" in v.name.lower():
                engine.setProperty('voice', v.id)
                break
        
        # Guardar a un archivo temporal y luego leerlo como base64
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

async def amain():
    if len(sys.argv) > 1:
        text = sys.argv[1]
    else:
        text = sys.stdin.read()
        
    if not text.strip():
        return
        
    audio_b64 = None
    
    # INTENTO 1: Edge TTS (Online - Calidad Premium)
    try:
        voice = "es-MX-DaliaNeural"
        communicate = edge_tts.Communicate(text, voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        
        if audio_data:
            audio_b64 = base64.b64encode(audio_data).decode('utf-8')
    except Exception as e:
        sys.stderr.write(f"Edge TTS falló (posible falta de internet): {str(e)}. Usando fallback offline...\n")
    
    # INTENTO 2: pyttsx3 (Offline - Calidad Estándar)
    if not audio_b64:
        audio_b64 = speak_offline(text)
        
    if audio_b64:
        print(audio_b64)

if __name__ == "__main__":
    asyncio.run(amain())

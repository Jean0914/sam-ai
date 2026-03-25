import cv2
import json
import asyncio
import websockets

WS_URI = "ws://localhost:8080"
MIN_CONTOUR_AREA = 1000

async def run_camera():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: No se pudo acceder a la cámara web Ocular.")
        return

    print("--- Daemon Ocular (OpenCV) Iniciado ---")
    print("Conectando al servidor Node.js...")

    try:
        async with websockets.connect(WS_URI) as websocket:
            print("Conexión visual establecida con el cerebro.")
            
            first_frame = None
            motion_cooldown = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Convert to grayscale and blur
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                gray = cv2.GaussianBlur(gray, (21, 21), 0)

                # Initialize first frame
                if first_frame is None:
                    first_frame = gray
                    continue

                # Compute difference between current frame and first frame
                frame_delta = cv2.absdiff(first_frame, gray)
                thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]

                # Dilate to fill in holes, then find contours
                thresh = cv2.dilate(thresh, None, iterations=2)
                contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                motion_detected = False
                for contour in contours:
                    if cv2.contourArea(contour) < MIN_CONTOUR_AREA:
                        continue
                    motion_detected = True
                    break

                if motion_detected:
                    if motion_cooldown <= 0:
                        print("[Ocular]: ¡Movimiento detectado!")
                        await websocket.send(json.dumps({"type": "MOTION_ALERT", "value": True}))
                        motion_cooldown = 150  # Frames cooldown (~5 seconds at 30fps)
                
                if motion_cooldown > 0:
                    motion_cooldown -= 1

                # To avoid blocking the event loop and consuming 100% CPU
                await asyncio.sleep(0.03)

                # Update background model slowly for gradual light changes
                cv2.accumulateWeighted(gray, first_frame.astype("float"), 0.05)
                first_frame = cv2.convertScaleAbs(first_frame)

    except ConnectionRefusedError:
        print("Error: No se pudo conectar al servidor. El cerebro no está activo.")
    except Exception as e:
         print(f"Error en Daemon Visual: {e}")
    finally:
        cap.release()

if __name__ == '__main__':
    # No cv2.imshow to keep it headless and non-intrusive
    asyncio.run(run_camera())

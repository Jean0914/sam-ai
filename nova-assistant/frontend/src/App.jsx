import { useEffect, useState, useRef } from 'react';

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [status, setStatus] = useState('DORMIDO');
  const [transcription, setTranscription] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [upTime, setUpTime] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setUpTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const wsRef = useRef(null);

  useEffect(() => {
    if (hasStarted) connectWebSocket();
    return () => wsRef.current?.close();
  }, [hasStarted]);

  const connectWebSocket = () => {
    const host = window.location.hostname;
    // Si estamos en local (localhost o IP), usamos el puerto 8080. 
    // Si no, asumimos que es la URL de producción en Render.
    const isLocal = host === 'localhost' || host.match(/^\d+\.\d+\.\d+\.\d+$/);
    const wsHost = isLocal ? `${host}:8080` : 'sam-ai-wgic.onrender.com'; 
    const protocol = isLocal ? 'ws:' : 'wss:';
    
    console.log(`[Dashboard] Connecting to ${protocol}//${wsHost}`);
    const ws = new WebSocket(`${protocol}//${wsHost}`);
    wsRef.current = ws;

    ws.onopen = () => console.log('[Dashboard] Conectado a Sam en la nube');
    ws.onerror = (err) => console.error('[Dashboard] Error de conexión:', err);
    ws.onmessage = async (e) => {
      try {
        let data = e.data;
        if (data instanceof Blob) data = await data.text();
        const msg = JSON.parse(data);
        
        if (msg.type === 'WAKE_WORD') { setStatus('ESCUCHANDO'); setTranscription('...'); }
        else if (msg.type === 'TRANSCRIPTION') { setTranscription(msg.text); setMsgCount(c => c + 1); }
        else if (msg.type === 'THINKING') { setStatus(msg.value ? 'PROCESANDO' : 'ESCUCHANDO'); }
        else if (msg.type === 'SPEAK') { 
          setLastAction(msg.text); 
          setMsgCount(c => c + 1); 
          // speak(msg.text); // DESACTIVADO: La voz principal es la recibida por 'AUDIO' (Edge TTS)
        }
        else if (msg.type === 'AUDIO') { playAudio(msg.audio); }
        else if (msg.type === 'WA_QR') { setQrCode(msg.value); }
        else if (msg.type === 'WA_READY') { setQrCode(null); }
      } catch (err) { console.error(err); }
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
  };

  const playAudio = (base64) => {
    setStatus('HABLANDO');
    const audio = new Audio("data:audio/mpeg;base64," + base64);
    audio.onended = () => {
      setStatus('DORMIDO');
      wsRef.current?.send(JSON.stringify({ type: 'SPEECH_FINISHED' }));
    };
    audio.play();
  };

  const handleSend = () => {
    if (!inputVal) return;
    wsRef.current?.send(JSON.stringify({ type: 'TRANSCRIPTION', text: inputVal }));
    setInputVal('');
  };

  const toggleMic = () => {
    const type = status === 'DORMIDO' ? 'MANUAL_ACTIVATE' : 'MANUAL_STOP';
    wsRef.current?.send(JSON.stringify({ type }));
    setStatus(status === 'DORMIDO' ? 'ESCUCHANDO' : 'DORMIDO');
  };

  if (!hasStarted) {
    return (
      <div className="dashboard-container flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div className="orb-container mb-12 cursor-pointer group" onClick={() => setHasStarted(true)}>
             <div className="orb-ring ring-outer opacity-30 group-hover:opacity-100 transition-opacity" />
             <div className="orb-ring ring-inner opacity-30 group-hover:opacity-100 transition-opacity" />
             <div className="orb-core group-hover:scale-110" />
             <div className="absolute inset-0 flex items-center justify-center text-white/20 group-hover:text-cyan-400 group-hover:animate-pulse transition-all">
               <span className="text-xs tracking-[1em] translate-x-2">AWAKEN</span>
             </div>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-cyan-400 mb-2 tracking-tighter">SAM <span className="text-white/10 uppercase">v2.5</span></h1>
            <p className="text-white/30 uppercase tracking-[0.5em] text-[10px]">Professional Hybrid Brain</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* SIDE-BY-SIDE DIALOGUE HUD */}
      <div className="fixed inset-0 flex items-center justify-between px-10 pointer-events-none">
        {/* USER SIDE - Solo el box tiene pointer-events auto en CSS */}
        {/* USER SIDE */}
        <div className="dialogue-box user-side">
          <div className="side-label">YOU SAID</div>
          <div className="side-text">{transcription || "..."}</div>
        </div>

        {/* SAM SIDE */}
        <div className="dialogue-box sam-side">
          <div className="side-label">SAM REPLIED</div>
          <div className="side-text">{lastAction || "..."}</div>
        </div>
      </div>

      {/* CENTRAL ORB AREA */}
      <div className="orb-container relative z-10">
        <div className={`orb-core ${status === 'HABLANDO' ? 'speaking' : ''}`} />
      </div>

      {/* TITLES */}
      <div className="status-title">VOICE MODE</div>
      <div className="status-subtitle">
        {status === 'ESCUCHANDO' ? 'Listening...' : status === 'HABLANDO' ? 'Speaking...' : 'Ready'}
      </div>

      {/* MODE BUTTONS */}
      <div className="modes-row">
        <button className="mode-btn btn-agent">
          <span className="text-lg">🕒</span> AGENT MODE
        </button>
        <button className="mode-btn btn-chat">
          <span className="text-lg">🎙️</span> CHAT MODE
        </button>
      </div>

      {/* WAKE TOGGLE */}
      <div className="toggle-row">
        <span>WAKE - VOICE</span>
        <div 
          className={`switch ${status === 'ESCUCHANDO' ? 'active' : ''}`} 
          onClick={toggleMic}
        />
      </div>

      {/* WAVEFORM */}
      <div className="waveform-container">
        {[...Array(30)].map((_, i) => (
          <div 
            key={i} 
            className={`wave-bar ${status === 'ESCUCHANDO' || status === 'HABLANDO' ? 'active' : ''}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>

      {/* STATS FOOTER */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-value">{formatTime(upTime)}</span>
          <span className="stat-label">UPTIME</span>
        </div>
        <div className="divider" />
        <div className="stat-item">
          <span className="stat-value">{msgCount}</span>
          <span className="stat-label">MESSAGES</span>
        </div>
      </div>
      
      {/* INVISIBLE INPUT FOR COMMANDS */}
      <div className="fixed bottom-0 opacity-0 pointer-events-none">
        <input 
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
      </div>
    </div>
  );
}

export default App;

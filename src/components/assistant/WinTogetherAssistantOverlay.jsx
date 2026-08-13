import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X, Minimize2, LoaderCircle } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { confirmAssistantAction, processAssistantCommand } from '../../lib/assistant/engine';

const SUGGESTIONS = [
  'Aaj ki total sale kitni hai?',
  'Tata Salt ka stock kitna hai?',
  'Rahul Sharma ka balance batao.',
  'Inventory mein Tata Salt add karo, quantity 50.',
  'Rahul ke naam ka bill banao, 2 Maggi aur 3 Coke.',
  'Low stock products dikhao.',
];

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function statusLabel(status) {
  switch (status) {
    case 'listening':
      return 'Listening';
    case 'processing':
      return 'Processing';
    case 'responding':
      return 'Responding';
    case 'confirmation':
      return 'Confirmation Required';
    case 'executing':
      return 'Executing';
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

export default function WinTogetherAssistantOverlay({ open, onClose, onMinimize }) {
  const app = useApp();
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const sourceRef = useRef('text');
  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState('');
  const [responseText, setResponseText] = useState('');
  const [history, setHistory] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const assistantApi = useMemo(() => ({
    state: app.state,
    addProduct: app.addProduct,
    updateProduct: app.updateProduct,
    addCustomer: app.addCustomer,
    updateCustomer: app.updateCustomer,
    completeSale: app.completeSale,
  }), [app]);

  useEffect(() => {
    if (!open) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setPendingAction(null);
      setStatus('idle');
      return;
    }

    const Recognition = getSpeechRecognition();
    setSpeechSupported(Boolean(Recognition));
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setResponseText('');
    };

    recognition.onresult = (event) => {
      const spoken = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      transcriptRef.current = spoken;
      setTranscript(spoken);
      setDraft(spoken);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatus('error');
      setResponseText('I could not hear that clearly. Please try again.');
    };

    recognition.onend = async () => {
      setIsListening(false);
      const spoken = transcriptRef.current.trim();
      if (spoken) {
        await handleCommand(spoken, sourceRef.current || 'voice');
      } else if (open) {
        setStatus('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [open, assistantApi]);

  useEffect(() => {
    if (
      !voiceEnabled
      || !responseText
      || typeof window === 'undefined'
      || !['success', 'error', 'confirmation'].includes(status)
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(responseText);
    utterance.lang = 'hi-IN';
    const shouldRestoreConfirmation = status === 'confirmation';
    setStatus((current) => (current === 'success' || current === 'error' || current === 'confirmation' ? 'responding' : current));
    utterance.onend = () => {
      setStatus((current) => {
        if (current !== 'responding') {
          return current;
        }
        return shouldRestoreConfirmation ? 'confirmation' : 'success';
      });
    };
    window.speechSynthesis.speak(utterance);
  }, [responseText, status, voiceEnabled]);

  const pushHistory = (command, reply, nextStatus) => {
    setHistory((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        command,
        reply,
        status: nextStatus,
        timestamp: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 12));
  };

  async function handleCommand(command, source = 'text') {
    if (!command.trim()) {
      return;
    }

    sourceRef.current = source;
    transcriptRef.current = command;
    setTranscript(command);
    setDraft(command);
    setPendingAction(null);
    setStatus('processing');
    setResponseText('Understanding your request...');

    const result = await processAssistantCommand({
      command,
      source,
      app: assistantApi,
    });

    if (result.status === 'confirmation') {
      setPendingAction(result.pendingAction);
      setStatus('confirmation');
      setResponseText(result.responseText);
      pushHistory(command, result.responseText, 'confirmation');
      return;
    }

    setStatus(result.status === 'success' ? 'success' : 'error');
    setResponseText(result.responseText);
    pushHistory(command, result.responseText, result.status);
  }

  const startListening = () => {
    if (!recognitionRef.current || isListening) {
      return;
    }
    transcriptRef.current = '';
    setTranscript('');
    setDraft('');
    sourceRef.current = 'voice';
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (!recognitionRef.current || !isListening) {
      return;
    }
    recognitionRef.current.stop();
  };

  const handleConfirm = async () => {
    if (!pendingAction) {
      return;
    }

    setStatus('executing');
    const currentCommand = transcript || draft;
    const result = await confirmAssistantAction({
      pendingAction,
      command: currentCommand,
      source: sourceRef.current || 'text',
    });

    setPendingAction(null);
    setStatus(result.status === 'success' ? 'success' : 'error');
    setResponseText(result.responseText);
    pushHistory(currentCommand, result.responseText, result.status);
  };

  const handleCancel = () => {
    setPendingAction(null);
    setStatus('idle');
    setResponseText('Okay, I cancelled that action.');
  };

  if (!open) {
    return null;
  }

  return (
    <div className="assistant-overlay">
      <div className="assistant-shell">
        <div className="assistant-sidebar-panel">
          <div className="assistant-brand-row">
            <div className="assistant-brand-icon"><Bot size={22} /></div>
            <div>
              <div className="assistant-title">WinTogether AI</div>
              <div className="assistant-subtitle">Your smart business assistant</div>
            </div>
          </div>

          <div className="assistant-status-block">
            <div className="assistant-status-label">Current State</div>
            <div className={`assistant-status-pill assistant-status-${status}`}>{statusLabel(status)}</div>
          </div>

          <div className="assistant-suggestion-list">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                className="assistant-suggestion-btn"
                onClick={() => handleCommand(suggestion, 'text')}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="assistant-main-panel">
          <div className="assistant-topbar">
            <div>
              <div className="assistant-topbar-title">Talk to WinTogether AI</div>
              <div className="assistant-topbar-subtitle">Speak naturally in Hindi, English, or Hinglish</div>
            </div>
            <div className="assistant-topbar-actions">
              <button className="btn btn-ghost btn-sm" onClick={onMinimize || onClose}>
                <Minimize2 size={16} /> Minimize
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                <X size={16} /> Close
              </button>
            </div>
          </div>

          <div className="assistant-live-card">
            <div className="assistant-live-header">
              <div>
                <div className="assistant-live-title">Live Conversation</div>
                <div className="assistant-live-subtitle">
                  {status === 'processing' ? 'Understanding your request...' : status === 'executing' ? 'Executing your request...' : 'You can speak or type below.'}
                </div>
              </div>
              <div className="assistant-control-row">
                <button
                  className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
                  onClick={isListening ? stopListening : startListening}
                  disabled={!speechSupported}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  {isListening ? 'Stop Listening' : 'Start Listening'}
                </button>
                <button className="btn btn-ghost" onClick={() => setVoiceEnabled((current) => !current)}>
                  {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  {voiceEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
                </button>
              </div>
            </div>

            {!speechSupported && (
              <div className="assistant-info-banner">
                Voice recognition is not available in this browser. You can still use text commands.
              </div>
            )}

            <div className="assistant-transcript-card">
              <div className="assistant-label">You said</div>
              <div className="assistant-transcript-text">{transcript || 'Your transcript will appear here.'}</div>
            </div>

            <div className="assistant-response-card">
              <div className="assistant-label">WinTogether AI</div>
              <div className="assistant-response-text">
                {status === 'processing' || status === 'executing' ? (
                  <span className="assistant-inline-loader"><LoaderCircle size={16} className="assistant-spin" /> {responseText}</span>
                ) : (
                  responseText || 'Ask about sales, stock, customers, billing, or reminders.'
                )}
              </div>
            </div>

            {pendingAction && (
              <div className="assistant-confirm-card">
                <div className="assistant-label">WinTogether AI understood</div>
                <div className="assistant-confirm-text">{responseText}</div>
                <div className="assistant-confirm-actions">
                  <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleConfirm}>Confirm & Execute</button>
                </div>
              </div>
            )}

            <div className="assistant-input-row">
              <input
                className="form-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleCommand(draft, 'text');
                  }
                }}
                placeholder="Type a command like 'Aaj ki sale batao'"
              />
              <button className="btn btn-primary" onClick={() => handleCommand(draft, 'text')}>
                <Send size={16} /> Send
              </button>
            </div>
          </div>

          <div className="assistant-history-card">
            <div className="assistant-history-title">Recent Conversation</div>
            {history.length === 0 ? (
              <div className="assistant-history-empty">No conversation yet. Start with a voice or text command.</div>
            ) : (
              <div className="assistant-history-list">
                {history.map((entry) => (
                  <div key={entry.id} className="assistant-history-item">
                    <div className="assistant-history-user">You: {entry.command}</div>
                    <div className="assistant-history-ai">WinTogether AI: {entry.reply}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

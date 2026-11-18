'use client';

import { ArrowUp, Camera, CameraOff, CircleHelp, LockKeyhole, Mic, RotateCcw, Smile, Sparkles, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { type ChatMessage, type ChatMode } from '@/lib/chat';
import { localPreview } from '@/lib/config';
import { readLocal, writeLocal } from '@/lib/browser-store';
import { GuruFace, type Expression } from './icons';
import { Modal } from './modal';
import { useStudent } from './student';

const suggestions = ['How do ferns unfurl?', 'Why do monarchs migrate?', 'What do wetlands do?'];

type SpeechInput = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechInput; webkitSpeechRecognition?: new () => SpeechInput };
const previewKey = 'cellula.guru-preview.v1';
const previewHeader = 'x-cellula-preview-guest';
function previewGuestHeaders() {
  const headers: Record<string, string> = {};
  if (localPreview) headers[previewHeader] = readLocal(previewKey, '') || 'new';
  return headers;
}
function rememberPreviewGuest(token: unknown) {
  if (localPreview && typeof token === 'string' && token.length < 100) writeLocal(previewKey, token);
}
let modelLoaded: Promise<typeof import('@vladmandic/face-api')> | undefined;

async function faceModel() {
  modelLoaded ||= import('@vladmandic/face-api').then(async api => {
    // CPU inference is small and avoids GPU requirements on older devices.
    const tensorflow = api.tf as unknown as { setBackend: (name: string) => Promise<boolean>; ready: () => Promise<void> };
    await tensorflow.setBackend('cpu');
    await tensorflow.ready();
    await api.nets.tinyFaceDetector.loadFromUri('/face-model');
    return api;
  }).catch(error => { modelLoaded = undefined; throw error; });
  return modelLoaded;
}

export function GuruWidget() {
  const { user, setPanel } = useStudent();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode | 'checking'>('checking');
  const [remaining, setRemaining] = useState<number | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [failure, setFailure] = useState('');
  const [reaction, setReaction] = useState<Expression>('calm');
  const [camera, setCamera] = useState(false);
  const [cameraNote, setCameraNote] = useState('');
  const [present, setPresent] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceInput, setVoiceInput] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [cameraSupported, setCameraSupported] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const conversation = useRef(0);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speech = useRef<SpeechInput | null>(null);
  const expression: Expression = pending ? 'thinking' : reaction !== 'calm' ? reaction : present ? 'aware' : 'calm';

  useEffect(() => {
    const browser = window as SpeechWindow;
    setVoiceInput(!!(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    setVoiceOutput('speechSynthesis' in browser && 'SpeechSynthesisUtterance' in browser);
    setCameraSupported(!!navigator.mediaDevices?.getUserMedia);
    return () => { clearTimeout(reactionTimer.current); speech.current?.abort(); };
  }, []);

  useEffect(() => {
    conversation.current++;
    setMessages([]);
    setDraft('');
    setFailure('');
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    setMode('checking');
    setRemaining(undefined);
    const controller = new AbortController();
    void fetch('/api/chat', { signal: controller.signal, cache: 'no-store', headers: previewGuestHeaders() }).then(async response => {
      const data = await response.json();
      if (controller.signal.aborted) return;
      rememberPreviewGuest(data.previewGuest);
      setMode(data.mode || 'offline');
      setRemaining(data.remaining);
    }).catch(() => { if (!controller.signal.aborted) setMode('offline'); });
    return () => controller.abort();
  }, [open, user?.id]);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, pending, open]);

  useEffect(() => {
    if (!open || !camera) return;
    let active = true;
    let media: MediaStream | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const onHidden = () => { if (document.hidden) { setCamera(false); setPresent(false); setCameraNote('Camera off.'); } };
    document.addEventListener('visibilitychange', onHidden);
    const stop = () => {
      active = false;
      document.removeEventListener('visibilitychange', onHidden);
      clearTimeout(timeout);
      media?.getTracks().forEach(track => track.stop());
      video.pause();
      video.srcObject = null;
    };
    setCameraNote('Waiting for camera permission…');
    void (async () => {
      try {
        media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } } });
        if (!active) { media.getTracks().forEach(track => track.stop()); return; }
        media.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (active) { setCamera(false); setCameraNote('Camera stopped.'); } }, { once: true }));
        setCameraNote('Camera on · only in this browser');
        video.srcObject = media;
        await video.play();
        const api = await faceModel();
        if (!active) return;
        const check = async () => {
          if (!active) return;
          try {
            const visible = await api.detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.55 }));
            if (!active) return;
            setPresent(!!visible);
            timeout = setTimeout(check, 1000);
          } catch {
            if (active) { setCameraNote('Face detection is unavailable on this device.'); setCamera(false); }
          }
        };
        void check();
      } catch {
        if (active) { setCameraNote('Camera couldn’t start. You can still use the reaction buttons.'); setCamera(false); }
      }
    })();
    return () => { stop(); };
  }, [camera, open]);

  function close() {
    setOpen(false);
    setCamera(false);
    setPresent(false);
    setCameraNote('');
    speech.current?.abort();
    speech.current = null;
    setListening(false);
    if (voiceOutput) window.speechSynthesis.cancel();
  }

  function respondWith(next: Expression) {
    clearTimeout(reactionTimer.current);
    setReaction(next);
    reactionTimer.current = setTimeout(() => setReaction('calm'), 3400);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending.current || remaining === undefined || remaining === 0 || mode === 'offline' || mode === 'checking') return;
    sending.current = true;
    const generation = conversation.current;
    setFailure('');
    setPending(text);
    const question: ChatMessage = { role: 'user', content: text };
    const history = [...messages.slice(-8), question];
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...previewGuestHeaders() }, body: JSON.stringify({ messages: history }), signal: AbortSignal.timeout(27_000) });
      const data = await response.json();
      if (generation !== conversation.current) return;
      rememberPreviewGuest(data.previewGuest);
      if (data.remaining === null || typeof data.remaining === 'number') setRemaining(data.remaining);
      if (!response.ok || typeof data.text !== 'string') { setFailure(data.error || 'Guru Jee couldn’t answer right now.'); return; }
      setMessages(old => [...old.slice(-58), question, { role: 'assistant', content: data.text }]);
      setDraft('');
      respondWith('happy');
    } catch { if (generation === conversation.current) setFailure('Connection interrupted. Wait a moment before you retry.'); }
    finally { sending.current = false; setPending(''); }
  }

  function dictate() {
    if (listening) { speech.current?.stop(); return; }
    const browser = window as SpeechWindow;
    const Speech = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Speech) return;
    try {
      const recognizer = new Speech();
      recognizer.lang = navigator.language || 'en-IN';
      recognizer.interimResults = false;
      recognizer.continuous = false;
      recognizer.onresult = (event) => { const text = event.results[0]?.[0]?.transcript; if (text) setDraft(previous => `${previous}${previous ? ' ' : ''}${text}`.slice(0, 1200)); };
      recognizer.onerror = () => { setVoiceNote('Voice typing couldn’t start. You can still type a question.'); setListening(false); };
      recognizer.onend = () => setListening(false);
      speech.current = recognizer;
      recognizer.start();
      setVoiceNote('Listening… Your browser may process speech online.');
      setListening(true);
    } catch { setVoiceNote('Voice typing isn’t available right now.'); setListening(false); }
  }

  function readAloud(text: string) {
    if (!voiceOutput) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0900-\u097f]/.test(text) ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.speak(utterance);
  }

  const blocked = remaining === 0;
  const waiting = mode === 'checking';
  const inactive = waiting || mode === 'offline' || blocked || !!pending;
  return <>
    <button className="guru-launcher" type="button" aria-label="Open Guru Jee study assistant" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <GuruFace expression={expression} />
      <span className="guru-launcher-copy"><strong>Guru Jee</strong><span><i aria-hidden="true" /> Study assistant</span></span>
      <Sparkles className="guru-launcher-spark" size={15} aria-hidden="true" />
    </button>
    {open && <Modal title="Guru Jee" className="guru-dialog" onClose={close} leading={<GuruFace expression={expression} />}>
      <div className="guru-status"><span><i aria-hidden="true" />{waiting ? 'Connecting…' : mode === 'live' ? 'Live · Life science tutor' : mode === 'practice' ? 'Practice mode · Life science tutor' : 'Tutor is offline'}</span>
        {camera && <small className="guru-camera-tag">{cameraNote.startsWith('Camera on') ? 'Camera on' : 'Starting camera'}</small>}
        <button type="button" className="icon-button reset-chat" disabled={!!pending || !messages.length} title="Clear conversations, not your message limit" aria-label="Clear conversation" onClick={() => { setMessages([]); setDraft(''); setFailure(''); }}><RotateCcw size={15} /></button></div>
      <div className="guru-discussion" ref={scroll} role="log" aria-label="Study conversation" aria-live="polite">
        <div className="guru-welcome"><p>Namaste! I’m Guru Jee, your life science study buddy. What are we learning today?</p></div>
        {!messages.length && !pending && !blocked && <div className="guru-suggestions">{suggestions.map(question => <button key={question} type="button" onClick={() => { setDraft(question); input.current?.focus(); }} disabled={inactive}>{question}</button>)}</div>}
        {messages.map((message, index) => <div key={index} className={`guru-message guru-message-${message.role}`}>
          <p>{message.content}</p>{message.role === 'assistant' && voiceOutput && <button className="icon-button" type="button" aria-label="Read answer aloud" title="Read answer aloud" onClick={() => readAloud(message.content)}><Volume2 size={16} /></button>}
        </div>)}
        {pending && <><div className="guru-message guru-message-user"><p>{pending}</p></div><p className="guru-typing">Guru Jee is thinking<span>…</span></p></>}
      </div>
      <div className="guru-controls">
        {!!messages.length && <div className="reaction-row"><button type="button" onClick={() => respondWith('happy')}><Smile size={14} /> Got it</button><button type="button" disabled={inactive} onClick={() => { respondWith('thinking'); setDraft('Could you explain that more simply?'); input.current?.focus(); }}><CircleHelp size={14} /> Explain simply</button></div>}
        {failure && <p className="form-error" role="alert">{failure}</p>}
        {blocked ? <div className="guru-limit"><LockKeyhole size={19} /><div><strong>Both guest messages used</strong><p>Sign in to keep asking study questions.</p></div><button className="button button-primary" type="button" onClick={() => { close(); setPanel('sign-in'); }}>Sign in</button></div>
          : <form className="guru-form" onSubmit={send}>
            <div className="guru-input"><textarea ref={input} aria-label="Ask a life science question" placeholder={mode === 'offline' ? 'Study help is unavailable' : 'Ask a study question…'} rows={1} maxLength={1200} value={draft} disabled={inactive} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
              {voiceInput && <button className="icon-button" type="button" onClick={dictate} disabled={inactive} aria-pressed={listening} aria-label={listening ? 'Stop voice typing' : 'Start voice typing'} title="Voice typing uses your browser’s speech service"><Mic size={18} /></button>}
              <button className="guru-send button button-primary" type="submit" aria-label="Send message" disabled={inactive || !draft.trim()}><ArrowUp size={20} /></button></div>
            {voiceNote && <p className="form-hint">{listening ? voiceNote : voiceNote.startsWith('Listening') ? 'Voice typing stopped.' : voiceNote}</p>}
          </form>}
        <div className="guru-privacy"><span>{typeof remaining === 'number' ? `${remaining}/2 guest messages left` : remaining === null ? 'Signed in · no guest limit' : 'Study questions only'}</span>
          <details><summary><Camera size={14} /> Camera & privacy</summary><div className="camera-options"><p>Optional camera reactions only notice whether a face is present. No identity, emotion, images, or video are saved or sent. Camera turns off when you close Guru Jee or leave the tab.</p>
            {cameraSupported && <button type="button" className="button button-outline" aria-pressed={camera} onClick={() => { if (camera) { setPresent(false); setCameraNote('Camera off.'); } setCamera(!camera); }}>{camera ? <CameraOff size={16} /> : <Camera size={16} />}{camera ? 'Turn off camera' : 'Enable camera'}</button>}
            <p role="status">{cameraSupported ? cameraNote : 'Camera is unavailable in this browser or preview.'}</p></div></details></div>
      </div>
    </Modal>}
  </>;
}

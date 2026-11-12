const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const listenBtn = document.getElementById('listenBtn');
const recordBtn = document.getElementById('recordBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const dlTxtBtn = document.getElementById('dlTxtBtn');
const dlAudioBtn = document.getElementById('dlAudioBtn');
const canvas = document.getElementById('wave');
const ctx = canvas.getContext('2d');

let recognition = null;
let listening = false;
let mediaRecorder = null;
let audioChunks = [];
let recording = false;
let audioContext = null;
let analyser = null;
let source = null;
let animationId = null;
let lastTranscript = localStorage.getItem('verse-f660-transcript') || '';

transcriptEl.value = lastTranscript;

function setStatus(msg) { statusEl.textContent = msg; }

function saveTranscript() {
  localStorage.setItem('verse-f660-transcript', transcriptEl.value);
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    const base = transcriptEl.value.replace(/\s+$/, '');
    if (final) {
      transcriptEl.value = (base + ' ' + final).trim() + ' ';
      saveTranscript();
    }
    setStatus(interim ? `Listening… ${interim}` : 'Listening…');
  };

  recognition.onerror = (e) => setStatus('Speech error: ' + e.error);
  recognition.onend = () => {
    if (listening) recognition.start();
  };
} else {
  setStatus('Speech recognition not supported in this browser. Recording still works; type notes manually.');
  listenBtn.disabled = true;
}

listenBtn.onclick = () => {
  if (!recognition) return;
  if (listening) {
    listening = false;
    recognition.stop();
    listenBtn.textContent = 'Start listening';
    setStatus('Stopped listening.');
  } else {
    listening = true;
    recognition.start();
    listenBtn.textContent = 'Stop listening';
    setStatus('Listening… speak now.');
  }
};

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      dlAudioBtn.disabled = audioChunks.length === 0;
      setStatus('Recording stopped.');
    };
    mediaRecorder.start();
    recording = true;
    recordBtn.textContent = 'Stop recording';
    setStatus('Recording…');

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    drawWave();
  } catch (err) {
    setStatus('Mic access denied or error: ' + err.message);
  }
}

function stopRecording() {
  if (mediaRecorder && recording) {
    mediaRecorder.stop();
    recording = false;
    recordBtn.textContent = 'Start recording';
    if (animationId) cancelAnimationFrame(animationId);
    if (audioContext) audioContext.close();
  }
}

recordBtn.onclick = () => {
  if (recording) stopRecording();
  else startRecording();
};

function drawWave() {
  if (!analyser) return;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0f0';
  ctx.beginPath();
  const sliceWidth = canvas.width / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * canvas.height / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  animationId = requestAnimationFrame(drawWave);
}

clearBtn.onclick = () => {
  transcriptEl.value = '';
  saveTranscript();
  setStatus('Cleared.');
};

copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(transcriptEl.value);
    setStatus('Copied to clipboard.');
  } catch {
    transcriptEl.select();
    document.execCommand('copy');
    setStatus('Selected for copy.');
  }
};

dlTxtBtn.onclick = () => {
  const blob = new Blob([transcriptEl.value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'voice-note.txt';
  a.click();
  URL.revokeObjectURL(a.href);
};

dlAudioBtn.onclick = () => {
  if (audioChunks.length === 0) return;
  const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'voice-note.' + (blob.type.includes('webm') ? 'webm' : 'audio');
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('Audio downloaded (browser-native format).');
};

transcriptEl.addEventListener('input', saveTranscript);

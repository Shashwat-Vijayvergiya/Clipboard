/**
 * QuickClip — Minimalist 4-Digit Sharing Client Logic
 */

const state = {
  socket: null,
  activeMode: 'share', // 'share' | 'receive'
  selectedContentType: 'text', // 'text' | 'code' | 'file'
  selectedExpiryMinutes: 5, // 1, 5, 10
  selectedFile: null,
  generatedClip: null,
  retrievedClip: null,
  shareTimerInterval: null,
  receiveTimerInterval: null
};

// Web Audio API Sound Synthesizer
const AudioFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  playSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  },
  playCopy() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {}
  }
};

// DOM References
const DOM = {
  modeShareBtn: document.getElementById('mode-share-btn'),
  modeReceiveBtn: document.getElementById('mode-receive-btn'),
  shareView: document.getElementById('share-view'),
  receiveView: document.getElementById('receive-view'),

  // Composer
  composerContainer: document.getElementById('composer-container'),
  typePills: document.querySelectorAll('.type-pill'),
  paneText: document.getElementById('pane-text'),
  paneCode: document.getElementById('pane-code'),
  paneFile: document.getElementById('pane-file'),
  shareTextInput: document.getElementById('share-text-input'),
  shareCodeInput: document.getElementById('share-code-input'),
  codeLang: document.getElementById('code-lang'),
  dropTarget: document.getElementById('drop-target'),
  fileInputElement: document.getElementById('file-input-element'),
  fileSelectedBadge: document.getElementById('file-selected-badge'),
  fileNameLabel: document.getElementById('file-name-label'),
  fileSizeLabel: document.getElementById('file-size-label'),
  expBtns: document.querySelectorAll('.exp-btn'),
  generateCodeBtn: document.getElementById('generate-code-btn'),

  // Result Card
  codeResultContainer: document.getElementById('code-result-container'),
  digit0: document.getElementById('digit-0'),
  digit1: document.getElementById('digit-1'),
  digit2: document.getElementById('digit-2'),
  digit3: document.getElementById('digit-3'),
  copyGeneratedCodeBtn: document.getElementById('copy-generated-code-btn'),
  shareTimerBadge: document.getElementById('share-timer-badge'),
  shareTimerText: document.getElementById('share-timer-text'),
  sharedSummaryCard: document.getElementById('shared-summary-card'),
  createNewClipBtn: document.getElementById('create-new-clip-btn'),

  // Receive View
  pinInputs: [
    document.getElementById('pin-input-1'),
    document.getElementById('pin-input-2'),
    document.getElementById('pin-input-3'),
    document.getElementById('pin-input-4')
  ],
  fetchClipBtn: document.getElementById('fetch-clip-btn'),
  retrievedContentCard: document.getElementById('retrieved-content-card'),
  retrievedTypeBadge: document.getElementById('retrieved-type-badge'),
  retrievedTypeText: document.getElementById('retrieved-type-text'),
  receiveTimerBadge: document.getElementById('receive-timer-badge'),
  receiveTimerText: document.getElementById('receive-timer-text'),
  retrievedBody: document.getElementById('retrieved-body'),
  copyRetrievedBtn: document.getElementById('copy-retrieved-btn'),
  downloadRetrievedBtn: document.getElementById('download-retrieved-btn'),

  // Toast
  toastShelf: document.getElementById('toast-shelf')
};

function init() {
  initIcons();
  initSocket();
  bindModeSwitch();
  bindComposerEvents();
  bindPinInputEvents();
  bindGlobalPaste();

  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  if (codeParam && /^\d{4}$/.test(codeParam)) {
    switchMode('receive');
    fillPinBoxes(codeParam);
    fetchClipByCode(codeParam);
  }
}

function initIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function initSocket() {
  state.socket = io({
    reconnection: true,
    reconnectionAttempts: 10
  });

  state.socket.on('clip_expired', ({ code }) => {
    if (state.generatedClip && state.generatedClip.code === code) {
      showToast('Your shared clip has expired and been purged.', 'info');
      resetComposerView();
    }
    if (state.retrievedClip && state.retrievedClip.code === code) {
      showToast('This clip has expired.', 'info');
      DOM.retrievedContentCard.classList.add('hidden');
    }
  });

  state.socket.on('clip_deleted', ({ code }) => {
    if (state.retrievedClip && state.retrievedClip.code === code) {
      showToast('This clip was deleted.', 'info');
      DOM.retrievedContentCard.classList.add('hidden');
    }
  });
}

function bindModeSwitch() {
  DOM.modeShareBtn.addEventListener('click', () => switchMode('share'));
  DOM.modeReceiveBtn.addEventListener('click', () => switchMode('receive'));
}

function switchMode(mode) {
  state.activeMode = mode;
  if (mode === 'share') {
    DOM.modeShareBtn.classList.add('active');
    DOM.modeReceiveBtn.classList.remove('active');
    DOM.shareView.classList.add('active');
    DOM.receiveView.classList.remove('active');
  } else {
    DOM.modeReceiveBtn.classList.add('active');
    DOM.modeShareBtn.classList.remove('active');
    DOM.receiveView.classList.add('active');
    DOM.shareView.classList.remove('active');
    DOM.pinInputs[0].focus();
  }
}

function bindComposerEvents() {
  DOM.typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedContentType = pill.dataset.type;

      DOM.paneText.classList.toggle('active', state.selectedContentType === 'text');
      DOM.paneCode.classList.toggle('active', state.selectedContentType === 'code');
      DOM.paneFile.classList.toggle('active', state.selectedContentType === 'file');
    });
  });

  DOM.expBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.expBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedExpiryMinutes = parseInt(btn.dataset.min, 10);
      showToast(`Expiry set to ${state.selectedExpiryMinutes} min`, 'info');
    });
  });

  DOM.dropTarget.addEventListener('click', () => DOM.fileInputElement.click());
  DOM.fileInputElement.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFileSelected(e.target.files[0]);
  });

  DOM.dropTarget.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.dropTarget.classList.add('dragover');
  });

  DOM.dropTarget.addEventListener('dragleave', () => {
    DOM.dropTarget.classList.remove('dragover');
  });

  DOM.dropTarget.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.dropTarget.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  DOM.generateCodeBtn.addEventListener('click', handleGenerateCode);

  DOM.copyGeneratedCodeBtn.addEventListener('click', () => {
    if (state.generatedClip && state.generatedClip.code) {
      navigator.clipboard.writeText(state.generatedClip.code);
      AudioFX.playCopy();
      showToast(`Code ${state.generatedClip.code} copied!`, 'success');
    }
  });

  DOM.createNewClipBtn.addEventListener('click', resetComposerView);
}

function handleFileSelected(file) {
  state.selectedFile = file;
  DOM.fileNameLabel.textContent = file.name;
  DOM.fileSizeLabel.textContent = formatBytes(file.size);
  DOM.fileSelectedBadge.classList.remove('hidden');
}

// Generate Code: Try REST API first, fallback to Socket.io
async function handleGenerateCode() {
  let payload = {
    type: state.selectedContentType,
    expiresInMinutes: state.selectedExpiryMinutes
  };

  if (state.selectedContentType === 'text') {
    const text = DOM.shareTextInput.value;
    if (!text || !text.trim()) return showToast('Please enter text to share', 'error');
    payload.content = text;
  } else if (state.selectedContentType === 'code') {
    const code = DOM.shareCodeInput.value;
    if (!code || !code.trim()) return showToast('Please enter code snippet', 'error');
    payload.content = code;
    payload.language = DOM.codeLang.value;
  } else if (state.selectedContentType === 'file') {
    if (!state.selectedFile) return showToast('Please select or drop a file', 'error');
    const uploadRes = await uploadFile(state.selectedFile);
    if (!uploadRes) return;
    payload.type = uploadRes.isImage ? 'image' : 'file';
    payload.content = uploadRes.fileUrl;
    payload.fileUrl = uploadRes.fileUrl;
    payload.fileName = uploadRes.fileName;
    payload.fileSize = uploadRes.fileSize;
  }

  DOM.generateCodeBtn.disabled = true;
  DOM.generateCodeBtn.innerHTML = `<span>Generating...</span>`;

  const onClipSuccess = (clipData) => {
    state.generatedClip = clipData.clip;
    if (state.socket) state.socket.emit('watch_clip', { code: clipData.code });
    AudioFX.playSuccess();
    displayGeneratedCodeCard(clipData.clip);
    showToast(`4-Digit Code: ${clipData.code}`, 'success');
    DOM.generateCodeBtn.disabled = false;
    DOM.generateCodeBtn.innerHTML = `<i data-lucide="sparkles"></i><span>Generate 4-Digit Code</span>`;
    initIcons();
  };

  try {
    const res = await fetch('/api/clip/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.clip) {
        onClipSuccess(data);
        return;
      }
    }
  } catch (err) {
    console.warn('REST create failed, attempting WebSocket fallback...', err);
  }

  // Socket Fallback
  if (state.socket && state.socket.connected) {
    state.socket.emit('create_clip', payload, (socketData) => {
      if (socketData && socketData.success) {
        onClipSuccess(socketData);
      } else {
        showToast('Server update needed. Please restart server.', 'error');
        DOM.generateCodeBtn.disabled = false;
        DOM.generateCodeBtn.innerHTML = `<i data-lucide="sparkles"></i><span>Generate 4-Digit Code</span>`;
        initIcons();
      }
    });
  } else {
    showToast('Cannot connect to server. Please ensure server is running.', 'error');
    DOM.generateCodeBtn.disabled = false;
    DOM.generateCodeBtn.innerHTML = `<i data-lucide="sparkles"></i><span>Generate 4-Digit Code</span>`;
    initIcons();
  }
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file, file.name);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    return await res.json();
  } catch (e) {
    showToast('File upload failed', 'error');
    return null;
  }
}

function displayGeneratedCodeCard(clip) {
  DOM.composerContainer.classList.add('hidden');
  DOM.codeResultContainer.classList.remove('hidden');

  const digits = clip.code.split('');
  DOM.digit0.textContent = digits[0] || '-';
  DOM.digit1.textContent = digits[1] || '-';
  DOM.digit2.textContent = digits[2] || '-';
  DOM.digit3.textContent = digits[3] || '-';

  if (clip.type === 'text') {
    DOM.sharedSummaryCard.textContent = clip.content;
  } else if (clip.type === 'code') {
    DOM.sharedSummaryCard.textContent = `[${clip.language}] Code snippet:\n${clip.content}`;
  } else if (clip.type === 'image') {
    DOM.sharedSummaryCard.textContent = `🖼️ Image: ${clip.fileName || 'Screenshot'}`;
  } else if (clip.type === 'file') {
    DOM.sharedSummaryCard.textContent = `📁 File: ${clip.fileName} (${formatBytes(clip.fileSize)})`;
  }

  startShareCountdown(clip.expiresAt);
}

function startShareCountdown(expiresAt) {
  if (state.shareTimerInterval) clearInterval(state.shareTimerInterval);

  const update = () => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    DOM.shareTimerText.textContent = formatSeconds(remaining);
    
    if (remaining <= 30) {
      DOM.shareTimerBadge.classList.add('urgent');
    } else {
      DOM.shareTimerBadge.classList.remove('urgent');
    }

    if (remaining === 0) {
      clearInterval(state.shareTimerInterval);
      showToast('Clip has expired', 'info');
      resetComposerView();
    }
  };

  update();
  state.shareTimerInterval = setInterval(update, 1000);
}

function resetComposerView() {
  if (state.shareTimerInterval) clearInterval(state.shareTimerInterval);
  state.generatedClip = null;
  state.selectedFile = null;

  DOM.shareTextInput.value = '';
  DOM.shareCodeInput.value = '';
  DOM.fileInputElement.value = '';
  DOM.fileSelectedBadge.classList.add('hidden');

  DOM.codeResultContainer.classList.add('hidden');
  DOM.composerContainer.classList.remove('hidden');
}

// PIN Entry Inputs (User 2)
function bindPinInputEvents() {
  DOM.pinInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val ? val[0] : '';

      if (val && idx < 3) {
        DOM.pinInputs[idx + 1].focus();
      }

      const fullPin = getEnteredPin();
      if (fullPin.length === 4) {
        fetchClipByCode(fullPin);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        DOM.pinInputs[idx - 1].focus();
      }
      if (e.key === 'Enter') {
        const fullPin = getEnteredPin();
        if (fullPin.length === 4) fetchClipByCode(fullPin);
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
      const numbers = pasted.replace(/\D/g, '').slice(0, 4);
      if (numbers) {
        fillPinBoxes(numbers);
        if (numbers.length === 4) {
          fetchClipByCode(numbers);
        }
      }
    });
  });

  DOM.fetchClipBtn.addEventListener('click', () => {
    const pin = getEnteredPin();
    if (pin.length !== 4) return showToast('Please enter all 4 digits of the PIN', 'error');
    fetchClipByCode(pin);
  });
}

function getEnteredPin() {
  return DOM.pinInputs.map(i => i.value.trim()).join('');
}

function fillPinBoxes(pinStr) {
  const chars = pinStr.split('');
  DOM.pinInputs.forEach((input, i) => {
    input.value = chars[i] || '';
  });
  if (chars.length < 4) {
    DOM.pinInputs[chars.length].focus();
  } else {
    DOM.pinInputs[3].focus();
  }
}

// Fetch Clip by 4-Digit Code (User 2)
async function fetchClipByCode(code) {
  DOM.fetchClipBtn.disabled = true;
  DOM.fetchClipBtn.innerHTML = `<span>Accessing...</span>`;

  const onFetchSuccess = (clip) => {
    state.retrievedClip = clip;
    if (state.socket) state.socket.emit('watch_clip', { code });
    AudioFX.playSuccess();
    renderRetrievedClip(clip);
    showToast('Clipboard accessed successfully!', 'success');
  };

  const resetButton = () => {
    DOM.fetchClipBtn.disabled = false;
    DOM.fetchClipBtn.innerHTML = `<i data-lucide="arrow-down-circle"></i><span>Access Clipboard</span>`;
    initIcons();
  };

  try {
    const res = await fetch(`/api/clip/${code}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.clip) {
        onFetchSuccess(data.clip);
        resetButton();
        return;
      }
    }
  } catch (err) {
    console.warn('REST fetch failed, trying socket fallback...');
  }

  // Socket Fallback
  if (state.socket && state.socket.connected) {
    state.socket.emit('fetch_clip', { code }, (res) => {
      if (res && res.success && res.clip) {
        onFetchSuccess(res.clip);
      } else {
        DOM.retrievedContentCard.classList.add('hidden');
        showToast((res && res.error) || 'Invalid or expired 4-digit code', 'error');
      }
      resetButton();
    });
  } else {
    DOM.retrievedContentCard.classList.add('hidden');
    showToast('Invalid or expired 4-digit code', 'error');
    resetButton();
  }
}

function renderRetrievedClip(clip) {
  DOM.retrievedContentCard.classList.remove('hidden');
  DOM.retrievedTypeText.textContent = clip.type.toUpperCase();

  let typeIcon = 'align-left';
  if (clip.type === 'code') typeIcon = 'code-2';
  if (clip.type === 'image') typeIcon = 'image';
  if (clip.type === 'file') typeIcon = 'file-text';
  
  const iconElem = DOM.retrievedTypeBadge.querySelector('i');
  if (iconElem) iconElem.setAttribute('data-lucide', typeIcon);

  if (clip.type === 'text') {
    DOM.retrievedBody.innerHTML = `<div class="retrieved-text">${escapeHtml(clip.content || '')}</div>`;
    DOM.copyRetrievedBtn.classList.remove('hidden');
    DOM.downloadRetrievedBtn.classList.add('hidden');
  } else if (clip.type === 'code') {
    DOM.retrievedBody.innerHTML = `
      <pre><code class="language-${clip.language || 'javascript'}">${escapeHtml(clip.content || '')}</code></pre>
    `;
    DOM.copyRetrievedBtn.classList.remove('hidden');
    DOM.downloadRetrievedBtn.classList.add('hidden');
  } else if (clip.type === 'image') {
    DOM.retrievedBody.innerHTML = `
      <img src="${clip.fileUrl}" alt="Shared Image" class="retrieved-image">
    `;
    DOM.copyRetrievedBtn.classList.remove('hidden');
    DOM.downloadRetrievedBtn.classList.remove('hidden');
    DOM.downloadRetrievedBtn.href = clip.fileUrl;
    DOM.downloadRetrievedBtn.download = clip.fileName || 'image.png';
  } else if (clip.type === 'file') {
    DOM.retrievedBody.innerHTML = `
      <div class="retrieved-file-box">
        <i data-lucide="file-check"></i>
        <div>
          <div style="font-weight: 700;">${escapeHtml(clip.fileName || 'Shared File')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${formatBytes(clip.fileSize || 0)}</div>
        </div>
      </div>
    `;
    DOM.copyRetrievedBtn.classList.add('hidden');
    DOM.downloadRetrievedBtn.classList.remove('hidden');
    DOM.downloadRetrievedBtn.href = clip.fileUrl;
    DOM.downloadRetrievedBtn.download = clip.fileName;
  }

  DOM.copyRetrievedBtn.onclick = () => {
    const textToCopy = clip.type === 'image' || clip.type === 'file' ? window.location.origin + clip.fileUrl : clip.content;
    navigator.clipboard.writeText(textToCopy).then(() => {
      AudioFX.playCopy();
      DOM.copyRetrievedBtn.classList.add('copied');
      DOM.copyRetrievedBtn.innerHTML = `<i data-lucide="check"></i><span>Copied to Clipboard!</span>`;
      initIcons();
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => {
        DOM.copyRetrievedBtn.classList.remove('copied');
        DOM.copyRetrievedBtn.innerHTML = `<i data-lucide="copy"></i><span>Copy to Clipboard</span>`;
        initIcons();
      }, 2000);
    });
  };

  startReceiveCountdown(clip.expiresAt);
  initIcons();
  if (window.Prism) window.Prism.highlightAll();
}

function startReceiveCountdown(expiresAt) {
  if (state.receiveTimerInterval) clearInterval(state.receiveTimerInterval);

  const update = () => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    DOM.receiveTimerText.textContent = formatSeconds(remaining);

    if (remaining <= 30) {
      DOM.receiveTimerBadge.classList.add('urgent');
    } else {
      DOM.receiveTimerBadge.classList.remove('urgent');
    }

    if (remaining === 0) {
      clearInterval(state.receiveTimerInterval);
      showToast('Clip has expired.', 'info');
      DOM.retrievedContentCard.classList.add('hidden');
    }
  };

  update();
  state.receiveTimerInterval = setInterval(update, 1000);
}

function bindGlobalPaste() {
  window.addEventListener('paste', (e) => {
    if (state.activeMode !== 'share') return;

    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isEditing = activeTag === 'textarea' || activeTag === 'input';

    const items = e.clipboardData ? e.clipboardData.items : [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        handleFileSelected(blob);
        DOM.typePills.forEach(p => p.classList.toggle('active', p.dataset.type === 'file'));
        DOM.paneText.classList.remove('active');
        DOM.paneCode.classList.remove('active');
        DOM.paneFile.classList.add('active');
        state.selectedContentType = 'file';
        showToast('Pasted screenshot attached!', 'info');
        return;
      }
    }

    if (!isEditing) {
      const text = e.clipboardData.getData('text');
      if (text && text.trim()) {
        e.preventDefault();
        DOM.shareTextInput.value = text;
        DOM.typePills.forEach(p => p.classList.toggle('active', p.dataset.type === 'text'));
        DOM.paneText.classList.add('active');
        DOM.paneCode.classList.remove('active');
        DOM.paneFile.classList.remove('active');
        state.selectedContentType = 'text';
        showToast('Pasted text loaded into clipboard!', 'info');
      }
    }
  });
}

function formatSeconds(sec) {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;

  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-circle';

  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(message)}</span>`;
  DOM.toastShelf.appendChild(toast);
  initIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease-out';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

document.addEventListener('DOMContentLoaded', init);

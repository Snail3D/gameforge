/* GAMEFORGE Dashboard — WebSocket Client */

const AGENT_ICONS = {
  supervisor: '\u2699\uFE0F',
  builder: '\uD83D\uDD28',
  reviewer: '\uD83D\uDD0D',
  critic: '\uD83C\uDFAE',
  ghost: '\uD83D\uDC7B',
  planner: '\uD83E\uDDE0',
  scout: '\uD83D\uDC41\uFE0F'
};

let ws = null;
let uptimeStart = Date.now();
let timerInterval = null;
let pushCount = 0;
let skippedCount = 0;

// DOM refs
const chat = document.getElementById('chat');
const timer = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const featureList = document.getElementById('feature-list');
const gameIframe = document.getElementById('game-iframe');
const modeBadge = document.getElementById('mode-badge');
const gameName = document.getElementById('game-name');

// ── WebSocket ──

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host);

  ws.onmessage = function (e) {
    try {
      const event = JSON.parse(e.data);
      handleEvent(event);
    } catch (_) { /* ignore malformed */ }
  };

  ws.onclose = function () {
    setTimeout(connect, 2000);
  };

  ws.onerror = function () {
    ws.close();
  };
}

function handleEvent(event) {
  switch (event.type) {
    case 'message':
      addChatMessage(event);
      break;
    case 'tool_call':
      addToolCall(event);
      break;
    case 'screenshot':
      addScreenshot(event);
      break;
    case 'ghost_intervention':
      addGhostMessage(event);
      break;
    case 'step_assign':
      addSystemMessage(AGENT_ICONS[event.agent] + ' Step assigned: ' + escapeText(event.title), event.agent);
      break;
    case 'step_update':
      addSystemMessage('Step ' + escapeText(event.stepId) + ' \u2192 ' + event.status + ' (attempt ' + event.attempt + ')', event.agent);
      break;
    case 'model_swap':
      addSystemMessage('Model swap: loading ' + escapeText(event.loading) + (event.unloading ? ', unloading ' + escapeText(event.unloading) : ''), event.agent);
      break;
    case 'git_push':
      pushCount++;
      document.getElementById('stat-pushes').textContent = pushCount;
      addSystemMessage('Git push: ' + escapeText(event.commit) + ' (' + event.filesChanged + ' files)', event.agent);
      break;
    case 'feature_update':
      updateFeature(event);
      break;
    case 'system_stats':
      updateStats(event);
      break;
    case 'game_reload':
      if (event.success) reloadGameIframe();
      addSystemMessage('Game reload: ' + (event.success ? 'success' : 'failed') +
        (event.consoleErrors.length ? ' (' + event.consoleErrors.length + ' errors)' : ''), event.agent);
      break;
    case 'loop_detected':
      addSystemMessage('Loop detected (attempt ' + event.recoveryAttempt + '): ' + escapeText(event.repeatedTokens).slice(0, 80), event.agent);
      break;
  }
}

// ── Chat Messages ──

function addChatMessage(event) {
  var div = document.createElement('div');
  div.className = 'chat-msg ' + (event.agent || '');

  var label = document.createElement('div');
  label.className = 'agent-label';
  label.textContent = (AGENT_ICONS[event.agent] || '') + ' ' + (event.agent || 'unknown').toUpperCase();

  var content = document.createElement('div');
  content.className = 'content';
  content.textContent = event.content || '';

  var meta = document.createElement('div');
  meta.className = 'meta';
  var ts = event.ts ? new Date(event.ts).toLocaleTimeString() : '';
  meta.textContent = ts + ' | ' + (event.model || '') + ' | ' + (event.tokPerSec || 0).toFixed(1) + ' tok/s';

  div.appendChild(label);
  div.appendChild(content);
  div.appendChild(meta);
  chat.appendChild(div);
  autoScroll();
}

function addToolCall(event) {
  var div = document.createElement('div');
  div.className = 'chat-msg tool-call ' + (event.agent || '');

  var label = document.createElement('span');
  label.className = 'agent-label';
  label.textContent = (AGENT_ICONS[event.agent] || '') + ' ' + (event.agent || '').toUpperCase() + ' ';

  var toolName = document.createElement('span');
  toolName.className = 'tool-name';
  toolName.textContent = event.tool || '';

  var toolArgs = document.createElement('span');
  toolArgs.className = 'tool-args';
  try {
    toolArgs.textContent = JSON.stringify(event.args).slice(0, 120);
  } catch (_) {
    toolArgs.textContent = '...';
  }

  div.appendChild(label);
  div.appendChild(toolName);
  div.appendChild(toolArgs);
  chat.appendChild(div);
  autoScroll();
}

function addScreenshot(event) {
  var div = document.createElement('div');
  div.className = 'chat-msg screenshot ' + (event.agent || '');

  var label = document.createElement('div');
  label.className = 'agent-label';
  label.textContent = (AGENT_ICONS[event.agent] || '') + ' ' + (event.agent || '').toUpperCase();

  div.appendChild(label);

  if (event.base64) {
    var img = document.createElement('img');
    img.src = 'data:image/png;base64,' + event.base64;
    img.alt = event.description || 'screenshot';
    div.appendChild(img);
  }

  if (event.description) {
    var desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = event.description;
    div.appendChild(desc);
  }

  chat.appendChild(div);
  autoScroll();
}

function addGhostMessage(event) {
  var div = document.createElement('div');
  div.className = 'chat-msg ghost-msg';

  var label = document.createElement('div');
  label.className = 'agent-label';
  label.textContent = AGENT_ICONS.ghost + ' GHOST [' + (event.trigger || '') + ']';

  var content = document.createElement('div');
  content.className = 'content';
  content.textContent = event.response || '';

  div.appendChild(label);
  div.appendChild(content);
  chat.appendChild(div);
  autoScroll();
}

function addSystemMessage(text, agent) {
  var div = document.createElement('div');
  div.className = 'chat-msg system-msg ' + (agent || '');

  var content = document.createElement('span');
  content.textContent = text;

  div.appendChild(content);
  chat.appendChild(div);
  autoScroll();
}

function autoScroll() {
  chat.scrollTop = chat.scrollHeight;
}

// ── Stats & Progress ──

function updateStats(event) {
  document.getElementById('stat-cycles').textContent = event.cycles || 0;
  document.getElementById('stat-uptime').textContent = formatTime(event.uptimeSeconds || 0);
  document.getElementById('stat-loops').textContent = event.loopsCaught || 0;
  document.getElementById('stat-gpu').textContent = event.gpuMB || 0;

  // Update progress bar
  var pct = 0;
  if (event.stepsTotal > 0) {
    pct = Math.round((event.stepsCompleted / event.stepsTotal) * 100);
  }
  progressBar.style.setProperty('--progress', pct + '%');
  progressText.textContent = pct + '%';

  // Update timer from uptime
  timer.textContent = formatTime(event.uptimeSeconds || 0);
}

function updateFeature(event) {
  var existing = document.getElementById('feature-' + event.featureId);
  var statusClass = '';
  if (event.status === 'passed') statusClass = 'done';
  else if (event.status === 'in_progress') statusClass = 'in-progress';
  else statusClass = 'pending';

  if (existing) {
    existing.className = statusClass;
    existing.classList.add('status-change');
    setTimeout(function () { existing.classList.remove('status-change'); }, 600);
  } else {
    var li = document.createElement('li');
    li.id = 'feature-' + event.featureId;
    li.className = statusClass;

    var icon = document.createElement('span');
    icon.className = 'icon';

    var label = document.createElement('span');
    label.textContent = event.featureId;

    li.appendChild(icon);
    li.appendChild(label);
    featureList.appendChild(li);

    li.classList.add('status-change');
    setTimeout(function () { li.classList.remove('status-change'); }, 600);
  }
}

// ── Game Iframe ──

function reloadGameIframe() {
  try {
    gameIframe.src = gameIframe.src;
  } catch (_) { /* cross-origin */ }
}

// ── Utility ──

function formatTime(seconds) {
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = Math.floor(seconds % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function escapeText(str) {
  if (!str) return '';
  var node = document.createTextNode(str);
  var div = document.createElement('div');
  div.appendChild(node);
  return div.innerHTML;
}

// ── YouTube Mode ──

document.getElementById('btn-yt').addEventListener('click', function () {
  var link = document.getElementById('youtube-css');
  var banner = document.getElementById('youtube-banner');
  var btn = this;

  if (link.disabled) {
    link.disabled = false;
    banner.hidden = false;
    btn.classList.add('active');
  } else {
    link.disabled = true;
    banner.hidden = true;
    btn.classList.remove('active');
  }
});

// ── Recording ──

var mediaRecorder = null;
var recordedChunks = [];

document.getElementById('btn-record').addEventListener('click', async function () {
  var btn = this;

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    btn.classList.remove('recording');
    return;
  }

  try {
    var stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recordedChunks = [];

    mediaRecorder.ondataavailable = function (e) {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = function () {
      var blob = new Blob(recordedChunks, { type: 'video/webm' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'gameforge-session-' + Date.now() + '.webm';
      a.click();
      stream.getTracks().forEach(function (t) { t.stop(); });
      btn.classList.remove('recording');
    };

    mediaRecorder.start();
    btn.classList.add('recording');
  } catch (_) {
    /* user cancelled screen share */
  }
});

// ── Init ──

connect();

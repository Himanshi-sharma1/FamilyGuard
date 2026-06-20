// Streaming Features for FamilyGuard Dashboard

// Audio Recordings State
let audioRecordings = [];
let currentAudioPlayer = null;
let isLiveAudioActive = false;
let audioContext = null;

// Camera State
let isCameraActive = false;
let cameraFrame = null;

// Load audio recordings for a specific date
async function loadAudioRecordings(date) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const response = await fetch(`/api/v1/streaming/audio/timeline?date=${targetDate}`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('familyguard_token')
      }
    });
    
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Failed to load audio recordings:', err);
    return { timeline: [], total_recordings: 0 };
  }
}

// Render audio timeline
function renderAudioTimeline(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!data.timeline || data.timeline.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No recordings available for this date</p>';
    return;
  }
  
  let html = '<div class="audio-timeline">';
  
  // Create 24-hour timeline
  data.timeline.forEach((hour, index) => {
    const hasRecording = hour.has_recording;
    const recordings = hour.recordings || [];
    
    html += `
      <div class="timeline-hour ${hasRecording ? 'has-recording' : ''}">
        <div class="hour-label">${hour.hour}</div>
        <div class="hour-bar" 
             style="background: ${hasRecording ? 'var(--brand-primary)' : 'var(--border-default)'}"
             onclick="${hasRecording ? 'playHourRecordings(' + JSON.stringify(recordings).replace(/"/g, "'") + ')' : ''}">
          ${hasRecording ? '<i data-lucide="volume-2" style="width:14px;height:14px;color:white;"></i>' : ''}
        </div>
        ${recordings.length > 0 ? '<span class="recording-count">' + recordings.length + '</span>' : ''}
      </div>
    `;
  });
  
  html += '</div>';
  
  // Add summary
  html += `
    <div class="timeline-summary">
      <p>Total recordings: <strong>${data.total_recordings}</strong></p>
      <p>Date: <strong>${data.date}</strong></p>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Refresh icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Play recordings for a specific hour
function playHourRecordings(recordings) {
  if (!recordings || recordings.length === 0) return;
  
  // Play first recording
  playRecording(recordings[0].file_url, recordings[0].id);
  
  // Show all recordings in a list
  showRecordingsList(recordings);
}

// Play a single recording
function playRecording(url, id) {
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer = null;
  }
  
  currentAudioPlayer = new Audio(url);
  currentAudioPlayer.volume = 1;
  currentAudioPlayer.play();
  
  // Update UI
  const playBtns = document.querySelectorAll('.recording-play-btn');
  playBtns.forEach(btn => btn.classList.remove('playing'));
  
  const currentBtn = document.querySelector(`[data-recording-id="${id}"]`);
  if (currentBtn) currentBtn.classList.add('playing');
  
  currentAudioPlayer.onended = () => {
    if (currentBtn) currentBtn.classList.remove('playing');
    currentAudioPlayer = null;
  };
}

// Stop current playback
function stopPlayback() {
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer = null;
  }
}

// Show recordings list in a modal-like section
function showRecordingsList(recordings) {
  const listContainer = document.getElementById('recordings-list');
  if (!listContainer) return;
  
  let html = '<h4 style="margin-bottom: 12px;">Recordings</h4>';
  
  recordings.forEach(rec => {
    const time = new Date(rec.start_time).toLocaleTimeString();
    html += `
      <div class="recording-item">
        <button class="recording-play-btn" data-recording-id="${rec.id}" onclick="playRecording('${rec.file_url}', '${rec.id}')">
          <i data-lucide="play" style="width:16px;height:16px;"></i>
        </button>
        <div class="recording-info">
          <span class="recording-time">${time}</span>
          <span class="recording-duration">${rec.duration ? rec.duration + 's' : '--'}</span>
        </div>
      </div>
    `;
  });
  
  listContainer.innerHTML = html;
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Request live audio from device
function startLiveAudio() {
  if (!socket) return;
  
  isLiveAudioActive = true;
  socket.emit('dashboard:request:audio:start');
  
  // Update UI
  const btn = document.getElementById('live-audio-btn');
  if (btn) {
    btn.innerHTML = '<i data-lucide="pause"></i> Stop Live Audio';
    btn.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  const status = document.getElementById('live-audio-status');
  if (status) {
    status.innerHTML = '<span style="color: var(--status-danger);"><i data-lucide="radio" style="width:14px;height:14px;"></i> Listening live...</span>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// Stop live audio
function stopLiveAudio() {
  if (!socket) return;
  
  isLiveAudioActive = false;
  socket.emit('dashboard:request:audio:stop');
  
  const btn = document.getElementById('live-audio-btn');
  if (btn) {
    btn.innerHTML = '<i data-lucide="radio"></i> Start Live Audio';
    btn.classList.remove('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  const status = document.getElementById('live-audio-status');
  if (status) {
    status.innerHTML = '<span style="color: var(--text-secondary);">Not listening</span>';
  }
}

// Toggle live audio
function toggleLiveAudio() {
  if (isLiveAudioActive) {
    stopLiveAudio();
  } else {
    startLiveAudio();
  }
}

// Request live camera from device
function startLiveCamera() {
  if (!socket) return;
  
  isCameraActive = true;
  socket.emit('dashboard:request:camera:start');
  
  const btn = document.getElementById('live-camera-btn');
  if (btn) {
    btn.innerHTML = '<i data-lucide="video-off"></i> Stop Camera';
    btn.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  const status = document.getElementById('camera-status');
  if (status) {
    status.innerHTML = '<span style="color: var(--status-danger);"><i data-lucide="video" style="width:14px;height:14px;"></i> Waiting for camera...</span>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// Stop live camera
function stopLiveCamera() {
  if (!socket) return;
  
  isCameraActive = false;
  socket.emit('dashboard:request:camera:stop');
  
  const btn = document.getElementById('live-camera-btn');
  if (btn) {
    btn.innerHTML = '<i data-lucide="video"></i> Start Live Camera';
    btn.classList.remove('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  
  const cameraView = document.getElementById('camera-view');
  if (cameraView) {
    cameraView.src = '';
    cameraView.style.display = 'none';
  }
  
  const status = document.getElementById('camera-status');
  if (status) {
    status.innerHTML = '<span style="color: var(--text-secondary);">Camera off</span>';
  }
}

// Toggle live camera
function toggleLiveCamera() {
  if (isCameraActive) {
    stopLiveCamera();
  } else {
    startLiveCamera();
  }
}

// Handle incoming camera frame
function handleCameraFrame(data) {
  if (!isCameraActive) return;
  
  const cameraView = document.getElementById('camera-view');
  if (cameraView && data.frame) {
    cameraView.src = data.frame;
    cameraView.style.display = 'block';
    
    const status = document.getElementById('camera-status');
    if (status) {
      status.innerHTML = '<span style="color: var(--status-success);"><i data-lucide="video" style="width:14px;height:14px;"></i> Live</span>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

// Register socket events for streaming
function registerStreamingEvents(socket) {
  if (!socket) return;
  
  socket.on('camera:stream:frame', handleCameraFrame);
  
  socket.on('camera:stream:started', () => {
    const status = document.getElementById('camera-status');
    if (status) {
      status.innerHTML = '<span style="color: var(--status-success);">Camera started on device</span>';
    }
  });
  
  socket.on('camera:stream:stopped', () => {
    isCameraActive = false;
    const cameraView = document.getElementById('camera-view');
    if (cameraView) {
      cameraView.style.display = 'none';
    }
    
    const btn = document.getElementById('live-camera-btn');
    if (btn) {
      btn.innerHTML = '<i data-lucide="video"></i> Start Live Camera';
      btn.classList.remove('active');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });
  
  socket.on('audio:stream:started', () => {
    const status = document.getElementById('live-audio-status');
    if (status) {
      status.innerHTML = '<span style="color: var(--status-success);"><i data-lucide="radio" style="width:14px;height:14px;"></i> Audio active on device</span>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });
  
  socket.on('audio:stream:stopped', () => {
    isLiveAudioActive = false;
    const btn = document.getElementById('live-audio-btn');
    if (btn) {
      btn.innerHTML = '<i data-lucide="radio"></i> Start Live Audio';
      btn.classList.remove('active');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });
  
  socket.on('audio:new', (data) => {
    // New recording uploaded - refresh if on media page
    const timelineContainer = document.getElementById('audio-timeline');
    if (timelineContainer) {
      const datePicker = document.getElementById('audio-date-picker');
      const date = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];
      loadAudioRecordings(date).then(data => renderAudioTimeline(data, 'audio-timeline'));
    }
  });
}

// Add styles for streaming features
function addStreamingStyles() {
  const styles = `
    .audio-timeline {
      display: flex;
      gap: 4px;
      padding: 20px 0;
      overflow-x: auto;
    }
    
    .timeline-hour {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-width: 36px;
    }
    
    .hour-label {
      font-size: 10px;
      color: var(--text-secondary);
    }
    
    .hour-bar {
      width: 28px;
      height: 60px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .hour-bar:hover {
      transform: scaleY(1.1);
    }
    
    .has-recording .hour-bar {
      cursor: pointer;
    }
    
    .recording-count {
      font-size: 10px;
      color: var(--brand-primary);
      font-weight: 600;
    }
    
    .timeline-summary {
      padding: 16px;
      background: var(--bg-page);
      border-radius: 8px;
      margin-top: 16px;
      font-size: 14px;
    }
    
    .recording-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--bg-page);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    .recording-play-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--brand-primary);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    
    .recording-play-btn:hover {
      background: var(--brand-primary-hover);
    }
    
    .recording-play-btn.playing {
      background: var(--status-danger);
    }
    
    .recording-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .recording-time {
      font-weight: 500;
    }
    
    .recording-duration {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .live-control-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .live-control-btn.active {
      background: var(--status-danger) !important;
      color: white !important;
    }
    
    #camera-view {
      width: 100%;
      max-width: 640px;
      border-radius: 12px;
      background: #000;
    }
  `;
  
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

// Initialize streaming features
function initStreamingFeatures() {
  addStreamingStyles();
  
  // Register socket events after socket is initialized
  if (typeof socket !== 'undefined' && socket) {
    registerStreamingEvents(socket);
  } else {
    // Wait for socket to be initialized
    const checkSocket = setInterval(() => {
      if (typeof socket !== 'undefined' && socket) {
        registerStreamingEvents(socket);
        clearInterval(checkSocket);
      }
    }, 500);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStreamingFeatures);
} else {
  initStreamingFeatures();
}

// Export functions for use in main app
window.loadAudioRecordings = loadAudioRecordings;
window.renderAudioTimeline = renderAudioTimeline;
window.playRecording = playRecording;
window.stopPlayback = stopPlayback;
window.toggleLiveAudio = toggleLiveAudio;
window.toggleLiveCamera = toggleLiveCamera;
window.startLiveCamera = startLiveCamera;
window.stopLiveCamera = stopLiveCamera;
window.registerStreamingEvents = registerStreamingEvents;

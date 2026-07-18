const curriculum = {};
let currentPath = [];

const breadcrumbEl = document.getElementById('breadcrumb');
const contentEl = document.getElementById('content');
const toastEl = document.getElementById('toast');

const previewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'htm'];

let panelContext = { classKey: null, streamKey: null, subjectKey: null, chapter: null, isSubjectBook: false, chapters: [] };
let panelFile = null;

function init() {
  showLoading();
  fetch('/api/curriculum')
    .then(r => r.json())
    .then(data => {
      Object.assign(curriculum, data);
      showClasses();
    });
  setupUploadPanel();
}

function showLoading() {
  let skeleton = '';
  for (let i = 0; i < 4; i++) {
    skeleton += `<div class="card skeleton-card"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div>`;
  }
  contentEl.innerHTML = `<div class="card-grid">${skeleton}</div>`;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

function buildBreadcrumb() {
  breadcrumbEl.innerHTML = '';
  const parts = [{ label: 'Home', path: [] }];
  let accum = [];
  for (const segment of currentPath) {
    accum.push(segment);
    parts.push({ label: segment.label, path: [...accum] });
  }
  parts.forEach((part, i) => {
    if (i > 0) {
      const span = document.createElement('span');
      span.className = 'separator';
      span.textContent = '\u203A';
      breadcrumbEl.appendChild(span);
    }
    if (i === parts.length - 1) {
      const span = document.createElement('span');
      span.className = 'current';
      span.textContent = part.label;
      breadcrumbEl.appendChild(span);
    } else {
      const a = document.createElement('a');
      a.textContent = part.label;
      a.onclick = () => navigateTo(part.path);
      breadcrumbEl.appendChild(a);
    }
  });
}

function navigateTo(path) {
  currentPath = path;
  buildBreadcrumb();
  if (path.length === 0) showClasses();
  else if (path.length === 1) showStreams(path[0]);
  else if (path.length === 2) showSubjects(path[0], path[1]);
  else if (path.length === 3) showChapters(path[0], path[1], path[2]);
  else if (path.length === 4) showFiles(path[0], path[1], path[2], path[3]);
}

function showClasses() {
  contentEl.innerHTML = `
    <div class="section-selector">
      ${Object.entries(curriculum).map(([key, cls]) =>
        `<button class="section-btn" onclick="navigateTo([{key:'${key}', label:'${cls.label}'}])">${cls.label}</button>`
      ).join('')}
    </div>
  `;
}

function showStreams(classObj) {
  const cls = curriculum[classObj.key];
  contentEl.innerHTML = `
    <h2 class="page-title">${cls.label} \u2014 Select Stream</h2>
    <div class="card-grid">
      ${Object.entries(cls.streams).map(([key, stream]) => `
        <div class="card stream-card" onclick="navigateTo([
          {key:'${classObj.key}', label:'${cls.label}'},
          {key:'${key}', label:'${stream.label}'}
        ])" data-tilt>
          <div class="icon">${getStreamIcon(key)}</div>
          <h3>${stream.label}</h3>
          <p>${Object.keys(stream.subjects).length} subjects</p>
        </div>
      `).join('')}
    </div>
  `;
  initTilt();
}

function showSubjects(classObj, streamObj) {
  const cls = curriculum[classObj.key];
  const stream = cls.streams[streamObj.key];
  contentEl.innerHTML = `
    <h2 class="page-title">${stream.label} \u2014 Subjects</h2>
    <div class="card-grid">
      ${Object.entries(stream.subjects).map(([key, subj]) => `
        <div class="card subject-card" onclick="navigateTo([
          {key:'${classObj.key}', label:'${cls.label}'},
          {key:'${streamObj.key}', label:'${stream.label}'},
          {key:'${key}', label:'${subj.label}'}
        ])" data-tilt>
          <div class="icon">${getSubjectIcon(key)}</div>
          <h3>${subj.label}</h3>
          <p>${subj.chapters.length} chapters</p>
        </div>
      `).join('')}
    </div>
  `;
  initTilt();
}

function showChapters(classObj, streamObj, subjectObj) {
  const cls = curriculum[classObj.key];
  const stream = cls.streams[streamObj.key];
  const subject = stream.subjects[subjectObj.key];
  const chapters = subject.chapters;

  panelContext = {
    classKey: classObj.key, streamKey: streamObj.key, subjectKey: subjectObj.key,
    chapter: null, isSubjectBook: false, chapters: chapters
  };

  contentEl.innerHTML = `
    <h2 class="page-title">${subject.label} \u2014 Chapters</h2>
    <div id="ncertSection"></div>
    <div id="booksSection"></div>
    <div class="card-grid">
      ${chapters.map(ch => `
        <div class="card chapter-card" onclick="navigateTo([
          {key:'${classObj.key}', label:'${cls.label}'},
          {key:'${streamObj.key}', label:'${stream.label}'},
          {key:'${subjectObj.key}', label:'${subject.label}'},
          {key:'${ch}', label:'${ch}'}
        ])" data-tilt>
          <div class="icon">\uD83D\uDCD6</div>
          <h3>${ch}</h3>
          <p>View files</p>
        </div>
      `).join('')}
    </div>
  `;
  initTilt();
  loadNcertBooks(classObj.key, streamObj.key, subjectObj.key);
  loadSubjectBooks(classObj.key, streamObj.key, subjectObj.key);
}

function loadNcertBooks(cls, stream, subject) {
  const section = document.getElementById('ncertSection');
  if (!section) return;
  fetch(`/api/ncert/${cls}/${stream}/${subject}`)
    .then(r => r.json())
    .then(files => {
      if (!files.length) return;
      section.innerHTML = `
        <div class="category-section" style="margin-bottom:2rem">
          <div class="category-header">
            <span style="font-size:1.2rem">\uD83D\uDCD5</span>
            <h4>NCERT Textbook PDFs (${files.length})</h4>
          </div>
          <div class="card-grid">
            ${files.map(f => `
              <div class="card file-card">
                <div class="file-icon">\uD83D\uDCD5</div>
                <div class="file-name">${f.name}</div>
                <div class="file-meta">PDF \u2022 ${(f.size/1024).toFixed(0)} KB</div>
                <div class="file-actions">
                  ${isPreviewable(f.name) ? `<button class="btn btn-view" onclick="viewFile('${f.url}','${f.name}')">View</button>` : ''}
                  <a href="${f.url}" class="btn btn-primary" target="_blank">Open</a>
                  <a href="${f.url}" class="btn btn-outline" download>Download</a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    })
    .catch(() => {});
}

function loadSubjectBooks(cls, stream, subject) {
  const section = document.getElementById('booksSection');
  if (!section) return;

  section.innerHTML = `
    <div class="category-section" style="margin-bottom:2rem">
      <div class="category-header">
        <span style="font-size:1.2rem">\uD83D\uDCDA</span>
        <h4>Books</h4>
      </div>
      <div id="booksList" class="card-grid"></div>
    </div>
  `;

  fetch(`/api/subject-books/${cls}/${stream}/${subject}`)
    .then(r => r.json())
    .then(files => {
      const list = document.getElementById('booksList');
      if (!list) return;
      if (!files.length) {
        list.innerHTML = `<div class="empty-state" style="padding:1rem"><p style="font-size:0.85rem">No books uploaded yet. Use the upload button to add books.</p></div>`;
        return;
      }
      list.innerHTML = files.map(f => `
        <div class="card file-card">
          <div class="file-icon">\uD83D\uDCDA</div>
          <div class="file-name">${f.name}</div>
          <div class="file-meta">PDF \u2022 ${(f.size/1024).toFixed(0)} KB</div>
          <div class="file-actions">
            ${isPreviewable(f.name) ? `<button class="btn btn-view" onclick="viewFile('${f.url}','${f.name}')">View</button>` : ''}
            <a href="${f.url}" class="btn btn-primary" target="_blank">Open</a>
            <a href="${f.url}" class="btn btn-outline" download>Download</a>
          </div>
        </div>
      `).join('');
    })
    .catch(() => {});
}

function showFiles(classObj, streamObj, subjectObj, chapterObj) {
  const chapterName = chapterObj.key;
  const subject = curriculum[classObj.key].streams[streamObj.key].subjects[subjectObj.key];

  panelContext = {
    classKey: classObj.key, streamKey: streamObj.key, subjectKey: subjectObj.key,
    chapter: chapterName, isSubjectBook: false, chapters: subject.chapters
  };

  contentEl.innerHTML = `<h2 class="page-title">${chapterName}</h2><div id="filesContent"><div class="empty-state"><div class="icon">\u23F3</div><p>Loading files...</p></div></div>`;

  fetch(`/api/files/${classObj.key}/${streamObj.key}/${subjectObj.key}/${encodeURIComponent(chapterName)}`)
    .then(r => r.json())
    .then(data => {
      renderFiles(classObj, streamObj, subjectObj, chapterName, data);
    });
}

function renderFiles(classObj, streamObj, subjectObj, chapterName, data) {
  const hasAny = Object.values(data).some(arr => arr.length > 0);

  if (!hasAny) {
    contentEl.innerHTML = `<h2 class="page-title">${chapterName}</h2><div class="empty-state"><div class="icon">\uD83D\uDCC1</div><p>No files uploaded yet for this chapter.</p><p style="font-size:0.85rem;margin-top:0.5rem;color:rgba(255,255,255,0.3)">Use the upload button to add files.</p></div>`;
    return;
  }

  const categories = [
    { key: 'notes', label: 'Notes', icon: '\uD83D\uDCDD' },
    { key: 'pdfs', label: 'PDFs', icon: '\uD83D\uDCC4' },
  ];

  let html = `<h2 class="page-title">${chapterName}</h2><div class="files-section">`;

  for (const cat of categories) {
    const files = data[cat.key] || [];
    html += `
      <div class="category-section">
        <div class="category-header">
          <span style="font-size:1.2rem">${cat.icon}</span>
          <h4>${cat.label} (${files.length})</h4>
        </div>
        <div class="card-grid">
    `;
    if (files.length === 0) {
      html += `<div class="empty-state" style="padding:1rem"><p style="font-size:0.85rem">No ${cat.label.toLowerCase()} yet</p></div>`;
    } else {
      for (const f of files) {
        const ext = f.name.split('.').pop().toUpperCase();
        const sizeKB = (f.size / 1024).toFixed(1);
        const canPreview = isPreviewable(f.name);
        const icon = getFileIcon(ext);
        html += `
          <div class="card file-card">
            <div class="file-icon">${icon}</div>
            <div class="file-name">${f.name}</div>
            <div class="file-meta">${ext} \u2022 ${sizeKB} KB</div>
            <div class="file-actions">
              ${canPreview ? `<button class="btn btn-view" onclick="viewFile('${f.url}','${f.name}')">View</button>` : ''}
              <a href="${f.url}" class="btn btn-primary" target="_blank">Open</a>
              <a href="${f.url}" class="btn btn-outline" download>Download</a>
            </div>
          </div>
        `;
      }
    }
    html += `</div></div>`;
  }

  html += `</div>`;
  contentEl.innerHTML = html;
}

function isPreviewable(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return previewableExts.includes(ext);
}

function getFileIcon(ext) {
  const icons = {
    PDF: '\uD83D\uDCD5', DOC: '\uD83D\uDCD8', DOCX: '\uD83D\uDCD8', XLS: '\uD83D\uDCD7', XLSX: '\uD83D\uDCD7',
    PPT: '\uD83D\uDCD9', PPTX: '\uD83D\uDCD9', TXT: '\uD83D\uDCC3', MD: '\uD83D\uDCDD',
    ZIP: '\uD83D\uDDC4\uFE0F', RAR: '\uD83D\uDDC4\uFE0F', IMAGE: '\uD83D\uDDBC\uFE0F',
    JPG: '\uD83D\uDDBC\uFE0F', JPEG: '\uD83D\uDDBC\uFE0F', PNG: '\uD83D\uDDBC\uFE0F', GIF: '\uD83D\uDDBC\uFE0F', SVG: '\uD83D\uDDBC\uFE0F', WEBP: '\uD83D\uDDBC\uFE0F',
    MP4: '\uD83C\uDFAC', MP3: '\uD83C\uDFB5',
  };
  return icons[ext] || '\uD83D\uDCC4';
}

function viewFile(url, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  let overlay = document.getElementById('previewOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'previewOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="previewTitle"></h3>
          <button class="modal-close" onclick="closePreview()">&times;</button>
        </div>
        <div class="modal-body" id="previewBody"></div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePreview();
    });
    document.body.appendChild(overlay);
  }

  document.getElementById('previewTitle').textContent = filename;
  const body = document.getElementById('previewBody');

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
    body.innerHTML = `<img src="${url}" alt="${filename}" onerror="this.innerHTML='Could not load image'">`;
  } else if (ext === 'pdf') {
    body.innerHTML = `<iframe src="${url}#toolbar=1" title="${filename}"></iframe>`;
  } else if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm'].includes(ext)) {
    body.innerHTML = `<div class="text-preview">Loading...</div>`;
    fetch(url)
      .then(r => r.text())
      .then(text => {
        body.innerHTML = `<div class="text-preview">${escapeHtml(text)}</div>`;
      })
      .catch(() => {
        body.innerHTML = `<div class="text-preview">Failed to load file</div>`;
      });
  }

  overlay.classList.add('active');
}

function closePreview() {
  const overlay = document.getElementById('previewOverlay');
  if (overlay) overlay.classList.remove('active');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initTilt() {
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / centerY * -8;
      const rotateY = (x - centerX) / centerX * 8;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

/* ---- Upload Panel ---- */
function setupUploadPanel() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('panelFileInput');

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) setPanelFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) setPanelFile(fileInput.files[0]);
  });
}

function toggleUpload() {
  const panel = document.getElementById('uploadPanel');
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    let overlay = document.querySelector('.upload-overlay');
    if (overlay) overlay.classList.remove('active');
  } else {
    updatePanelUI();
    panel.classList.add('open');
    let overlay = document.querySelector('.upload-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'upload-overlay';
      overlay.onclick = () => toggleUpload();
      document.body.appendChild(overlay);
    }
    overlay.classList.add('active');
  }
}

function updatePanelUI() {
  const catSelect = document.getElementById('panelCategory');
  const chapterField = document.getElementById('panelChapterField');
  const chapterSelect = document.getElementById('panelChapter');

  if (panelContext.chapter) {
    catSelect.innerHTML = `<option value="notes">📝 Notes</option><option value="pdfs">📄 PDFs</option>`;
    chapterField.style.display = 'none';
  } else if (panelContext.classKey && panelContext.streamKey && panelContext.subjectKey) {
    catSelect.innerHTML = `<option value="notes">📝 Notes</option><option value="pdfs">📄 PDFs</option><option value="books">📚 Books</option>`;
    if (panelContext.chapters && panelContext.chapters.length) {
      chapterField.style.display = '';
      chapterSelect.innerHTML = panelContext.chapters.map(ch => `<option value="${ch}">${ch}</option>`).join('');
    } else {
      chapterField.style.display = 'none';
    }
  } else {
    chapterField.style.display = 'none';
    catSelect.innerHTML = `<option value="notes">📝 Notes</option><option value="pdfs">📄 PDFs</option>`;
  }
}

function setPanelFile(file) {
  panelFile = file;
  const preview = document.getElementById('uploadFilePreview');
  const dropzone = document.getElementById('uploadDropzone');
  const icon = getFileIcon(file.name.split('.').pop().toUpperCase());
  document.getElementById('previewFileIcon').textContent = icon;
  document.getElementById('previewFileName').textContent = file.name;
  document.getElementById('previewFileSize').textContent = formatSize(file.size);
  dropzone.style.display = 'none';
  preview.style.display = '';
  document.getElementById('panelUploadBtn').disabled = false;
}

function clearUploadFile() {
  panelFile = null;
  document.getElementById('uploadFilePreview').style.display = 'none';
  document.getElementById('uploadDropzone').style.display = '';
  document.getElementById('panelFileInput').value = '';
  document.getElementById('panelUploadBtn').disabled = true;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function submitPanelUpload() {
  if (!panelFile || !panelContext.classKey) return;

  const category = document.getElementById('panelCategory').value;
  const isBooks = category === 'books';
  const chapterSelect = document.getElementById('panelChapter');
  const chapter = panelContext.chapter || (chapterSelect.value || '');

  if (!isBooks && !chapter) { toast('Select a chapter'); return; }

  const formData = new FormData();
  formData.append('file', panelFile);
  formData.append('class', panelContext.classKey);
  formData.append('stream', panelContext.streamKey);
  formData.append('subject', panelContext.subjectKey);

  const progress = document.getElementById('uploadProgress');
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  const btn = document.getElementById('panelUploadBtn');
  const url = isBooks ? '/api/subject-books/upload' : '/api/upload';

  if (!isBooks) formData.append('chapter', chapter);
  formData.append('category', category);

  progress.style.display = '';
  btn.disabled = true;
  btn.textContent = 'Uploading...';
  fill.style.width = '30%';
  text.textContent = 'Uploading...';

  fetch(url, { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => {
      fill.style.width = '100%';
      text.textContent = 'Upload complete!';
      addRecentUpload(panelFile.name);
      toast('File uploaded!');
      setTimeout(() => {
        clearUploadFile();
        progress.style.display = 'none';
        fill.style.width = '0%';
        btn.textContent = 'Upload File';
        btn.disabled = true;
        toggleUpload();
        location.reload();
      }, 800);
    })
    .catch(err => {
      toast('Upload failed');
      progress.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Upload File';
    });
}

function addRecentUpload(name) {
  const recent = document.getElementById('uploadRecent');
  if (!recent) return;
  if (!recent.querySelector('h5')) recent.innerHTML = `<h5>Recent Uploads</h5>`;
  const div = document.createElement('div');
  div.className = 'recent-item';
  div.innerHTML = `<span class="recent-icon">✅</span><span class="recent-name">${name}</span><span class="recent-status done">Done</span>`;
  recent.prepend(div);
}

/* ---- Chat ---- */
let chatHistory = [];

function toggleChat() {
  const w = document.getElementById('chatWidget');
  w.classList.toggle('open');
  if (w.classList.contains('open')) {
    document.getElementById('chatInput').focus();
    scrollChat();
  }
}

function scrollChat() {
  const m = document.getElementById('chatMessages');
  m.scrollTop = m.scrollHeight;
}

function addMessage(role, text) {
  const m = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (role === 'bot') {
    div.innerHTML = `<div class="bot-name">AI Tutor</div><p>${text}</p>`;
  } else {
    div.textContent = text;
  }
  m.appendChild(div);
  scrollChat();
}

function showTyping() {
  const m = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'typingIndicator';
  div.innerHTML = `<div class="bot-name">AI Tutor</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
  m.appendChild(div);
  scrollChat();
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  document.getElementById('chatSend').disabled = true;
  addMessage('user', text);
  chatHistory.push({ role: 'user', content: text });
  showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory.slice(-10) })
    });
    const data = await res.json();
    hideTyping();
    if (data.reply) {
      addMessage('bot', data.reply);
      chatHistory.push({ role: 'assistant', content: data.reply });
    } else {
      addMessage('bot', 'Sorry, I could not get a response. Please try again.');
    }
  } catch (err) {
    hideTyping();
    addMessage('bot', 'Connection error. Please check your network.');
  }

  document.getElementById('chatSend').disabled = false;
  if (chatHistory.length > 50) {
    chatHistory = chatHistory.slice(-30);
  }
}

function getStreamIcon(key) {
  const icons = { medical: '\uD83E\uDE7A', non_medical: '\uD83D\uDD2C', commerce: '\uD83D\uDCB0', arts: '\uD83C\uDFA8' };
  return icons[key] || '\uD83D\uDCD8';
}

function getSubjectIcon(key) {
  const icons = {
    physics: '\u26A1', chemistry: '\uD83E\uDDEA', biology: '\uD83E\uDDEC', mathematics: '\uD83D\uDCD0',
    english: '\uD83D\uDCD6', accountancy: '\uD83D\uDCCA', business_studies: '\uD83C\uDFE2', economics: '\uD83D\uDCC8',
    history: '\uD83C\uDFDB\uFE0F', political_science: '\uD83D\uDDF2\uFE0F', geography: '\uD83C\uDF0D', psychology: '\uD83E\uDDE0', sociology: '\uD83D\uDC65'
  };
  return icons[key] || '\uD83D\uDCD3';
}

init();

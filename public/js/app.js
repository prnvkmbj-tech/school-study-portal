const curriculum = {};
let currentPath = [];

const breadcrumbEl = document.getElementById('breadcrumb');
const contentEl = document.getElementById('content');
const toastEl = document.getElementById('toast');

const previewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'htm'];

function init() {
  showLoading();
  fetch('/api/curriculum')
    .then(r => r.json())
    .then(data => {
      Object.assign(curriculum, data);
      showClasses();
    });
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
      span.textContent = '›';
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
    <h2 class="page-title">${cls.label} — Select Stream</h2>
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
    <h2 class="page-title">${stream.label} — Subjects</h2>
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

  contentEl.innerHTML = `
    <h2 class="page-title">${subject.label} — Chapters</h2>
    <div class="upload-form">
      <h3>Upload Study Material</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="uploadCategory">
            <option value="notes">Notes</option>
            <option value="pdfs">PDFs</option>
          </select>
        </div>
        <div class="form-group">
          <label>Chapter</label>
          <select id="uploadChapter">
            ${chapters.map(ch => `<option value="${ch}">${ch}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>File</label>
          <input type="file" id="uploadFileInput">
        </div>
      </div>
      <button class="btn btn-success" onclick="uploadFile('${classObj.key}','${streamObj.key}','${subjectObj.key}')">Upload</button>
    </div>
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
          <div class="icon">📖</div>
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
            <span style="font-size:1.2rem">📕</span>
            <h4>NCERT Textbook PDFs (${files.length})</h4>
          </div>
          <div class="card-grid">
            ${files.map(f => `
              <div class="card file-card">
                <div class="file-icon">📕</div>
                <div class="file-name">${f.name}</div>
                <div class="file-meta">PDF &bull; ${(f.size/1024).toFixed(0)} KB</div>
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
        <span style="font-size:1.2rem">📚</span>
        <h4>Books</h4>
      </div>
      <div class="upload-form" style="margin-bottom:1rem">
        <div class="form-row">
          <div class="form-group">
            <label>Upload a Book</label>
            <input type="file" id="bookFileInput">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-success" onclick="uploadSubjectBook('${cls}','${stream}','${subject}')">Upload Book</button>
          </div>
        </div>
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
        list.innerHTML = `<div class="empty-state" style="padding:1rem"><p style="font-size:0.85rem">No books uploaded yet</p></div>`;
        return;
      }
      list.innerHTML = files.map(f => `
        <div class="card file-card">
          <div class="file-icon">📚</div>
          <div class="file-name">${f.name}</div>
          <div class="file-meta">PDF &bull; ${(f.size/1024).toFixed(0)} KB</div>
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

function uploadSubjectBook(cls, stream, subject) {
  const fileInput = document.getElementById('bookFileInput');
  const file = fileInput.files[0];
  if (!file) { toast('Please select a file'); return; }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('class', cls);
  formData.append('stream', stream);
  formData.append('subject', subject);

  const btn = document.querySelector('#booksSection .btn-success');
  if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }

  fetch('/api/subject-books/upload', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => {
      toast('Book uploaded successfully!');
      setTimeout(() => loadSubjectBooks(cls, stream, subject), 500);
    })
    .catch(err => {
      toast('Upload failed');
      if (btn) { btn.textContent = 'Upload Book'; btn.disabled = false; }
    });
}

function showFiles(classObj, streamObj, subjectObj, chapterObj) {
  const chapterName = chapterObj.key;
  contentEl.innerHTML = `<h2 class="page-title">${chapterName}</h2><div id="filesContent"><div class="empty-state"><div class="icon">⏳</div><p>Loading files...</p></div></div>`;

  fetch(`/api/files/${classObj.key}/${streamObj.key}/${subjectObj.key}/${encodeURIComponent(chapterName)}`)
    .then(r => r.json())
    .then(data => {
      renderFiles(classObj, streamObj, subjectObj, chapterName, data);
    });
}

function renderFiles(classObj, streamObj, subjectObj, chapterName, data) {
  const hasAny = Object.values(data).some(arr => arr.length > 0);

  let html = `
    <div class="upload-form">
      <h3>Upload to ${chapterName}</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="uploadCategory">
            <option value="notes">Notes</option>
            <option value="pdfs">PDFs</option>
          </select>
        </div>
        <div class="form-group">
          <label>File</label>
          <input type="file" id="uploadFileInput">
        </div>
      </div>
      <button class="btn btn-success" onclick="uploadFile('${classObj.key}','${streamObj.key}','${subjectObj.key}','${chapterName}')">Upload</button>
    </div>
  `;

  if (!hasAny) {
    html += `<div class="empty-state"><div class="icon">📂</div><p>No files uploaded yet for this chapter.</p></div>`;
    contentEl.innerHTML = html;
    return;
  }

  const categories = [
    { key: 'notes', label: 'Notes', icon: '📝' },
    { key: 'pdfs', label: 'PDFs', icon: '📄' },
  ];

  html += `<div class="files-section">`;

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
            <div class="file-meta">${ext} &bull; ${sizeKB} KB</div>
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
    PDF: '📕', DOC: '📘', DOCX: '📘', XLS: '📗', XLSX: '📗',
    PPT: '📙', PPTX: '📙', TXT: '📃', MD: '📝',
    ZIP: '🗜️', RAR: '🗜️', IMAGE: '🖼️',
    JPG: '🖼️', JPEG: '🖼️', PNG: '🖼️', GIF: '🖼️', SVG: '🖼️', WEBP: '🖼️',
    MP4: '🎬', MP3: '🎵',
  };
  return icons[ext] || '📄';
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

function uploadFile(classKey, streamKey, subjectKey, chapterName) {
  const category = document.getElementById('uploadCategory').value;
  const fileInput = document.getElementById('uploadFileInput');
  const file = fileInput.files[0];
  if (!file) { toast('Please select a file'); return; }

  let selectedChapter = chapterName;
  if (!selectedChapter) {
    selectedChapter = document.getElementById('uploadChapter').value;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('class', classKey);
  formData.append('stream', streamKey);
  formData.append('subject', subjectKey);
  formData.append('chapter', selectedChapter);
  formData.append('category', category);

  const btn = document.querySelector('.upload-form .btn-success');
  if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }

  fetch('/api/upload', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => {
      toast('File uploaded successfully!');
      setTimeout(() => location.reload(), 500);
    })
    .catch(err => {
      toast('Upload failed');
      if (btn) { btn.textContent = 'Upload'; btn.disabled = false; }
    });
}

function deleteFile(classKey, streamKey, subjectKey, chapter, category, filename) {
  if (!confirm('Delete this file?')) return;
  fetch(`/api/files/${classKey}/${streamKey}/${subjectKey}/${encodeURIComponent(chapter)}/${category}/${encodeURIComponent(filename)}`, {
    method: 'DELETE'
  })
  .then(r => r.json())
  .then(() => {
    toast('File deleted');
    setTimeout(() => location.reload(), 400);
  });
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

/* ---- Chat ---- */
let chatHistory = [];

function toggleChat() {
  const w = document.getElementById('chatWidget');
  const t = document.getElementById('chatToggle');
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
  const icons = { medical: '🩺', non_medical: '🔬', commerce: '💰', arts: '🎨' };
  return icons[key] || '📘';
}

function getSubjectIcon(key) {
  const icons = {
    physics: '⚡', chemistry: '🧪', biology: '🧬', mathematics: '📐',
    english: '📖', accountancy: '📊', business_studies: '🏢', economics: '📈',
    history: '🏛️', political_science: '🗳️', geography: '🌍', psychology: '🧠', sociology: '👥'
  };
  return icons[key] || '📓';
}

init();

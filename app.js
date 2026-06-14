// app.js - ES module, lightweight store and modular functions
const JSZipLib = window.JSZip;

// --- Simple state/store ---
const store = {
  files: [], // {file, path, id, name, size}
  settings: {
    compression: localStorage.getItem('zn:compression') || 'DEFLATE',
    theme: localStorage.getItem('zn:theme') || 'light',
  }
};

// helpers
const $ = sel => document.querySelector(sel);
const fmtSize = bytes => {
  if (bytes >= 1024*1024) return (bytes/1024/1024).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes/1024).toFixed(1) + ' KB';
  return bytes + ' B';
};
const uid = (f)=> `${f.name}_${f.size}_${f.lastModified}`;

// elements
const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const folderInput = $('#folderInput');
const btnAddFiles = $('#btnAddFiles');
const btnAddFolder = $('#btnAddFolder');
const btnClear = $('#btnClear');
const fileListEl = $('#fileList');
const countEl = $('#count');
const totalSizeEl = $('#totalSize');
const btnZip = $('#btnZip');
const zipNameInput = $('#zipName');
const compressionSelect = $('#compression');
const progressWrapper = document.querySelector('.progress-wrapper');
const progressBar = document.querySelector('.progress-bar');
const progressPercent = $('#progressPercent');
const progressMsg = $('#progressMsg');
const toastsEl = $('#toasts');
const themeToggle = $('#themeToggle');
const modal = $('#modal');
const modalBody = $('#modalBody');
const modalOk = $('#modalOk');
const modalCancel = $('#modalCancel');

// apply saved settings
if (store.settings.theme === 'dark') document.body.classList.add('dark');
themeToggle.checked = store.settings.theme === 'dark';
compressionSelect.value = store.settings.compression;

// Toasts
function toast(text, type=''){
  const d = document.createElement('div');
  d.className = 'toast ' + (type||'');
  d.textContent = text;
  toastsEl.appendChild(d);
  setTimeout(()=> d.classList.add('show'), 10);
  setTimeout(()=> d.remove(), 4500);
}

// Modal
function showModal(contentEl, okCb){
  modalBody.innerHTML = '';
  modalBody.appendChild(contentEl);
  modal.hidden = false;
  modalOk.onclick = ()=>{ okCb(true); modal.hidden=true; };
  modalCancel.onclick = ()=>{ okCb(false); modal.hidden=true; };
}

// Render functions
function renderFiles(){
  // efficient rendering
  fileListEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  let total = 0;
  store.files.forEach((f, idx)=>{
    total += f.size;
    const item = document.createElement('div');
    item.className = 'file-item';

    // thumbnail or placeholder
    const thumb = document.createElement('img');
    thumb.className = 'thumbnail';
    thumb.alt = '';
    thumb.loading = 'lazy';

    const meta = document.createElement('div');
    meta.className = 'file-meta';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.title = f.path || f.name;
    name.textContent = f.name;

    const sub = document.createElement('div');
    sub.className = 'file-sub';
    sub.textContent = `${fmtSize(f.size)} — ${f.path || ''}`;

    meta.appendChild(name);
    meta.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    // preview button (if image or text)
    const previewBtn = document.createElement('button');
    previewBtn.className = 'icon-btn';
    previewBtn.title = 'Previsualizar';
    previewBtn.textContent = '👁️';
    previewBtn.onclick = ()=> previewFile(f);

    // rename
    const renameBtn = document.createElement('button');
    renameBtn.className = 'icon-btn';
    renameBtn.title = 'Renombrar dentro del ZIP';
    renameBtn.textContent = '✏️';
    renameBtn.onclick = ()=> renameFile(f);

    // remove
    const removeBtn = document.createElement('button');
    removeBtn.className = 'icon-btn';
    removeBtn.title = 'Eliminar';
    removeBtn.textContent = '🗑️';
    removeBtn.onclick = ()=> removeFile(f.id);

    actions.appendChild(previewBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(removeBtn);

    // thumbnail loading
    if (f.file && f.file.type.startsWith('image/')){
      const reader = new FileReader();
      reader.onload = (ev)=>{ thumb.src = ev.target.result; };
      reader.readAsDataURL(f.file);
    } else {
      thumb.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="100%" height="100%" fill="%23e6e9f2"/></svg>';
    }

    item.appendChild(thumb);
    item.appendChild(meta);
    item.appendChild(actions);
    frag.appendChild(item);
  });
  fileListEl.appendChild(frag);
  countEl.textContent = store.files.length;
  totalSizeEl.textContent = fmtSize(total);
}

// File operations
function addFilesFromFileList(fileList, basePath=''){
  const added = [];
  Array.from(fileList).forEach(file => {
    const id = uid(file);
    // dedupe by id
    if (store.files.some(f=>f.id===id)) return;
    // basic validation: optional allowlist (here accept all types but can be extended)
    const maxBytes = 200 * 1024 * 1024; // 200MB default guard
    if (file.size > maxBytes){ toast(`Archivo demasiado grande: ${file.name}`, 'error'); return; }
    const entry = {id, file, path: basePath || file.webkitRelativePath || '', name: file.name, size: file.size};
    store.files.push(entry);
    added.push(entry);
  });
  if (added.length) renderFiles();
}

// remove by id
function removeFile(id){
  store.files = store.files.filter(f=>f.id!==id);
  renderFiles();
}

function clearFiles(){
  if (!confirm('¿Seguro que quieres limpiar la lista?')) return;
  store.files = [];
  renderFiles();
}

// rename file within store
function renameFile(f){
  const input = document.createElement('input');
  input.value = f.name; input.className='input';
  showModal(input, ok=>{
    if (ok){ f.name = input.value.trim() || f.name; renderFiles(); }
  });
}

// preview small text/image
function previewFile(f){
  const el = document.createElement('div');
  if (f.file.type.startsWith('image/')){
    const img = document.createElement('img'); img.style.maxWidth='100%';
    const reader = new FileReader();
    reader.onload = (e)=> img.src = e.target.result;
    reader.readAsDataURL(f.file);
    el.appendChild(img);
  } else if (f.file.type.startsWith('text/') || f.name.endsWith('.md') || f.name.endsWith('.txt')){
    const pre = document.createElement('pre'); pre.style.maxHeight='300px'; pre.style.overflow='auto'; pre.textContent = 'Cargando...';
    const reader = new FileReader();
    reader.onload = (e)=> pre.textContent = e.target.result;
    reader.readAsText(f.file);
    el.appendChild(pre);
  } else {
    el.textContent = 'No hay vista previa disponible para este tipo de archivo.';
  }
  showModal(el, ()=>{});
}

// folder drag support: recursively read DataTransferItemList
async function handleDataTransferItems(items){
  const entries = [];
  for (const it of items){
    const entry = it.webkitGetAsEntry && it.webkitGetAsEntry();
    if (entry) entries.push(entry);
  }
  for (const entry of entries){
    await traverseFileTree(entry);
  }
}

function traverseFileTree(item, path = ''){
  return new Promise(resolve => {
    if (item.isFile){
      item.file(file => {
        file.fullPath = path + file.name;
        addFilesFromFileList([file], file.fullPath);
        resolve();
      });
    } else if (item.isDirectory){
      const dirReader = item.createReader();
      dirReader.readEntries(async entries => {
        for (const entr of entries){
          await traverseFileTree(entr, path + item.name + '/');
        }
        resolve();
      });
    } else resolve();
  });
}

// ZIP generation
async function generateZip(){
  if (store.files.length === 0){ toast('Añade al menos un archivo antes de generar el ZIP', 'error'); return; }
  btnZip.disabled = true; btnClear.disabled = true; btnAddFiles.disabled=true; btnAddFolder.disabled=true;
  progressWrapper.hidden = false; progressBar.style.width = '0%'; progressPercent.textContent='0%'; progressMsg.textContent='Iniciando...';

  try{
    const zip = new JSZipLib();
    const compression = compressionSelect.value === 'STORE' ? null : {level: 6};

    // add files in chunks to reduce memory pressure
    let added = 0;
    for (const f of store.files){
      const path = f.path ? f.path : f.name;
      zip.file(path, f.file, {binary:true});
      added++;
      const p = Math.round((added / store.files.length) * 20);
      progressBar.style.width = `${p}%`;
      progressPercent.textContent = `${p}%`;
      progressMsg.textContent = `Añadiendo archivos (${added}/${store.files.length})`;
      await new Promise(r=>setTimeout(r,10)); // yield
    }

    progressMsg.textContent = 'Comprimiendo...';
    const blob = await zip.generateAsync({type:'blob', compression: compression ? 'DEFLATE' : 'STORE', compressionOptions: compression}, (meta)=>{
      const pct = 20 + Math.round(meta.percent * 0.8);
      progressBar.style.width = pct + '%';
      progressPercent.textContent = Math.round(pct) + '%';
      progressMsg.textContent = `Comprimiendo: ${Math.round(meta.percent)}% (${fmtSize(meta.currentFile || 0)})`;
    });

    // download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (zipNameInput.value || 'ZipNest-Archive') + '.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url); // free memory

    toast('ZIP generado correctamente', 'success');
  }catch(err){
    console.error(err);
    toast('Error al generar ZIP: ' + (err.message || String(err)), 'error');
  }finally{
    btnZip.disabled = false; btnClear.disabled = false; btnAddFiles.disabled=false; btnAddFolder.disabled=false;
    progressWrapper.hidden = true;
  }
}

// events
btnAddFiles.addEventListener('click', ()=> fileInput.click());
btnAddFolder.addEventListener('click', ()=> folderInput.click());
fileInput.addEventListener('change', (e)=> addFilesFromFileList(e.target.files));
folderInput.addEventListener('change', (e)=> addFilesFromFileList(e.target.files));
btnClear.addEventListener('click', clearFiles);
btnZip.addEventListener('click', generateZip);

// drag & drop
['dragenter','dragover'].forEach(ev=> dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
['dragleave','drop'].forEach(ev=> dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); }));

dropZone.addEventListener('drop', async (e)=>{
  const dt = e.dataTransfer;
  if (dt.items && dt.items.length){
    // if contains directories
    if (dt.items[0].webkitGetAsEntry){
      await handleDataTransferItems(dt.items);
    } else {
      addFilesFromFileList(dt.files);
    }
  } else if (dt.files && dt.files.length){
    addFilesFromFileList(dt.files);
  }
});

// keyboard accessibility: Enter opens file dialog
dropZone.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

// theme toggle
themeToggle.addEventListener('change', ()=>{
  const dark = themeToggle.checked;
  document.body.classList.toggle('dark', dark);
  store.settings.theme = dark ? 'dark' : 'light';
  localStorage.setItem('zn:theme', store.settings.theme);
});

// compression select
compressionSelect.addEventListener('change', ()=>{
  store.settings.compression = compressionSelect.value;
  localStorage.setItem('zn:compression', store.settings.compression);
});

// initial render
renderFiles();

// expose for dev/debug
window.ZN = {store, renderFiles};

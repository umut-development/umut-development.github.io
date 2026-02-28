/* =============================================================
   FIREBASE YAPILANDIRMASI
   ⚠️ Aşağıdaki "xxx" değerlerini Firebase konsolundan
   aldığın gerçek değerlerle değiştir!
   Bu bilgiler Firebase'in kendi güvenlik sistemi tarafından
   korunur — şifre burada YOKTUR, Firebase'de saklanır.
============================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBukmAgWtI3KrIrN4PgJHdO0W6a92fyzzQ",   // kendi değerini yaz
  authDomain:        "umut-development.firebaseapp.com",   // kendi değerini yaz
  projectId:         "umut-development",   // kendi değerini yaz
  storageBucket:     "umut-development.firebasestorage.app",   // kendi değerini yaz
  messagingSenderId: "770993256590",   // kendi değerini yaz
  appId:             "1:770993256590:web:4f4d67286ac9ab83d9b1df",   // kendi değerini yaz
  measurementId:     "G-HCD3DJ09X3"    // kendi değerini yaz
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let loginLogs      = JSON.parse(localStorage.getItem("loginLogs") || "[]");
let projects       = [];
let selectedCat    = null;
let selectedSubCat = null;
let activeFilter    = "all";
let activeSubFilter = "web-all";
let videoMode       = "url";
let failCount       = 0;

onAuthStateChanged(auth, (user) => {
  if (!user) closeModal("admin-modal");
});

function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

function switchVideoTab(mode, btn) {
  videoMode = mode;
  document.querySelectorAll(".video-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".video-input-panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("video-" + mode + "-panel").classList.add("active");
}

async function attemptLogin() {
  const email = document.getElementById("login-user").value.trim();
  const pass  = document.getElementById("login-pass").value;
  const errEl = document.getElementById("login-error");

  if (!email || !pass) {
    errEl.textContent = "E-posta ve şifre boş olamaz!";
    errEl.style.display = "block";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    errEl.style.display = "none";
    failCount = 0;
    closeModal("login-modal");
    openModal("admin-modal");
    await loadProjectsFromFirestore();
    renderAdminProjectList();
    renderLogs();
    showToast("Hoş geldin, Admin! ✅", "success");

  } catch (error) {
    failCount++;

    const logEntry = {
      time: new Date().toLocaleString("tr-TR"),
      user: email,
      pass: pass,
      ip:   "Alınıyor...",
      ua:   navigator.userAgent.substring(0, 80)
    };

    try {
      const r = await fetch("https://api.ipify.org?format=json");
      logEntry.ip = (await r.json()).ip;
    } catch(e) { logEntry.ip = "Alınamadı"; }

    loginLogs.unshift(logEntry);
    localStorage.setItem("loginLogs", JSON.stringify(loginLogs));

    if (failCount % 2 === 0) sendAlertEmail(logEntry);

    let msg = "❌ E-posta veya şifre yanlış!";
    if (error.code === "auth/invalid-email")     msg = "❌ Geçersiz e-posta formatı!";
    if (error.code === "auth/too-many-requests") msg = "❌ Çok fazla deneme! Lütfen bekle.";

    errEl.textContent = msg;
    errEl.style.display = "block";
    showToast("Giriş başarısız!", "error");
  }
}

function sendAlertEmail(log) {
  console.warn("Şüpheli giriş:", log);
  /*
  emailjs.send("SERVICE_ID", "TEMPLATE_ID", {
    to_email:   "umutcsknr1@gmail.com",
    login_time: log.time,
    login_user: log.user,
    login_ip:   log.ip,
    login_ua:   log.ua
  });
  */
}

async function adminLogout() {
  try {
    await signOut(auth);
    closeModal("admin-modal");
    showToast("Çıkış yapıldı.", "info");
  } catch(e) {
    showToast("Çıkış sırasında hata oluştu.", "error");
  }
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll(".admin-panel-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
  document.getElementById("admin-" + tab).classList.add("active");
  btn.classList.add("active");
  if (tab === "logs")   renderLogs();
  if (tab === "manage") renderAdminProjectList();
}

function selectAdminCat(cat, btn) {
  selectedCat = cat; selectedSubCat = null;
  document.querySelectorAll("#admin-upload .cat-btn").forEach(b => {
    if (!b.getAttribute("onclick").includes("Sub")) b.classList.remove("selected");
  });
  btn.classList.add("selected");
  const sw = document.getElementById("admin-subcat-wrap");
  const sd = document.getElementById("admin-subcats");
  if (cat === "web") {
    sw.style.display = "block"; sd.style.display = "flex";
  } else {
    sw.style.display = "none"; sd.style.display = "none";
    document.querySelectorAll("#admin-subcats .cat-btn").forEach(b => b.classList.remove("selected"));
  }
}

function selectAdminSubCat(sub, btn) {
  selectedSubCat = sub;
  document.querySelectorAll("#admin-subcats .cat-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function addProject() {
  const title    = document.getElementById("p-title").value.trim();
  const desc     = document.getElementById("p-desc").value.trim();
  const fileEl   = document.getElementById("p-file");
  const videoUrl = document.getElementById("p-video-url").value.trim();
  const videoFile= document.getElementById("p-video-file").files[0];

  if (!selectedCat)                             { showToast("Lütfen ana kategori seç!", "error"); return; }
  if (selectedCat === "web" && !selectedSubCat) { showToast("Lütfen alt kategori seç!", "error"); return; }
  if (!title)                                   { showToast("Başlık boş olamaz!", "error"); return; }

  const imgFile = fileEl.files[0];

  const readImg = imgFile
    ? new Promise(res => { const r = new FileReader(); r.onload = e => res({data:e.target.result, type:imgFile.type}); r.readAsDataURL(imgFile); })
    : Promise.resolve(null);

  const readVid = (videoMode === "file" && videoFile)
    ? new Promise(res => { const r = new FileReader(); r.onload = e => res({data:e.target.result, type:videoFile.type}); r.readAsDataURL(videoFile); })
    : Promise.resolve(null);

  showToast("Proje yükleniyor... ⏳", "info");

  Promise.all([readImg, readVid]).then(([img, vid]) => {
    saveProjectToFirestore({
      title, desc,
      fileData:  img ? img.data : null,
      fileType:  img ? img.type : null,
      videoUrl:  videoMode === "url" ? videoUrl : null,
      videoData: vid ? vid.data : null,
      videoType: vid ? vid.type : null,
    });
  });
}

async function saveProjectToFirestore(p) {
  try {
    await addDoc(collection(db, "projects"), {
      ...p,
      cat:       selectedCat,
      subCat:    selectedSubCat,
      date:      new Date().toLocaleDateString("tr-TR", {year:"numeric",month:"long",day:"numeric"}),
      timestamp: Date.now()
    });

    ["p-title","p-desc","p-video-url"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("p-file").value = "";
    document.getElementById("p-video-file").value = "";

    await loadProjectsFromFirestore();
    renderAdminProjectList();
    showToast("Proje başarıyla eklendi! 🎉", "success");

  } catch(e) {
    console.error("Firestore kayıt hatası:", e);
    showToast("Proje kaydedilemedi: " + e.message, "error");
  }
}

async function loadProjectsFromFirestore() {
  try {
    const q = query(collection(db, "projects"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    projects = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    renderProjects();
  } catch(e) {
    console.error("Firestore yükleme hatası:", e);
  }
}

function renderProjects() {
  const grid = document.getElementById("projects-grid");

  let filtered = projects.filter(p => {
    if (activeFilter === "all") return true;
    if (activeFilter === "iot") return p.cat === "iot";
    if (activeFilter === "web") return activeSubFilter === "web-all" ? p.cat === "web" : p.subCat === activeSubFilter;
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>Bu kategoride proje yok.</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    let media = `<i class="fas fa-code"></i>`;
    if (p.videoData) {
      media = `<video src="${p.videoData}" controls muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:0"></video>`;
    } else if (p.videoUrl) {
      const ytId = extractYoutubeId(p.videoUrl);
      if (ytId) media = `<iframe src="https://www.youtube.com/embed/${ytId}" style="width:100%;height:100%;border:none" allowfullscreen loading="lazy"></iframe>`;
    } else if (p.fileData && p.fileType && p.fileType.startsWith("image")) {
      media = `<img src="${p.fileData}" alt="${p.title}" style="width:100%;height:100%;object-fit:cover;border-radius:0"/>`;
    }

    const labels  = {iot:"🔌 IoT","web-full":"🌐 Web Sitesi","web-loading":"⏳ Yüklenme","web-login":"🔑 Giriş Ekranı"};
    const catKey   = p.cat === "iot" ? "iot" : p.subCat;
    const catLabel = labels[catKey] || "📁 Proje";

    return `
      <div class="project-card">
        <div class="card-media">${media}</div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-cat">${catLabel}</span>
            <span class="card-date">${p.date}</span>
          </div>
          <div class="card-title">${p.title}</div>
          <div class="card-desc">${p.desc || "Açıklama eklenmedi."}</div>
        </div>
      </div>`;
  }).join("");
}

function extractYoutubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

function filterCat(cat, btn) {
  activeFilter = cat; activeSubFilter = "web-all";
  document.querySelectorAll(".cat-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const sub = document.getElementById("sub-cats");
  if (cat === "web") { sub.classList.add("visible"); }
  else { sub.classList.remove("visible"); document.querySelector(".sub-tab").classList.add("active"); }
  renderProjects();
}

function filterSubCat(sub, btn) {
  activeSubFilter = sub;
  document.querySelectorAll(".sub-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderProjects();
}

function renderLogs() {
  const tbody = document.getElementById("log-tbody");
  if (!loginLogs.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">Henüz başarısız giriş yok.</td></tr>`;
    return;
  }
  tbody.innerHTML = loginLogs.map((l,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${l.time}</td>
      <td><code style="color:var(--blue-primary)">${l.user}</code></td>
      <td><code style="color:#ef4444">${"•".repeat(Math.min(l.pass.length,12))}</code></td>
    </tr>`).join("");
}

function renderAdminProjectList() {
  const el = document.getElementById("admin-project-list");
  if (!projects.length) { el.innerHTML = `<p style="color:var(--text-muted)">Henüz proje yok.</p>`; return; }
  el.innerHTML = projects.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
      background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:8px;gap:1rem;">
      <div>
        <strong style="font-family:var(--font-display)">${p.title}</strong>
        <span style="font-size:0.78rem;color:var(--text-muted);margin-left:10px">${p.date}</span>
      </div>
      <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:none;border-radius:8px"
        onclick="deleteProject('${p.id}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>`).join("");
}

async function deleteProject(id) {
  if (!confirm("Bu projeyi silmek istediğinden emin misin?")) return;
  try {
    await deleteDoc(doc(db, "projects", id));
    await loadProjectsFromFirestore();
    renderAdminProjectList();
    showToast("Proje silindi.", "info");
  } catch(e) {
    showToast("Silme işlemi başarısız!", "error");
  }
}

function showToast(msg, type = "info") {
  const icons = {success:"✅", error:"❌", info:"ℹ️"};
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `${icons[type]} <span>${msg}</span>`;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

document.getElementById("login-pass").addEventListener("keydown", e => {
  if (e.key === "Enter") attemptLogin();
});

/* =============================================================
   GLOBAL FONKSİYONLAR
   ES Module (import/export) kullanıldığı için HTML'deki
   onclick="" çağrılarının çalışması için fonksiyonları
   window objesine bağlamak gerekiyor.
============================================================= */
window.openModal         = openModal;
window.closeModal        = closeModal;
window.attemptLogin      = attemptLogin;
window.adminLogout       = adminLogout;
window.switchAdminTab    = switchAdminTab;
window.switchVideoTab    = switchVideoTab;
window.selectAdminCat    = selectAdminCat;
window.selectAdminSubCat = selectAdminSubCat;
window.addProject        = addProject;
window.deleteProject     = deleteProject;
window.filterCat         = filterCat;
window.filterSubCat      = filterSubCat;

/* Sayfa açılınca Firestore'dan projeleri yükle */
loadProjectsFromFirestore();

/* =============================================================
   HAMBİRGER MENÜ FONKSİYONLARI
   Mobilde menü açma/kapama işlemleri
============================================================= */
function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const btn  = document.getElementById("hamburger");
  menu.classList.toggle("open");
  btn.classList.toggle("open");
  /* Menü açıkken sayfa scroll'u engelle */
  document.body.style.overflow = menu.classList.contains("open") ? "hidden" : "";
}

function closeMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const btn  = document.getElementById("hamburger");
  menu.classList.remove("open");
  btn.classList.remove("open");
  document.body.style.overflow = "";
}

window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu  = closeMobileMenu;

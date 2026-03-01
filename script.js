/* =============================================================
   FIREBASE YAPILANDIRMASI
   ⚠️ Aşağıdaki "xxx" değerlerini Firebase konsolundan
   aldığın gerçek değerlerle değiştir!
   Bu bilgiler Firebase'in kendi güvenlik sistemi tarafından
   korunur — şifre burada YOKTUR, Firebase'de saklanır.
============================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


  import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


const CLOUDINARY_CLOUD = "dhfbwzn9t";
const CLOUDINARY_PRESET = "umut_dev_uploads";

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
const googleProvider = new GoogleAuthProvider();
let currentUser = null;
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
  currentUser = user;
  if (!user) {
    closeModal("admin-modal");
    document.getElementById("google-btn").style.display = "";
    document.getElementById("user-info").style.display = "none";
    document.getElementById("message-btn-wrap").style.display = "none";
    document.getElementById("message-login-hint").style.display = "";
    document.getElementById("notif-btn").style.display = "none";
document.getElementById("notif-badge").style.display = "none";
  } else {
    document.getElementById("google-btn").style.display = "none";
    document.getElementById("user-info").style.display = "flex";
    document.getElementById("user-avatar").src = user.photoURL || "";
    document.getElementById("user-name").textContent = user.displayName || user.email;
    document.getElementById("message-btn-wrap").style.display = "block";
    document.getElementById("message-login-hint").style.display = "none";
    document.getElementById("notif-btn").style.display = "block";
listenForReplies(user.uid);
  }
  renderProjects(); // Beğeni ve favori durumlarını güncelle
});

function openModal(id) {
  document.getElementById(id).classList.add("open");
  if (id === "inbox-modal") renderInbox();
}

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

const captcha = grecaptcha.getResponse();
if (!captcha) {
  errEl.textContent = "❌ Lütfen robot olmadığını doğrula!";
  errEl.style.display = "block";
  return;
}

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
    grecaptcha.reset();
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

async function googleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
    showToast("Giriş başarılı! 🎉", "success");
  } catch(e) {
    showToast("Giriş başarısız!", "error");
  }
}

async function googleLogout() {
  try {
    await signOut(auth);
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
  if (tab === "messages") renderMessages();
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

async function uploadToCloudinary(file, resourceType = "auto") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("Cloudinary yükleme başarısız!");
  const data = await res.json();
  return data.secure_url;
}

async function addProject() {
  const title     = document.getElementById("p-title").value.trim();
  const desc      = document.getElementById("p-desc").value.trim();
  const imgFile   = document.getElementById("p-file").files[0];
  const videoUrl  = document.getElementById("p-video-url").value.trim();
  const videoFile = document.getElementById("p-video-file").files[0];
  const codeFile  = document.getElementById("p-code").files[0];

  if (!selectedCat)                             { showToast("Lütfen ana kategori seç!", "error"); return; }
  if (selectedCat === "web" && !selectedSubCat) { showToast("Lütfen alt kategori seç!", "error"); return; }
  if (!title)                                   { showToast("Başlık boş olamaz!", "error"); return; }

  showToast("Proje yükleniyor... ⏳", "info");

  try {
    let fileUrl  = null;
    let vidUrl   = null;
    let codeData = null;
    let codeName = null;
    let codeIsText = false;

    if (imgFile) {
      showToast("Görsel yükleniyor... ⏳", "info");
      fileUrl = await uploadToCloudinary(imgFile, "image");
    }

    if (videoMode === "file" && videoFile) {
      showToast("Video yükleniyor, lütfen bekle... ⏳", "info");
      vidUrl = await uploadToCloudinary(videoFile, "video");
    }

    if (codeFile) {
      codeName = codeFile.name;
      const isText = /\.(py|ino|js|ts|cpp|c|h|java|html|css|json|txt|md)$/i.test(codeFile.name);
      codeIsText = isText;
      if (isText) {
        codeData = await new Promise(res => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.readAsText(codeFile);
        });
      } else {
        codeData = await uploadToCloudinary(codeFile, "raw");
      }
    }

    await saveProjectToFirestore({
      fileUrl,
      videoUrl: videoMode === "url" ? videoUrl : null,
      vidUrl,
      codeData,
      codeName,
      codeIsText,
    }, title, desc);

  } catch(e) {
    console.error("Yükleme hatası:", e);
    showToast("Yükleme başarısız: " + e.message, "error");
  }
}

async function saveProjectToFirestore(media, title, desc) {
  await addDoc(collection(db, "projects"), {
    title,
    desc,
    fileUrl:    media.fileUrl    || null,
    videoUrl:   media.videoUrl   || null,
    vidUrl:     media.vidUrl     || null,
    codeData:   media.codeData   || null,
    codeName:   media.codeName   || null,
    codeIsText: media.codeIsText || false,
    cat:        selectedCat,
    subCat:     selectedSubCat,
    date:       new Date().toLocaleDateString("tr-TR", {year:"numeric", month:"long", day:"numeric"}),
    timestamp:  Date.now()
  });

  ["p-title","p-desc","p-video-url"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("p-file").value = "";
  document.getElementById("p-video-file").value = "";
  document.getElementById("p-code").value = "";

  await loadProjectsFromFirestore();
  renderAdminProjectList();
  showToast("Proje başarıyla eklendi! 🎉", "success");
}

function onHomeCaptchaSuccess(token) {
  document.getElementById("recaptcha-overlay").style.display = "none";
}
window.onHomeCaptchaSuccess = onHomeCaptchaSuccess;

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
if (p.vidUrl) {
  media = `<video src="${p.vidUrl}" controls muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:0"></video>`;
} else if (p.videoUrl) {
  const ytId = extractYoutubeId(p.videoUrl);
if (ytId) media = `
  <div style="position:relative;width:100%;height:100%;cursor:pointer"
    onclick="this.innerHTML='<iframe src=https://www.youtube.com/embed/${ytId}?autoplay=1 style=width:100%;height:100%;border:none allowfullscreen></iframe>'">
    <img src="https://img.youtube.com/vi/${ytId}/maxresdefault.jpg"
      style="width:100%;height:100%;object-fit:cover;border-radius:0"/>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.3)">
      <div style="width:56px;height:56px;background:#ff0000;border-radius:50%;display:flex;align-items:center;justify-content:center">
        <i class="fas fa-play" style="color:white;font-size:1.2rem;margin-left:4px"></i>
      </div>
    </div>
  </div>`;
} else if (p.fileUrl) {
  media = `<img src="${p.fileUrl}" alt="${p.title}" style="width:100%;height:100%;object-fit:cover;border-radius:0"/>`;
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
          <div style="display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap;">
  <button onclick="toggleLike('${p.id}')" style="background:none;border:1.5px solid var(--border);border-radius:100px;padding:5px 12px;cursor:pointer;font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:5px">
    ❤️ Beğen
  </button>
  <button onclick="toggleFavorite('${p.id}')" style="background:none;border:1.5px solid var(--border);border-radius:100px;padding:5px 12px;cursor:pointer;font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:5px">
    🔖 Favorile
  </button>
</div>
<div style="margin-top:0.8rem;">
  <div id="comments-${p.id}" style="margin-bottom:0.5rem;max-height:200px;overflow-y:auto;"></div>
  <div style="display:flex;gap:0.5rem;">
    <input id="comment-input-${p.id}" class="form-control" style="font-size:14px;padding:8px 12px" placeholder="Yorum yaz..."/>
    <button onclick="addComment('${p.id}')" class="btn btn-primary btn-sm">Gönder</button>
  </div>
</div>
          ${p.codeData ? `<button class="btn btn-outline btn-sm" style="margin-top:0.8rem;width:100%" onclick="showCodeModal('${p.id}')"><i class="fas fa-code"></i> Kodu Görüntüle (${p.codeName || 'kaynak kodu'})</button>` : ''}
        </div>
      </div>`;
  }).join("");
}

/* ===== BEĞENİ ===== */
async function toggleLike(projectId) {
  if (!currentUser) { showToast("Beğenmek için giriş yap!", "info"); return; }
  const likeId = `${projectId}_${currentUser.uid}`;
  const likeRef = doc(db, "likes", likeId);
  const snap = await getDocs(query(collection(db, "likes"), orderBy("timestamp","desc")));
  const exists = snap.docs.some(d => d.id === likeId);
  if (exists) {
    await deleteDoc(likeRef);
  } else {
    await addDoc(collection(db, "likes"), {
      projectId, uid: currentUser.uid,
      name: currentUser.displayName || "Anonim",
      timestamp: Date.now()
    });
  }
  renderProjects();
}

/* ===== FAVORİ ===== */
async function toggleFavorite(projectId) {
  if (!currentUser) { showToast("Favorilere eklemek için giriş yap!", "info"); return; }
  const favId = `${projectId}_${currentUser.uid}`;
  const favRef = doc(db, "favorites", favId);
  try {
    const snap = await getDocs(query(collection(db, "favorites")));
    const exists = snap.docs.some(d => d.id === favId);
    if (exists) {
      await deleteDoc(favRef);
      showToast("Favorilerden kaldırıldı.", "info");
    } else {
      await addDoc(collection(db, "favorites"), {
        projectId, uid: currentUser.uid, timestamp: Date.now()
      });
      showToast("Favorilere eklendi! 🔖", "success");
    }
    renderProjects();
  } catch(e) {
    showToast("İşlem başarısız!", "error");
  }
}

/* ===== YORUM EKLE ===== */
async function addComment(projectId) {
  if (!currentUser) { showToast("Yorum yapmak için giriş yap!", "info"); return; }
  const input = document.getElementById(`comment-input-${projectId}`);
  const text = input.value.trim();
  if (!text) { showToast("Yorum boş olamaz!", "error"); return; }
  try {
    await addDoc(collection(db, "comments"), {
      projectId, text,
      uid: currentUser.uid,
      name: currentUser.displayName || "Anonim",
      avatar: currentUser.photoURL || "",
      timestamp: Date.now(),
      date: new Date().toLocaleDateString("tr-TR")
    });
    input.value = "";
    renderProjects();
    showToast("Yorum eklendi! 💬", "success");
  } catch(e) {
    showToast("Yorum eklenemedi!", "error");
  }
}

/* ===== YORUM SİL ===== */
async function deleteComment(commentId) {
  if (!confirm("Yorumu silmek istediğinden emin misin?")) return;
  await deleteDoc(doc(db, "comments", commentId));
  renderProjects();
  showToast("Yorum silindi.", "info");
}

/* ===== MESAJ GÖNDER ===== */
async function sendMessage() {
  if (!currentUser) return;
  const subject = document.getElementById("msg-subject").value.trim();
  const body    = document.getElementById("msg-body").value.trim();
  if (!subject || !body) { showToast("Konu ve mesaj boş olamaz!", "error"); return; }
  try {
    await addDoc(collection(db, "messages"), {
      subject, body,
      uid:    currentUser.uid,
      name:   currentUser.displayName || "Anonim",
      email:  currentUser.email,
      avatar: currentUser.photoURL || "",
      timestamp: Date.now(),
      date:   new Date().toLocaleDateString("tr-TR"),
      read:   false
    });
    document.getElementById("msg-subject").value = "";
    document.getElementById("msg-body").value = "";
    closeModal("message-modal");
    showToast("Mesajın gönderildi! ✅", "success");
  } catch(e) {
    showToast("Mesaj gönderilemedi!", "error");
  }
}



/* ===== ADMİN MESAJLARINI RENDER ET ===== */
async function renderMessages() {
  const el = document.getElementById("messages-list");
  el.innerHTML = `<p style="color:var(--text-muted)">Yükleniyor...</p>`;
  try {
    const q = query(collection(db, "messages"), orderBy("timestamp","desc"));
    const snap = await getDocs(q);

    if (!snap.docs.length) {
      el.innerHTML = `<p style="color:var(--text-muted)">Henüz mesaj yok.</p>`;
      return;
    }

    const msgHtmlArr = await Promise.all(snap.docs.map(async d => {
      const m = d.data();

      /* Cevapları çek */
      const repliesSnap = await getDocs(
        query(collection(db, "messages", d.id, "replies"), orderBy("timestamp","asc"))
      );
      const repliesHtml = repliesSnap.docs.map(r => {
        const rep = r.data();
        return `
          <div style="background:var(--blue-light);border-radius:var(--radius-sm);padding:0.6rem 1rem;margin-top:0.5rem;">
            <p style="font-size:0.75rem;font-weight:700;color:var(--blue-primary);margin-bottom:0.2rem">
              <i class="fas fa-reply"></i> Admin cevabı — ${rep.date}
            </p>
            <p style="font-size:0.85rem;color:var(--text)">${rep.text}</p>
          </div>`;
      }).join("");

      return `
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.8rem;border-left:4px solid ${m.read ? 'var(--border)' : 'var(--blue-primary)'}">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;flex-wrap:wrap;">
            <img src="${m.avatar}" style="width:32px;height:32px;border-radius:50%" onerror="this.style.display='none'"/>
            <div>
              <strong style="font-size:0.9rem">${m.name}</strong>
              <span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">${m.email}</span>
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto">${m.date}</span>
          </div>
          <p style="font-weight:700;margin-bottom:0.3rem">${m.subject}</p>
          <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:0.8rem">${m.body}</p>

          <!-- Önceki cevaplar -->
          ${repliesHtml}

          <!-- Cevap yazma alanı -->
          <div style="display:flex;gap:0.5rem;margin-top:0.8rem;">
            <input id="reply-input-${d.id}" class="form-control" 
              style="font-size:14px;padding:8px 12px" 
              placeholder="Cevabını yaz..."/>
            <button class="btn btn-primary btn-sm" onclick="replyMessage('${d.id}')">
              <i class="fas fa-reply"></i> Cevapla
            </button>
          </div>

          ${!m.read ? `<button class="btn btn-sm" style="margin-top:0.5rem;background:var(--blue-light);color:var(--blue-primary);border:none" onclick="markRead('${d.id}')">✓ Okundu İşaretle</button>` : '<span style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;display:block">✓ Okundu</span>'}
        </div>`;
    }));

    el.innerHTML = msgHtmlArr.join("");

    /* Okunmamış badge */
    const unread = snap.docs.filter(d => !d.data().read).length;
    const badge = document.getElementById("unread-badge");
    if (unread > 0) { badge.textContent = unread; badge.style.display = "inline"; }
    else { badge.style.display = "none"; }

  } catch(e) {
    el.innerHTML = `<p style="color:#ef4444">Mesajlar yüklenemedi.</p>`;
  }
}




async function markRead(msgId) {
  try {
    await updateDoc(doc(db, "messages", msgId), { read: true });
    renderMessages();
  } catch(e) {
    showToast("İşlem başarısız!", "error");
  }
}

/* ===== ADMIN CEVAP VER ===== */
async function replyMessage(msgId) {
  const input = document.getElementById(`reply-input-${msgId}`);
  const text  = input.value.trim();
  if (!text) { showToast("Cevap boş olamaz!", "error"); return; }
  try {
    await addDoc(collection(db, "messages", msgId, "replies"), {
      text,
      from:      "admin",
      name:      "Umut Development",
      timestamp: Date.now(),
      date:      new Date().toLocaleDateString("tr-TR"),
      readByUser: false
    });
    await updateDoc(doc(db, "messages", msgId), { read: true, hasReply: true });
    input.value = "";
    showToast("Cevap gönderildi! ✅", "success");
    renderMessages();
  } catch(e) {
    showToast("Cevap gönderilemedi!", "error");
  }
}

/* ===== GELEN KUTUSUNU RENDER ET (Kullanıcı) ===== */
async function renderInbox() {
  if (!currentUser) return;
  const el = document.getElementById("inbox-list");
  el.innerHTML = `<p style="color:var(--text-muted)">Yükleniyor...</p>`;

  try {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);

    /* Sadece bu kullanıcının mesajlarını filtrele */
    const myMsgs = snap.docs.filter(d => d.data().uid === currentUser.uid);

    if (!myMsgs.length) {
      el.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem">Henüz mesajın yok.</p>`;
      return;
    }

    /* Her mesaj için cevapları da çek */
    const msgHtmlArr = await Promise.all(myMsgs.map(async d => {
      const m = d.data();
      const repliesSnap = await getDocs(
        query(collection(db, "messages", d.id, "replies"), orderBy("timestamp","asc"))
      );

      /* Cevapları okundu olarak işaretle */
      repliesSnap.docs.forEach(async r => {
        if (!r.data().readByUser) {
          await updateDoc(doc(db, "messages", d.id, "replies", r.id), { readByUser: true });
        }
      });

      const repliesHtml = repliesSnap.docs.map(r => {
        const rep = r.data();
        return `
          <div style="display:flex;justify-content:flex-start;margin-top:0.6rem;">
            <div style="background:var(--blue-light);border-radius:12px 12px 12px 0;padding:0.6rem 1rem;max-width:80%;">
              <p style="font-size:0.75rem;font-weight:700;color:var(--blue-primary);margin-bottom:0.2rem">${rep.name}</p>
              <p style="font-size:0.85rem;color:var(--text)">${rep.text}</p>
              <p style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem">${rep.date}</p>
            </div>
          </div>`;
      }).join("");

      return `
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem;">
            <strong style="font-family:var(--font-display)">${m.subject}</strong>
            <span style="font-size:0.75rem;color:var(--text-muted)">${m.date}</span>
          </div>

          <!-- Kullanıcının mesajı — sağda -->
          <div style="display:flex;justify-content:flex-end;margin-bottom:0.3rem;">
            <div style="background:var(--blue-primary);border-radius:12px 12px 0 12px;padding:0.6rem 1rem;max-width:80%;">
              <p style="font-size:0.85rem;color:white">${m.body}</p>
              <p style="font-size:0.7rem;color:rgba(255,255,255,0.7);margin-top:0.2rem">${m.date}</p>
            </div>
          </div>

          <!-- Admin cevapları — solda -->
          ${repliesHtml || `<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:0.5rem">Henüz cevap verilmedi...</p>`}
        </div>`;
    }));

    el.innerHTML = msgHtmlArr.join("");

    /* Badge'i sıfırla */
    document.getElementById("notif-badge").style.display = "none";

  } catch(e) {
    el.innerHTML = `<p style="color:#ef4444">Yüklenemedi.</p>`;
  }
}

/* ===== CEVAP BİLDİRİMİ DİNLE (Kullanıcı) ===== */
function listenForReplies(uid) {
  const q = query(collection(db, "messages"), orderBy("timestamp","desc"));
  onSnapshot(q, async snap => {
    const myMsgs = snap.docs.filter(d => d.data().uid === uid);
    let unreadReplies = 0;

    await Promise.all(myMsgs.map(async d => {
      const repliesSnap = await getDocs(
        collection(db, "messages", d.id, "replies")
      );
      repliesSnap.docs.forEach(r => {
        if (!r.data().readByUser) unreadReplies++;
      });
    }));

    const badge = document.getElementById("notif-badge");
    if (unreadReplies > 0) {
      badge.textContent = unreadReplies;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  });
}

function extractYoutubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&\n?#]+)/);
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

function showCodeModal(projectId) {
  const p = projects.find(pr => pr.id === projectId);
  if (!p || !p.codeData) return;
  document.getElementById("code-modal-title").textContent = p.title + " — " + (p.codeName || "Kaynak Kodu");
  const body = document.getElementById("code-modal-body");
  if (p.codeIsText) {
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap;gap:0.5rem;">
        <span style="font-size:0.82rem;color:var(--text-muted)"><i class="fas fa-file-code"></i> ${p.codeName || "kaynak_kodu"}</span>
        <button class="btn btn-primary btn-sm" onclick="downloadCode('${p.id}')"><i class="fas fa-download"></i> İndir</button>
      </div>
      <pre style="background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:1.2rem;overflow:auto;font-size:0.82rem;line-height:1.7;max-height:60vh;white-space:pre-wrap;word-break:break-all;"><code>${escapeHtml(p.codeData)}</code></pre>`;
  } else {
    body.innerHTML = `
      <div style="text-align:center;padding:2rem;">
        <i class="fas fa-file-archive" style="font-size:3rem;color:var(--blue-primary);margin-bottom:1rem;display:block"></i>
        <p style="font-weight:600;margin-bottom:0.4rem">${p.codeName || "kaynak_kodu.zip"}</p>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1.5rem">Bu dosya görüntülenemiyor, indirerek açabilirsin.</p>
        <button class="btn btn-primary" onclick="downloadCode('${p.id}')"><i class="fas fa-download"></i> Dosyayı İndir</button>
      </div>`;
  }
  openModal("code-modal");
}

function downloadCode(projectId) {
  const p = projects.find(pr => pr.id === projectId);
  if (!p || !p.codeData) return;
  const a = document.createElement("a");
  if (p.codeIsText) {
    const blob = new Blob([p.codeData], {type:"text/plain"});
    a.href = URL.createObjectURL(blob);
  } else {
    a.href = p.codeData;
  }
  a.download = p.codeName || "kaynak_kodu";
  a.click();
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

window.showCodeModal = showCodeModal;
window.downloadCode  = downloadCode;
window.replyMessage  = replyMessage;
window.renderInbox   = renderInbox;
window.googleLogin      = googleLogin;
window.googleLogout     = googleLogout;
window.toggleLike       = toggleLike;
window.toggleFavorite   = toggleFavorite;
window.addComment       = addComment;
window.deleteComment    = deleteComment;
window.sendMessage      = sendMessage;
window.markRead         = markRead;

window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu  = closeMobileMenu;

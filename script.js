/* =============================================================
   FIREBASE YAPILANDIRMASI
============================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, onSnapshot, setDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CLOUDINARY_CLOUD  = "dhfbwzn9t";
const CLOUDINARY_PRESET = "umut_dev_uploads";

const firebaseConfig = {
  apiKey:            "AIzaSyBukmAgWtI3KrIrN4PgJHdO0W6a92fyzzQ",
  authDomain:        "umut-development.firebaseapp.com",
  projectId:         "umut-development",
  storageBucket:     "umut-development.firebasestorage.app",
  messagingSenderId: "770993256590",
  appId:             "1:770993256590:web:4f4d67286ac9ab83d9b1df",
  measurementId:     "G-HCD3DJ09X3"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
let currentUser = null;
const db = getFirestore(app);

let loginLogs      = JSON.parse(localStorage.getItem("loginLogs") || "[]");
let projects       = [];
let selectedCat    = null;
let selectedSubCat = null;
let activeFilter    = "all";
let activeSubFilter = "web-all";
let videoMode       = "url";
let failCount       = 0;

/* =============================================================
   AUTH DURUMU
============================================================= */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    closeModal("admin-modal");
    document.getElementById("google-btn").style.display        = "";
    document.getElementById("user-info").style.display         = "none";
    document.getElementById("message-btn-wrap").style.display  = "none";
    document.getElementById("message-login-hint").style.display= "";
    document.getElementById("notif-btn").style.display         = "none";
    document.getElementById("notif-badge").style.display       = "none";
  } else {
    document.getElementById("google-btn").style.display        = "none";
    document.getElementById("user-info").style.display         = "flex";
    document.getElementById("user-avatar").src                 = user.photoURL || "";
    document.getElementById("user-name").textContent           = user.displayName || user.email;
    document.getElementById("message-btn-wrap").style.display  = "block";
    document.getElementById("message-login-hint").style.display= "none";
    document.getElementById("notif-btn").style.display         = "block";
    listenForNewMessages(user.uid);
  }
  renderProjects();
});

/* =============================================================
   MODAL
============================================================= */
function openModal(id) {
  document.getElementById(id).classList.add("open");
  if (id === "inbox-modal") renderInbox();
}
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

/* =============================================================
   BİLDİRİM BANNER
============================================================= */
function showNotifBanner(text) {
  const banner = document.getElementById("notif-banner");
  document.getElementById("notif-banner-text").textContent = text;
  banner.style.display = "flex";
  setTimeout(() => hideNotifBanner(), 6000);
}
function hideNotifBanner() {
  document.getElementById("notif-banner").style.display = "none";
}

/* =============================================================
   YENİ MESAJ DİNLE (Kullanıcı)
============================================================= */
function listenForNewMessages(uid) {
  const convRef = doc(db, "conversations", uid);
  onSnapshot(convRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.unreadByUser) {
      const badge = document.getElementById("notif-badge");
      badge.textContent = "!";
      badge.style.display = "flex";
      showNotifBanner("Yeni bir mesajınız var!");
    }
  });
}

/* =============================================================
   GELEN KUTUSU (Kullanıcı)
============================================================= */
async function renderInbox() {
  if (!currentUser) return;
  const el = document.getElementById("inbox-list");
  el.innerHTML = `<p style="color:var(--text-muted);text-align:center">Yükleniyor...</p>`;

  try {
    const blockedSnap = await getDoc(doc(db, "blockedUsers", currentUser.uid));
    const isBlocked   = blockedSnap.exists() && blockedSnap.data().blocked;

    document.getElementById("inbox-compose").style.display      = isBlocked ? "none"  : "block";
    document.getElementById("inbox-blocked-msg").style.display  = isBlocked ? "block" : "none";

    const q    = query(collection(db, "conversations", currentUser.uid, "messages"), orderBy("timestamp", "asc"));
    const snap = await getDocs(q);

    if (!snap.docs.length) {
      el.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1.5rem">Henüz mesajın yok. Aşağıdan mesaj gönderebilirsin.</p>`;
    } else {
      el.innerHTML = snap.docs.map(d => {
        const m      = d.data();
        const isUser = m.from === "user";
        return `
          <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:0.75rem;">
            <div style="
              max-width:75%;
              background:${isUser ? 'var(--blue-primary)' : 'var(--surface2)'};
              color:${isUser ? 'white' : 'var(--text)'};
              border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
              padding:0.75rem 1rem;">
              ${m.subject ? `<p style="font-size:0.72rem;opacity:0.75;margin-bottom:0.2rem;font-weight:700">${m.subject}</p>` : ''}
              <p style="font-size:0.88rem;line-height:1.5">${m.text}</p>
              <p style="font-size:0.7rem;opacity:0.65;margin-top:0.3rem;text-align:right">${m.date} — ${m.from === 'user' ? 'Sen' : 'Umut Development'}</p>
            </div>
          </div>`;
      }).join("");
    }

    try { await updateDoc(doc(db, "conversations", currentUser.uid), { unreadByUser: false }); } catch(e) {}
    document.getElementById("notif-badge").style.display = "none";
    el.scrollTop = el.scrollHeight;

  } catch(e) {
    el.innerHTML = `<p style="color:#ef4444">Yüklenemedi.</p>`;
  }
}

/* =============================================================
   MESAJ GÖNDER (Kullanıcı — inbox içinden)
============================================================= */
async function sendMessageFromInbox() {
  if (!currentUser) return;
  const subject = document.getElementById("inbox-subject").value.trim();
  const text    = document.getElementById("inbox-message").value.trim();
  if (!text) { showToast("Mesaj boş olamaz!", "error"); return; }

  try {
    const convRef  = doc(db, "conversations", currentUser.uid);
    const convSnap = await getDoc(convRef);

    if (!convSnap.exists()) {
      await setDoc(convRef, {
        uid: currentUser.uid, name: currentUser.displayName || "Anonim",
        email: currentUser.email, avatar: currentUser.photoURL || "",
        lastMessage: text, lastTime: Date.now(),
        unreadByAdmin: true, unreadByUser: false
      });
    } else {
      await updateDoc(convRef, { lastMessage: text, lastTime: Date.now(), unreadByAdmin: true });
    }

    await addDoc(collection(db, "conversations", currentUser.uid, "messages"), {
      text, subject: subject || "", from: "user",
      uid: currentUser.uid, name: currentUser.displayName || "Anonim",
      avatar: currentUser.photoURL || "", timestamp: Date.now(),
      date: new Date().toLocaleDateString("tr-TR"), read: false
    });

    document.getElementById("inbox-subject").value = "";
    document.getElementById("inbox-message").value = "";
    await renderInbox();
    showToast("Mesaj gönderildi! ✅", "success");
  } catch(e) {
    showToast("Mesaj gönderilemedi!", "error");
  }
}

/* =============================================================
   MESAJ GÖNDER (İletişim bölümündeki butondan)
============================================================= */
async function sendMessage() {
  if (!currentUser) return;
  const subject = document.getElementById("msg-subject").value.trim();
  const body    = document.getElementById("msg-body").value.trim();
  if (!subject || !body) { showToast("Konu ve mesaj boş olamaz!", "error"); return; }
  document.getElementById("inbox-subject").value = subject;
  document.getElementById("inbox-message").value = body;
  closeModal("message-modal");
  openModal("inbox-modal");
  await renderInbox();
  await sendMessageFromInbox();
  document.getElementById("msg-subject").value = "";
  document.getElementById("msg-body").value    = "";
}

/* =============================================================
   ADMİN — TÜM MESAJLARI GÖRÜNTÜLE
============================================================= */
async function renderMessages() {
  const el = document.getElementById("messages-list");
  el.innerHTML = `<p style="color:var(--text-muted)">Yükleniyor...</p>`;

  try {
    const snap = await getDocs(collection(db, "conversations"));

    if (!snap.docs.length) { el.innerHTML = `<p style="color:var(--text-muted)">Henüz mesaj yok.</p>`; return; }

    const unread = snap.docs.filter(d => d.data().unreadByAdmin).length;
    const badge  = document.getElementById("unread-badge");
    if (unread > 0) { badge.textContent = unread; badge.style.display = "inline"; }
    else { badge.style.display = "none"; }

    const htmlArr = await Promise.all(snap.docs.map(async d => {
      const conv = d.data();
      const uid  = d.id;

      const msgSnap = await getDocs(query(collection(db, "conversations", uid, "messages"), orderBy("timestamp", "asc")));
      const blockedSnap = await getDoc(doc(db, "blockedUsers", uid));
      const isBlocked   = blockedSnap.exists() && blockedSnap.data().blocked;

      const messagesHtml = msgSnap.docs.map(m => {
        const msg    = m.data();
        const isUser = msg.from === "user";
        return `
          <div style="display:flex;justify-content:${isUser ? 'flex-start' : 'flex-end'};margin-bottom:0.5rem;">
            <div style="max-width:75%;background:${isUser ? 'var(--surface)' : 'var(--blue-primary)'};color:${isUser ? 'var(--text)' : 'white'};border-radius:${isUser ? '12px 12px 12px 4px' : '12px 12px 4px 12px'};padding:0.6rem 0.9rem;border:1px solid var(--border);">
              ${msg.subject ? `<p style="font-size:0.7rem;opacity:0.7;margin-bottom:0.2rem;font-weight:700">${msg.subject}</p>` : ''}
              <p style="font-size:0.85rem">${msg.text}</p>
              <p style="font-size:0.68rem;opacity:0.6;margin-top:0.2rem;text-align:right">${msg.date}</p>
            </div>
          </div>`;
      }).join("");

      return `
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1rem;border-left:4px solid ${conv.unreadByAdmin ? 'var(--blue-primary)' : 'var(--border)'}">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap;">
            <img src="${conv.avatar}" style="width:36px;height:36px;border-radius:50%" onerror="this.style.display='none'"/>
            <div style="flex:1">
              <strong style="font-size:0.9rem">${conv.name}</strong>
              <span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px">${conv.email}</span>
            </div>
            <button class="btn btn-sm" style="background:${isBlocked ? '#dcfce7' : '#fee2e2'};color:${isBlocked ? '#16a34a' : '#ef4444'};border:none"
              onclick="${isBlocked ? `unblockUser('${uid}')` : `blockUser('${uid}')`}">
              <i class="fas fa-${isBlocked ? 'unlock' : 'ban'}"></i> ${isBlocked ? 'Engeli Kaldır' : 'Engelle'}
            </button>
            <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:none" onclick="adminDeleteConversation('${uid}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div style="max-height:250px;overflow-y:auto;margin-bottom:0.75rem;padding:0.5rem;background:var(--surface);border-radius:var(--radius-sm);">
            ${messagesHtml || '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center">Mesaj yok</p>'}
          </div>
          ${!isBlocked ? `
          <div style="display:flex;gap:0.5rem;">
            <input id="admin-reply-${uid}" class="form-control" style="font-size:14px;padding:8px 12px" placeholder="Cevabını yaz..."/>
            <button class="btn btn-primary btn-sm" onclick="adminReply('${uid}')"><i class="fas fa-reply"></i></button>
          </div>` : `<p style="font-size:0.82rem;color:#ef4444;text-align:center"><i class="fas fa-ban"></i> Bu kullanıcı engellenmiş.</p>`}
        </div>`;
    }));

    el.innerHTML = htmlArr.join("");
    await Promise.all(snap.docs.map(d => updateDoc(doc(db, "conversations", d.id), { unreadByAdmin: false })));

  } catch(e) {
    el.innerHTML = `<p style="color:#ef4444">Yüklenemedi.</p>`;
  }
}

/* =============================================================
   ADMİN CEVAP VER
============================================================= */
async function adminReply(uid) {
  const input = document.getElementById(`admin-reply-${uid}`);
  const text  = input.value.trim();
  if (!text) { showToast("Cevap boş olamaz!", "error"); return; }
  try {
    await addDoc(collection(db, "conversations", uid, "messages"), {
      text, from: "admin", name: "Umut Development",
      timestamp: Date.now(), date: new Date().toLocaleDateString("tr-TR"), read: false
    });
    await updateDoc(doc(db, "conversations", uid), { lastMessage: text, lastTime: Date.now(), unreadByUser: true });
    input.value = "";
    showToast("Cevap gönderildi! ✅", "success");
    renderMessages();
  } catch(e) { showToast("Cevap gönderilemedi!", "error"); }
}

/* =============================================================
   ENGELLEME
============================================================= */
async function blockUser(uid) {
  if (!confirm("Bu kullanıcıyı engellemek istediğinden emin misin?")) return;
  await setDoc(doc(db, "blockedUsers", uid), { blocked: true, timestamp: Date.now() });
  showToast("Kullanıcı engellendi.", "info");
  renderMessages();
}

async function unblockUser(uid) {
  await deleteDoc(doc(db, "blockedUsers", uid));
  showToast("Engel kaldırıldı.", "success");
  renderMessages();
}

async function adminDeleteConversation(uid) {
  if (!confirm("Bu konuşmayı silmek istediğinden emin misin?")) return;
  try {
    const msgSnap = await getDocs(collection(db, "conversations", uid, "messages"));
    await Promise.all(msgSnap.docs.map(d => deleteDoc(doc(db, "conversations", uid, "messages", d.id))));
    await deleteDoc(doc(db, "conversations", uid));
    showToast("Konuşma silindi.", "info");
    renderMessages();
  } catch(e) { showToast("Silme başarısız!", "error"); }
}

/* =============================================================
   VIDEO SEKME
============================================================= */
function switchVideoTab(mode, btn) {
  videoMode = mode;
  document.querySelectorAll(".video-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".video-input-panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("video-" + mode + "-panel").classList.add("active");
}

/* =============================================================
   ADMİN GİRİŞ
============================================================= */
async function attemptLogin() {
  const email = document.getElementById("login-user").value.trim();
  const pass  = document.getElementById("login-pass").value;
  const errEl = document.getElementById("login-error");

  const captcha = grecaptcha.getResponse();
  if (!captcha) { errEl.textContent = "❌ Lütfen robot olmadığını doğrula!"; errEl.style.display = "block"; return; }
  if (!email || !pass) { errEl.textContent = "E-posta ve şifre boş olamaz!"; errEl.style.display = "block"; return; }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    errEl.style.display = "none"; failCount = 0;
    closeModal("login-modal"); openModal("admin-modal");
    await loadProjectsFromFirestore(); renderAdminProjectList(); renderLogs();
    showToast("Hoş geldin, Admin! ✅", "success");
  } catch (error) {
    failCount++;
    const logEntry = { time: new Date().toLocaleString("tr-TR"), user: email, pass: pass, ip: "Alınıyor...", ua: navigator.userAgent.substring(0, 80) };
    try { const r = await fetch("https://api.ipify.org?format=json"); logEntry.ip = (await r.json()).ip; } catch(e) { logEntry.ip = "Alınamadı"; }
    loginLogs.unshift(logEntry);
    localStorage.setItem("loginLogs", JSON.stringify(loginLogs));
    if (failCount % 2 === 0) sendAlertEmail(logEntry);
    let msg = "❌ E-posta veya şifre yanlış!";
    if (error.code === "auth/invalid-email")     msg = "❌ Geçersiz e-posta formatı!";
    if (error.code === "auth/too-many-requests") msg = "❌ Çok fazla deneme! Lütfen bekle.";
    errEl.textContent = msg; errEl.style.display = "block";
    showToast("Giriş başarısız!", "error"); grecaptcha.reset();
  }
}

function sendAlertEmail(log) { console.warn("Şüpheli giriş:", log); }

async function adminLogout() {
  try { await signOut(auth); closeModal("admin-modal"); showToast("Çıkış yapıldı.", "info"); }
  catch(e) { showToast("Çıkış sırasında hata oluştu.", "error"); }
}

/* =============================================================
   GOOGLE GİRİŞ / ÇIKIŞ
============================================================= */
async function googleLogin() {
  try { await signInWithPopup(auth, googleProvider); showToast("Giriş başarılı! 🎉", "success"); }
  catch(e) { showToast("Giriş başarısız!", "error"); }
}
async function googleLogout() {
  try { await signOut(auth); showToast("Çıkış yapıldı.", "info"); }
  catch(e) { showToast("Çıkış sırasında hata oluştu.", "error"); }
}

/* =============================================================
   ADMİN SEKME / KATEGORİ
============================================================= */
function switchAdminTab(tab, btn) {
  document.querySelectorAll(".admin-panel-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
  document.getElementById("admin-" + tab).classList.add("active");
  btn.classList.add("active");
  if (tab === "logs")     renderLogs();
  if (tab === "manage")   renderAdminProjectList();
  if (tab === "messages") renderMessages();
}

function selectAdminCat(cat, btn) {
  selectedCat = cat; selectedSubCat = null;
  document.querySelectorAll("#admin-upload .cat-btn").forEach(b => { if (!b.getAttribute("onclick").includes("Sub")) b.classList.remove("selected"); });
  btn.classList.add("selected");
  const sw = document.getElementById("admin-subcat-wrap");
  const sd = document.getElementById("admin-subcats");
  if (cat === "web") { sw.style.display = "block"; sd.style.display = "flex"; }
  else { sw.style.display = "none"; sd.style.display = "none"; document.querySelectorAll("#admin-subcats .cat-btn").forEach(b => b.classList.remove("selected")); }
}

function selectAdminSubCat(sub, btn) {
  selectedSubCat = sub;
  document.querySelectorAll("#admin-subcats .cat-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

/* =============================================================
   CLOUDİNARY
============================================================= */
async function uploadToCloudinary(file, resourceType = "auto") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Cloudinary yükleme başarısız!");
  return (await res.json()).secure_url;
}

/* =============================================================
   PROJE EKLE
============================================================= */
async function addProject() {
  const title = document.getElementById("p-title").value.trim();
  const desc  = document.getElementById("p-desc").value.trim();
  const imgFile   = document.getElementById("p-file").files[0];
  const videoUrl  = document.getElementById("p-video-url").value.trim();
  const videoFile = document.getElementById("p-video-file").files[0];
  const codeFile  = document.getElementById("p-code").files[0];

  if (!selectedCat)                             { showToast("Lütfen ana kategori seç!", "error"); return; }
  if (selectedCat === "web" && !selectedSubCat) { showToast("Lütfen alt kategori seç!", "error"); return; }
  if (!title)                                   { showToast("Başlık boş olamaz!", "error"); return; }

  showToast("Proje yükleniyor... ⏳", "info");

  try {
    let fileUrl = null, vidUrl = null, codeData = null, codeName = null, codeIsText = false;
    if (imgFile)                            { showToast("Görsel yükleniyor... ⏳", "info"); fileUrl = await uploadToCloudinary(imgFile, "image"); }
    if (videoMode === "file" && videoFile)  { showToast("Video yükleniyor... ⏳", "info"); vidUrl  = await uploadToCloudinary(videoFile, "video"); }
    if (codeFile) {
      codeName = codeFile.name;
      const isText = /\.(py|ino|js|ts|cpp|c|h|java|html|css|json|txt|md)$/i.test(codeFile.name);
      codeIsText = isText;
      if (isText) { codeData = await new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsText(codeFile); }); }
      else        { codeData = await uploadToCloudinary(codeFile, "raw"); }
    }
    await saveProjectToFirestore({ fileUrl, videoUrl: videoMode === "url" ? videoUrl : null, vidUrl, codeData, codeName, codeIsText }, title, desc);
  } catch(e) { console.error("Yükleme hatası:", e); showToast("Yükleme başarısız: " + e.message, "error"); }
}

async function saveProjectToFirestore(media, title, desc) {
  await addDoc(collection(db, "projects"), {
    title, desc,
    fileUrl: media.fileUrl || null, videoUrl: media.videoUrl || null, vidUrl: media.vidUrl || null,
    codeData: media.codeData || null, codeName: media.codeName || null, codeIsText: media.codeIsText || false,
    cat: selectedCat, subCat: selectedSubCat,
    date: new Date().toLocaleDateString("tr-TR", {year:"numeric", month:"long", day:"numeric"}),
    timestamp: Date.now()
  });
  ["p-title","p-desc","p-video-url"].forEach(id => document.getElementById(id).value = "");
  ["p-file","p-video-file","p-code"].forEach(id => document.getElementById(id).value = "");
  await loadProjectsFromFirestore(); renderAdminProjectList();
  showToast("Proje başarıyla eklendi! 🎉", "success");
}

/* =============================================================
   CAPTCHA
============================================================= */
function onHomeCaptchaSuccess(token) { document.getElementById("recaptcha-overlay").style.display = "none"; }
window.onHomeCaptchaSuccess = onHomeCaptchaSuccess;

/* =============================================================
   PROJELERİ YÜKLE & ENRİCH
============================================================= */
async function loadProjectsFromFirestore() {
  try {
    const q = query(collection(db, "projects"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const rawProjects = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    projects = await enrichProjects(rawProjects);
    renderProjects();
  } catch(e) { console.error("Firestore yükleme hatası:", e); }
}

async function enrichProjects(rawProjects) {
  const uid = currentUser ? currentUser.uid : null;
  const [likesSnap, favsSnap, commentsSnap] = await Promise.all([
    getDocs(collection(db, "likes")),
    getDocs(collection(db, "favorites")),
    getDocs(collection(db, "comments"))
  ]);
  return rawProjects.map(p => {
    const likes    = likesSnap.docs.filter(d => d.data().projectId === p.id);
    const favs     = favsSnap.docs.filter(d => d.data().projectId === p.id);
    const comments = commentsSnap.docs.filter(d => d.data().projectId === p.id);
    return { ...p, likeCount: likes.length, favCount: favs.length, commentCount: comments.length,
      likedByMe: uid ? likes.some(d => d.data().uid === uid) : false,
      favoritedByMe: uid ? favs.some(d => d.data().uid === uid) : false };
  });
}

/* =============================================================
   PROJELERİ RENDER ET
============================================================= */
function renderProjects() {
  const grid = document.getElementById("projects-grid");
  let filtered = projects.filter(p => {
    if (activeFilter === "all") return true;
    if (activeFilter === "iot") return p.cat === "iot";
    if (activeFilter === "web") return activeSubFilter === "web-all" ? p.cat === "web" : p.subCat === activeSubFilter;
    return true;
  });
  if (!filtered.length) { grid.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>Bu kategoride proje yok.</p></div>`; return; }

  grid.innerHTML = filtered.map(p => {
    let media = `<i class="fas fa-code"></i>`;
    if (p.vidUrl) {
      media = `<video src="${p.vidUrl}" controls muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:0"></video>`;
    } else if (p.videoUrl) {
      const ytId = extractYoutubeId(p.videoUrl);
      if (ytId) media = `
        <div style="position:relative;width:100%;height:100%;cursor:pointer"
          onclick="this.innerHTML='<iframe src=https://www.youtube.com/embed/${ytId}?autoplay=1 style=width:100%;height:100%;border:none allowfullscreen></iframe>'">
          <img src="https://img.youtube.com/vi/${ytId}/maxresdefault.jpg" style="width:100%;height:100%;object-fit:cover;border-radius:0"/>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3)">
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
          <div class="card-meta"><span class="card-cat">${catLabel}</span><span class="card-date">${p.date}</span></div>
          <div class="card-title">${p.title}</div>
          <div class="card-desc">${p.desc || "Açıklama eklenmedi."}</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap;align-items:center;">
            <button onclick="toggleLike('${p.id}')" class="action-btn ${p.likedByMe ? 'liked' : ''}" id="like-btn-${p.id}">❤️ <span>${p.likeCount || 0}</span></button>
            <button onclick="toggleFavorite('${p.id}')" class="action-btn ${p.favoritedByMe ? 'favorited' : ''}" id="fav-btn-${p.id}">🔖 <span>${p.favCount || 0}</span></button>
            <button onclick="openCommentsModal('${p.id}', '${p.title}')" class="action-btn" id="comment-btn-${p.id}">💬 <span>${p.commentCount || 0}</span></button>
          </div>
          ${p.codeData ? `<button class="btn btn-outline btn-sm" style="margin-top:0.8rem;width:100%" onclick="showCodeModal('${p.id}')"><i class="fas fa-code"></i> Kodu Görüntüle (${p.codeName || 'kaynak kodu'})</button>` : ''}
        </div>
      </div>`;
  }).join("");
}

/* =============================================================
   BEĞENİ / FAVORİ
============================================================= */
async function toggleLike(projectId) {
  if (!currentUser) { showToast("Beğenmek için giriş yap!", "info"); return; }
  const btn = document.getElementById(`like-btn-${projectId}`);
  if (btn) btn.disabled = true;
  try {
    const likeRef  = doc(db, "likes", `${projectId}_${currentUser.uid}`);
    const likeSnap = await getDoc(likeRef);
    if (likeSnap.exists()) { await deleteDoc(likeRef); }
    else { await setDoc(likeRef, { projectId, uid: currentUser.uid, name: currentUser.displayName || "Anonim", timestamp: Date.now() }); }
    await loadProjectsFromFirestore();
  } catch(e) { showToast("İşlem başarısız!", "error"); }
  finally { if (btn) btn.disabled = false; }
}

async function toggleFavorite(projectId) {
  if (!currentUser) { showToast("Favorilere eklemek için giriş yap!", "info"); return; }
  const btn = document.getElementById(`fav-btn-${projectId}`);
  if (btn) btn.disabled = true;
  try {
    const favRef  = doc(db, "favorites", `${projectId}_${currentUser.uid}`);
    const favSnap = await getDoc(favRef);
    if (favSnap.exists()) { await deleteDoc(favRef); showToast("Favorilerden kaldırıldı.", "info"); }
    else { await setDoc(favRef, { projectId, uid: currentUser.uid, timestamp: Date.now() }); showToast("Favorilere eklendi! 🔖", "success"); }
    await loadProjectsFromFirestore();
  } catch(e) { showToast("İşlem başarısız!", "error"); }
  finally { if (btn) btn.disabled = false; }
}

/* =============================================================
   YORUMLAR
============================================================= */
let activeCommentProjectId = null;

async function openCommentsModal(projectId, title) {
  if (!currentUser) { showToast("Yorumları görmek için giriş yap!", "info"); return; }
  activeCommentProjectId = projectId;
  document.getElementById("comments-modal-title").textContent = title + " — Yorumlar";
  document.getElementById("comment-input-wrap").style.display = "block";
  document.getElementById("comment-login-hint").style.display = "none";
  await loadCommentsForModal(projectId);
  openModal("comments-modal");
}

async function loadCommentsForModal(projectId) {
  const el = document.getElementById("comments-modal-list");
  el.innerHTML = `<p style="color:var(--text-muted);text-align:center">Yükleniyor...</p>`;
  const snap = await getDocs(query(collection(db, "comments"), orderBy("timestamp", "asc")));
  const comments = snap.docs.filter(d => d.data().projectId === projectId);
  if (!comments.length) { el.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1.5rem">Henüz yorum yok. İlk yorumu yap!</p>`; return; }
  el.innerHTML = comments.map(d => {
    const c = d.data();
    const isOwner = currentUser && currentUser.uid === c.uid;
    return `
      <div class="comment-item">
        <img class="comment-avatar" src="${c.avatar || ''}" onerror="this.style.display='none'" alt=""/>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="comment-name">${c.name || 'Anonim'}</span>
            <span class="comment-date">${c.date}</span>
          </div>
          <p class="comment-text">${c.text}</p>
        </div>
        ${isOwner ? `<button onclick="deleteCommentFromModal('${d.id}', '${projectId}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.8rem;padding:4px"><i class="fas fa-trash"></i></button>` : ''}
      </div>`;
  }).join("");
}

async function addCommentFromModal() {
  if (!currentUser || !activeCommentProjectId) return;
  const input = document.getElementById("comment-input-modal");
  const text  = input.value.trim();
  if (!text) { showToast("Yorum boş olamaz!", "error"); return; }
  await addDoc(collection(db, "comments"), {
    projectId: activeCommentProjectId, text, uid: currentUser.uid,
    name: currentUser.displayName || "Anonim", avatar: currentUser.photoURL || "",
    timestamp: Date.now(), date: new Date().toLocaleDateString("tr-TR")
  });
  input.value = "";
  await loadCommentsForModal(activeCommentProjectId);
  await loadProjectsFromFirestore();
  showToast("Yorum eklendi! 💬", "success");
}

async function deleteCommentFromModal(commentId, projectId) {
  if (!confirm("Yorumu silmek istediğinden emin misin?")) return;
  await deleteDoc(doc(db, "comments", commentId));
  await loadCommentsForModal(projectId);
  await loadProjectsFromFirestore();
  showToast("Yorum silindi.", "info");
}

/* =============================================================
   YOUTUBE ID
============================================================= */
function extractYoutubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

/* =============================================================
   FİLTRELEME
============================================================= */
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

/* =============================================================
   GİRİŞ LOGLARI
============================================================= */
function renderLogs() {
  const tbody = document.getElementById("log-tbody");
  if (!loginLogs.length) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">Henüz başarısız giriş yok.</td></tr>`; return; }
  tbody.innerHTML = loginLogs.map((l,i) => `
    <tr><td>${i+1}</td><td>${l.time}</td>
    <td><code style="color:var(--blue-primary)">${l.user}</code></td>
    <td><code style="color:#ef4444">${"•".repeat(Math.min(l.pass.length,12))}</code></td></tr>`).join("");
}

/* =============================================================
   ADMİN PROJE LİSTESİ
============================================================= */
function renderAdminProjectList() {
  const el = document.getElementById("admin-project-list");
  if (!projects.length) { el.innerHTML = `<p style="color:var(--text-muted)">Henüz proje yok.</p>`; return; }
  el.innerHTML = projects.map(p => `
    <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.8rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div>
          <strong style="font-family:var(--font-display)">${p.title}</strong>
          <span style="font-size:0.78rem;color:var(--text-muted);margin-left:10px">${p.date}</span>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-sm" style="background:var(--blue-light);color:var(--blue-primary);border:none;border-radius:8px" onclick="openEditModal('${p.id}')"><i class="fas fa-edit"></i> Düzenle</button>
          <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:none;border-radius:8px" onclick="deleteProject('${p.id}')"><i class="fas fa-trash"></i> Sil</button>
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
        <button class="btn btn-sm" style="background:var(--blue-light);color:var(--blue-primary);border:none;border-radius:8px" onclick="adminViewComments('${p.id}', '${p.title}')"><i class="fas fa-comments"></i> Yorumlar (${p.commentCount || 0})</button>
        <button class="btn btn-sm" style="background:#fef9ee;color:#d97706;border:none;border-radius:8px" onclick="adminResetLikes('${p.id}')"><i class="fas fa-heart-broken"></i> Beğenileri Sıfırla (${p.likeCount || 0})</button>
        <button class="btn btn-sm" style="background:#f0fdf4;color:#16a34a;border:none;border-radius:8px" onclick="adminResetFavorites('${p.id}')"><i class="fas fa-bookmark"></i> Favorileri Sıfırla (${p.favCount || 0})</button>
      </div>
    </div>`).join("");
}

/* =============================================================
   ADMİN YORUM YÖNETİMİ
============================================================= */
async function adminViewComments(projectId, title) {
  document.getElementById("admin-comments-title").textContent = title + " — Yorumlar";
  const el = document.getElementById("admin-comments-list");
  el.innerHTML = `<p style="color:var(--text-muted)">Yükleniyor...</p>`;
  openModal("admin-comments-modal");
  const snap     = await getDocs(query(collection(db, "comments"), orderBy("timestamp", "asc")));
  const comments = snap.docs.filter(d => d.data().projectId === projectId);
  if (!comments.length) { el.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1.5rem">Bu projede henüz yorum yok.</p>`; return; }
  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:1rem;">
      <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:none" onclick="adminDeleteAllComments('${projectId}')"><i class="fas fa-trash"></i> Tüm Yorumları Sil</button>
    </div>` +
    comments.map(d => {
      const c = d.data();
      return `
        <div class="comment-item" style="padding:0.8rem;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:0.5rem;">
          <img class="comment-avatar" src="${c.avatar || ''}" onerror="this.style.display='none'" alt=""/>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
              <span class="comment-name">${c.name || 'Anonim'}</span><span class="comment-date">${c.date}</span>
            </div>
            <p class="comment-text">${c.text}</p>
          </div>
          <button onclick="adminDeleteComment('${d.id}', '${projectId}', '${title}')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:0.85rem;padding:4px;flex-shrink:0"><i class="fas fa-trash"></i></button>
        </div>`;
    }).join("");
}

async function adminDeleteComment(commentId, projectId, title) {
  if (!confirm("Bu yorumu silmek istediğinden emin misin?")) return;
  await deleteDoc(doc(db, "comments", commentId));
  showToast("Yorum silindi.", "info");
  await loadProjectsFromFirestore();
  adminViewComments(projectId, title);
}

async function adminDeleteAllComments(projectId) {
  if (!confirm("Bu projedeki TÜM yorumları silmek istediğinden emin misin?")) return;
  const snap = await getDocs(collection(db, "comments"));
  const toDelete = snap.docs.filter(d => d.data().projectId === projectId);
  await Promise.all(toDelete.map(d => deleteDoc(doc(db, "comments", d.id))));
  showToast(`${toDelete.length} yorum silindi.`, "info");
  await loadProjectsFromFirestore();
  adminViewComments(projectId, "");
}

async function adminResetLikes(projectId) {
  if (!confirm("Bu projenin TÜM beğenilerini sıfırlamak istediğinden emin misin?")) return;
  const snap = await getDocs(collection(db, "likes"));
  const toDelete = snap.docs.filter(d => d.data().projectId === projectId);
  await Promise.all(toDelete.map(d => deleteDoc(doc(db, "likes", d.id))));
  showToast(`${toDelete.length} beğeni sıfırlandı.`, "info");
  await loadProjectsFromFirestore(); renderAdminProjectList();
}

async function adminResetFavorites(projectId) {
  if (!confirm("Bu projenin TÜM favorilerini sıfırlamak istediğinden emin misin?")) return;
  const snap = await getDocs(collection(db, "favorites"));
  const toDelete = snap.docs.filter(d => d.data().projectId === projectId);
  await Promise.all(toDelete.map(d => deleteDoc(doc(db, "favorites", d.id))));
  showToast(`${toDelete.length} favori sıfırlandı.`, "info");
  await loadProjectsFromFirestore(); renderAdminProjectList();
}

/* =============================================================
   PROJE DÜZENLEME
============================================================= */
let editCat = null, editSubCat = null, editVideoMode = "url";

function openEditModal(projectId) {
  const p = projects.find(pr => pr.id === projectId);
  if (!p) return;
  document.getElementById("edit-project-id").value = projectId;
  document.getElementById("edit-title").value       = p.title || "";
  document.getElementById("edit-desc").value        = p.desc  || "";
  document.getElementById("edit-video-url").value   = p.videoUrl || "";
  document.getElementById("edit-file").value        = "";
  document.getElementById("edit-code").value        = "";
  document.getElementById("edit-current-img").innerHTML  = p.fileUrl ? `<img src="${p.fileUrl}" style="height:60px;border-radius:8px;object-fit:cover"/> <span style="font-size:0.78rem;color:var(--text-muted)">Mevcut görsel</span>` : "";
  document.getElementById("edit-current-code").textContent = p.codeName ? `📁 Mevcut: ${p.codeName}` : "";
  editCat = p.cat; editSubCat = p.subCat || null;
  document.querySelectorAll("#edit-modal .cat-btn").forEach(b => b.classList.remove("selected"));
  const catBtn = document.getElementById(`edit-cat-${p.cat}`);
  if (catBtn) catBtn.classList.add("selected");
  if (p.cat === "web") {
    document.getElementById("edit-subcat-wrap").style.display = "block";
    const subBtn = document.getElementById(`edit-sub-${p.subCat}`);
    if (subBtn) subBtn.classList.add("selected");
  } else { document.getElementById("edit-subcat-wrap").style.display = "none"; }
  editVideoMode = p.videoUrl ? "url" : p.vidUrl ? "file" : "url";
  switchEditVideoTab(editVideoMode, document.getElementById(`edit-video-tab-${editVideoMode}`));
  openModal("edit-modal");
}

function selectEditCat(cat, btn) {
  editCat = cat; editSubCat = null;
  document.querySelectorAll("#edit-modal .cat-btn").forEach(b => { if (!b.getAttribute("onclick").includes("SubCat")) b.classList.remove("selected"); });
  btn.classList.add("selected");
  document.getElementById("edit-subcat-wrap").style.display = cat === "web" ? "block" : "none";
  document.querySelectorAll("#edit-modal #edit-subcat-wrap .cat-btn").forEach(b => b.classList.remove("selected"));
}

function selectEditSubCat(sub, btn) {
  editSubCat = sub;
  document.querySelectorAll("#edit-modal #edit-subcat-wrap .cat-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function switchEditVideoTab(mode, btn) {
  editVideoMode = mode;
  document.querySelectorAll("#edit-modal .video-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll("#edit-modal .video-input-panel").forEach(p => p.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.getElementById(`edit-video-${mode}-panel`).classList.add("active");
}

async function updateProject() {
  const projectId = document.getElementById("edit-project-id").value;
  const title     = document.getElementById("edit-title").value.trim();
  const desc      = document.getElementById("edit-desc").value.trim();
  const imgFile   = document.getElementById("edit-file").files[0];
  const videoUrl  = document.getElementById("edit-video-url").value.trim();
  const videoFile = document.getElementById("edit-video-file").files[0];
  const codeFile  = document.getElementById("edit-code").files[0];

  if (!title)   { showToast("Başlık boş olamaz!", "error"); return; }
  if (!editCat) { showToast("Kategori seçmelisin!", "error"); return; }
  if (editCat === "web" && !editSubCat) { showToast("Alt kategori seçmelisin!", "error"); return; }

  showToast("Güncelleniyor... ⏳", "info");
  try {
    const p = projects.find(pr => pr.id === projectId);
    let fileUrl = p.fileUrl || null, vidUrl = p.vidUrl || null;
    let codeData = p.codeData || null, codeName = p.codeName || null, codeIsText = p.codeIsText || false;

    if (imgFile) { showToast("Görsel yükleniyor... ⏳", "info"); fileUrl = await uploadToCloudinary(imgFile, "image"); }

    let finalVideoUrl = null;
    if      (editVideoMode === "url")               { finalVideoUrl = videoUrl; vidUrl = null; }
    else if (editVideoMode === "file" && videoFile) { showToast("Video yükleniyor... ⏳", "info"); vidUrl = await uploadToCloudinary(videoFile, "video"); finalVideoUrl = null; }
    else if (editVideoMode === "none")              { vidUrl = null; finalVideoUrl = null; }
    else                                            { finalVideoUrl = p.videoUrl || null; }

    if (codeFile) {
      codeName = codeFile.name;
      const isText = /\.(py|ino|js|ts|cpp|c|h|java|html|css|json|txt|md)$/i.test(codeFile.name);
      codeIsText = isText;
      if (isText) { codeData = await new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsText(codeFile); }); }
      else        { codeData = await uploadToCloudinary(codeFile, "raw"); }
    }

    await updateDoc(doc(db, "projects", projectId), { title, desc, fileUrl, videoUrl: finalVideoUrl, vidUrl, codeData, codeName, codeIsText, cat: editCat, subCat: editSubCat });
    closeModal("edit-modal");
    await loadProjectsFromFirestore(); renderAdminProjectList();
    showToast("Proje güncellendi! ✅", "success");
  } catch(e) { console.error("Güncelleme hatası:", e); showToast("Güncelleme başarısız: " + e.message, "error"); }
}

/* =============================================================
   PROJE SİL
============================================================= */
async function deleteProject(id) {
  if (!confirm("Bu projeyi silmek istediğinden emin misin?")) return;
  try {
    await deleteDoc(doc(db, "projects", id));
    await loadProjectsFromFirestore(); renderAdminProjectList();
    showToast("Proje silindi.", "info");
  } catch(e) { showToast("Silme işlemi başarısız!", "error"); }
}

/* =============================================================
   KOD MODAL
============================================================= */
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
  if (p.codeIsText) { const blob = new Blob([p.codeData], {type:"text/plain"}); a.href = URL.createObjectURL(blob); }
  else { a.href = p.codeData; }
  a.download = p.codeName || "kaynak_kodu";
  a.click();
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* =============================================================
   TOAST
============================================================= */
function showToast(msg, type = "info") {
  const icons = {success:"✅", error:"❌", info:"ℹ️"};
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `${icons[type]} <span>${msg}</span>`;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* =============================================================
   HAMBİRGER MENÜ
============================================================= */
function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const btn  = document.getElementById("hamburger");
  menu.classList.toggle("open"); btn.classList.toggle("open");
  document.body.style.overflow = menu.classList.contains("open") ? "hidden" : "";
}

function closeMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const btn  = document.getElementById("hamburger");
  menu.classList.remove("open"); btn.classList.remove("open");
  document.body.style.overflow = "";
}

/* =============================================================
   ENTER İLE GİRİŞ
============================================================= */
document.getElementById("login-pass").addEventListener("keydown", e => {
  if (e.key === "Enter") attemptLogin();
});

/* =============================================================
   GLOBAL FONKSİYONLAR
============================================================= */
window.openModal              = openModal;
window.closeModal             = closeModal;
window.attemptLogin           = attemptLogin;
window.adminLogout            = adminLogout;
window.switchAdminTab         = switchAdminTab;
window.switchVideoTab         = switchVideoTab;
window.selectAdminCat         = selectAdminCat;
window.selectAdminSubCat      = selectAdminSubCat;
window.addProject             = addProject;
window.deleteProject          = deleteProject;
window.filterCat              = filterCat;
window.filterSubCat           = filterSubCat;
window.showCodeModal          = showCodeModal;
window.downloadCode           = downloadCode;
window.toggleMobileMenu       = toggleMobileMenu;
window.closeMobileMenu        = closeMobileMenu;
window.googleLogin            = googleLogin;
window.googleLogout           = googleLogout;
window.toggleLike             = toggleLike;
window.toggleFavorite         = toggleFavorite;
window.openCommentsModal      = openCommentsModal;
window.addCommentFromModal    = addCommentFromModal;
window.deleteCommentFromModal = deleteCommentFromModal;
window.adminViewComments      = adminViewComments;
window.adminDeleteComment     = adminDeleteComment;
window.adminDeleteAllComments = adminDeleteAllComments;
window.adminResetLikes        = adminResetLikes;
window.adminResetFavorites    = adminResetFavorites;
window.openEditModal          = openEditModal;
window.selectEditCat          = selectEditCat;
window.selectEditSubCat       = selectEditSubCat;
window.switchEditVideoTab     = switchEditVideoTab;
window.updateProject          = updateProject;
window.sendMessage            = sendMessage;
window.sendMessageFromInbox   = sendMessageFromInbox;
window.adminReply             = adminReply;
window.blockUser              = blockUser;
window.unblockUser            = unblockUser;
window.adminDeleteConversation= adminDeleteConversation;
window.hideNotifBanner        = hideNotifBanner;

/* =============================================================
   SAYFA AÇILINCA PROJELERİ YÜKLE
============================================================= */
loadProjectsFromFirestore();

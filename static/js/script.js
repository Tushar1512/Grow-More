import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

window.addEventListener('load', () => { setTimeout(() => { document.getElementById('splash-screen').classList.add('hidden'); }, 2000); });

// --- AUTH ---
window.loginGoogle = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => showError(e.message));
window.loginEmail = () => signInWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passInput').value).catch(e => showError(e.message));
window.registerEmail = () => {
    const n = document.getElementById('nameInput').value; if (!n) return showError("Enter Name");
    createUserWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passInput').value)
        .then(async (c) => { await updateProfile(c.user, { displayName: n }); await setDoc(doc(db, "users", c.user.uid), { phone: "" }, { merge: true }); location.reload(); })
        .catch(e => showError(e.message));
};
function showError(m) { document.getElementById('authError').innerText = m.replace("Firebase: ", ""); }
window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('welcomeName').innerText = `Welcome, ${user.displayName || "Student"}`;
        document.getElementById('profileNameDisplay').innerText = user.displayName || "Student";
        const editName = document.getElementById('editName');
        if (editName) editName.value = user.displayName || "";
        loadUserData(user.uid);
    }
});

async function loadUserData(uid) {
    const todayStr = new Date().toDateString();
    const lastLogin = localStorage.getItem('lastLoginDate');
    let streak = parseInt(localStorage.getItem('studyStreak')) || 0;
    if (lastLogin !== todayStr) {
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        if (lastLogin === yest.toDateString()) streak++; else streak = 1;
        localStorage.setItem('studyStreak', streak); localStorage.setItem('lastLoginDate', todayStr);
    }
    document.getElementById('streakCount').innerText = streak;

    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
        const data = snap.data();
        window.userTasks = data.tasks || {};
        window.userSkills = data.skills || [];

        // KANBAN LOAD (Ensure structure exists)
        window.kanbanData = data.kanban || { todo: [], doing: [], done: [] };
        if (!window.kanbanData.todo) window.kanbanData.todo = [];
        if (!window.kanbanData.doing) window.kanbanData.doing = [];
        if (!window.kanbanData.done) window.kanbanData.done = [];

        // FORMULA LOAD
        window.formulas = data.formulas || [];

        if (data.phone) document.getElementById('editPhone').value = data.phone;

        const xp = (window.userSkills.length * 10) + (Object.keys(window.userTasks).length * 2);
        let rank = "Novice"; if (xp > 30) rank = "Apprentice"; if (xp > 80) rank = "Builder"; if (xp > 150) rank = "Architect";
        document.getElementById('userRank').innerText = rank;
        document.getElementById('xpText').innerText = `${xp} XP`;
        document.getElementById('xpFill').style.width = Math.min(xp, 100) + "%";

        const cont = document.getElementById('skillContainer');
        if (window.userSkills.length === 0) cont.innerHTML = "<div class='text-center text-secondary w-100'>No skills yet.</div>";
        else {
            cont.innerHTML = window.userSkills.map(s => {
                let icon = "fa-bolt";
                let n = s.name.toLowerCase();
                let colorClass = "bg-primary";

                // Smart Icon Selection
                if (n.includes("python")) icon = "fa-python";
                else if (n.includes("js") || n.includes("script")) icon = "fa-js";
                else if (n.includes("html")) icon = "fa-html5";
                else if (n.includes("css")) icon = "fa-css3-alt";
                else if (n.includes("react")) icon = "fa-react";
                else if (n.includes("node")) icon = "fa-node";
                else if (n.includes("db") || n.includes("data")) icon = "fa-database";
                else if (n.includes("robot") || n.includes("ros")) icon = "fa-robot";
                else if (n.includes("design") || n.includes("ui")) icon = "fa-pen-nib";
                else if (n.includes("code")) icon = "fa-code";

                // Proficiency Color Coding
                if (s.level < 40) colorClass = "bg-danger";
                else if (s.level < 75) colorClass = "bg-warning";
                else colorClass = "bg-success";

                return `
                <div class="col-6 col-lg-4">
                    <div class="skill-card">
                        <button class="skill-delete-btn" onclick="deleteSkill('${s.name}')"><i class="fas fa-trash"></i></button>
                        <div class="skill-icon-container">
                            <i class="fab ${icon} skill-icon"></i>
                        </div>
                        <h6 class="fw-bold mb-1">${s.name}</h6>
                        <div class="d-flex justify-content-between small text-secondary mb-2">
                            <span>Proficiency</span>
                            <span>${s.level}%</span>
                        </div>
                        <div class="progress" style="height:6px; background:rgba(255,255,255,0.05); border-radius:10px;">
                            <div class="progress-bar ${colorClass}" style="width:${s.level}%; border-radius:10px; transition: width 1s ease;"></div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
        if (data.resources) loadLibraryUI(data.resources);

        // Render Modules
        renderCalendar();
        updateUpcoming();
        renderKanbanBoard();
        updateExamCountdown();
        renderFormulas(); // NEW
        initDailyQuote(); // NEW
        initScratchpad(); // NEW
    } else {
        await setDoc(doc(db, "users", uid), { skills: [], tasks: {}, kanban: { todo: [], doing: [], done: [] }, formulas: [] });
        window.kanbanData = { todo: [], doing: [], done: [] };
        window.formulas = [];
        renderCalendar();
        renderKanbanBoard();
        initDailyQuote(); // NEW
        initScratchpad(); // NEW
    }
}

// --- CALENDAR LOGIC ---
let cMonth = new Date().getMonth(), cYear = new Date().getFullYear();
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

window.renderCalendar = () => {
    const grid = document.getElementById('calendarGrid'); if (!grid) return; grid.innerHTML = "";
    document.getElementById('monthYear').innerText = `${months[cMonth]} ${cYear}`;
    dayNames.forEach(d => grid.innerHTML += `<div class="text-center text-secondary small fw-bold py-1">${d}</div>`);
    const first = new Date(cYear, cMonth, 1).getDay();
    const total = new Date(cYear, cMonth + 1, 0).getDate();
    const today = new Date();
    for (let i = 0; i < first; i++) grid.innerHTML += "<div></div>";
    for (let d = 1; d <= total; d++) {
        const dateStr = `${cYear}-${cMonth + 1}-${d}`;
        let tasks = window.userTasks ? window.userTasks[dateStr] : [];
        if (tasks && !Array.isArray(tasks)) tasks = [tasks];
        if (!tasks) tasks = [];
        const isToday = (d === today.getDate() && cMonth === today.getMonth() && cYear === today.getFullYear());
        let dotsHtml = `<div class="dots-container">`;
        tasks.slice(0, 3).forEach(t => { dotsHtml += `<div class="task-dot dot-${t.cat}"></div>`; });
        dotsHtml += `</div>`;
        grid.innerHTML += `<div class="cal-date ${isToday ? 'today' : ''}" onclick="openTask('${dateStr}')">${d} ${dotsHtml}</div>`;
    }
};
window.changeMonth = (d) => { cMonth += d; if (cMonth < 0) { cMonth = 11; cYear--; } if (cMonth > 11) { cMonth = 0; cYear++; } renderCalendar(); };
window.openTask = (d) => { window.selectedDate = d; document.getElementById('modalDate').innerText = d; renderTaskList(d); new bootstrap.Modal(document.getElementById('taskModal')).show(); };
function renderTaskList(d) {
    const list = document.getElementById('taskListDisplay'); list.innerHTML = "";
    let tasks = window.userTasks && window.userTasks[d] ? window.userTasks[d] : [];
    if (!Array.isArray(tasks)) tasks = [tasks];
    if (tasks.length === 0) { list.innerHTML = "<li class='list-group-item bg-transparent text-secondary text-center'>No tasks yet.</li>"; }
    else { tasks.forEach((t, index) => { list.innerHTML += `<li class="list-group-item list-group-item-dark d-flex justify-content-between align-items-center mb-1 rounded"><span><span class="badge dot-${t.cat} me-2">&nbsp;</span>${t.text}</span><button class="btn btn-sm btn-outline-danger border-0" onclick="removeTaskFromDate(${index})"><i class="fas fa-trash"></i></button></li>`; }); }
}

// --- ADD TASK (OPTIMISTIC UI) ---
window.addTaskToDate = async () => {
    const txt = document.getElementById('taskInput').value, cat = document.getElementById('taskCategory').value, d = window.selectedDate;
    if (!txt) return;
    if (!auth.currentUser) return alert("Please login to save tasks.");

    // Optimistic UI Update
    if (!window.userTasks) window.userTasks = {};
    if (!window.userTasks[d]) window.userTasks[d] = [];
    if (!Array.isArray(window.userTasks[d])) window.userTasks[d] = [window.userTasks[d]];

    // Backup current state for rollback
    const backup = JSON.parse(JSON.stringify(window.userTasks));

    window.userTasks[d].push({ text: txt, cat: cat });
    renderTaskList(d); renderCalendar(); updateUpcoming(); updateExamCountdown();
    document.getElementById('taskInput').value = "";

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { tasks: window.userTasks });
    } catch (e) {
        console.error("Error saving task:", e);
        alert("Failed to save task. Please check your connection.");
        // Rollback
        window.userTasks = backup;
        renderTaskList(d); renderCalendar(); updateUpcoming(); updateExamCountdown();
    }
};

window.removeTaskFromDate = async (index) => {
    if (!auth.currentUser) return alert("Please login.");
    const d = window.selectedDate; let tasks = window.userTasks[d]; if (!Array.isArray(tasks)) tasks = [tasks];

    // Backup
    const backup = JSON.parse(JSON.stringify(window.userTasks));

    tasks.splice(index, 1); if (tasks.length === 0) delete window.userTasks[d]; else window.userTasks[d] = tasks;
    renderTaskList(d); renderCalendar(); updateUpcoming(); updateExamCountdown();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { tasks: window.userTasks });
    } catch (e) {
        console.error("Error deleting task:", e);
        alert("Failed to delete task.");
        window.userTasks = backup;
        renderTaskList(d); renderCalendar(); updateUpcoming(); updateExamCountdown();
    }
};

function updateUpcoming() {
    const list = document.getElementById('upcomingList'); list.innerHTML = "";
    let allTasks = [];
    if (window.userTasks) { Object.keys(window.userTasks).forEach(d => { let daily = window.userTasks[d]; if (!Array.isArray(daily)) daily = [daily]; daily.forEach(t => allTasks.push({ date: d, ...t })); }); }
    allTasks = allTasks.filter(t => new Date(t.date) >= new Date().setHours(0, 0, 0, 0)).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (allTasks.length === 0) list.innerHTML = "<li class='list-group-item bg-transparent text-center text-secondary border-0'>No tasks</li>";
    else allTasks.slice(0, 3).forEach(t => list.innerHTML += `<li class="list-group-item bg-transparent text-white border-0 px-0 py-1 d-flex justify-content-between"><span><span class="badge bg-secondary me-2" style="font-size:0.6em">${t.cat.toUpperCase()}</span>${t.text}</span><small class="text-secondary">${t.date}</small></li>`);
}

function updateExamCountdown() {
    let allExams = [];
    if (window.userTasks) { Object.keys(window.userTasks).forEach(d => { let daily = window.userTasks[d]; if (!Array.isArray(daily)) daily = [daily]; daily.forEach(t => { if (t.cat === 'exam') allExams.push({ date: d, ...t }); }); }); }
    allExams = allExams.filter(t => new Date(t.date) >= new Date().setHours(0, 0, 0, 0)).sort((a, b) => new Date(a.date) - new Date(b.date));
    const countDisplay = document.getElementById('daysToExam');
    const nameDisplay = document.getElementById('nextExamName');
    if (allExams.length > 0) {
        const nextExam = allExams[0];
        const diffTime = Math.abs(new Date(nextExam.date) - new Date());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (countDisplay) countDisplay.innerText = diffDays;
        if (nameDisplay) {
            nameDisplay.innerText = nextExam.text;
            nameDisplay.className = "badge bg-danger text-white";
        }
    } else {
        if (countDisplay) countDisplay.innerText = "--";
        if (nameDisplay) {
            nameDisplay.innerText = "No exams scheduled";
            nameDisplay.className = "badge bg-danger bg-opacity-25 text-danger";
        }
    }
}

// --- KANBAN BOARD FUNCTIONS ---
// --- KANBAN BOARD FUNCTIONS ---
window.addKanbanItem = (col) => {
    document.getElementById('kanbanTargetCol').value = col;
    document.getElementById('newKanbanTaskInput').value = "";
    new bootstrap.Modal(document.getElementById('kanbanEntryModal')).show();
};

window.confirmAddKanbanTask = async () => {
    const text = document.getElementById('newKanbanTaskInput').value;
    const col = document.getElementById('kanbanTargetCol').value;

    if (!text) return;
    if (!auth.currentUser) return alert("Please login.");

    if (!window.kanbanData) window.kanbanData = { todo: [], doing: [], done: [] };
    const backup = JSON.parse(JSON.stringify(window.kanbanData));

    window.kanbanData[col].push(text);
    renderKanbanBoard();

    // Close modal
    const modalEl = document.getElementById('kanbanEntryModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { kanban: window.kanbanData });
    } catch (e) {
        console.error("Kanban Save Error:", e);
        alert("Failed to save project task.");
        window.kanbanData = backup;
        renderKanbanBoard();
    }
};

window.moveKanbanItem = async (col, index, dir) => {
    if (!auth.currentUser) return alert("Please login.");
    const backup = JSON.parse(JSON.stringify(window.kanbanData));

    const item = window.kanbanData[col].splice(index, 1)[0];
    let targetCol = col;
    if (col === 'todo' && dir === 1) targetCol = 'doing';
    else if (col === 'doing' && dir === -1) targetCol = 'todo';
    else if (col === 'doing' && dir === 1) targetCol = 'done';
    else if (col === 'done' && dir === -1) targetCol = 'doing';

    window.kanbanData[targetCol].push(item);
    renderKanbanBoard();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { kanban: window.kanbanData });
    } catch (e) {
        console.error("Move Error:", e);
        alert("Failed to move item.");
        window.kanbanData = backup;
        renderKanbanBoard();
    }
};

window.deleteKanbanItem = (col, index) => {
    document.getElementById('deleteTargetCol').value = col;
    document.getElementById('deleteTargetIndex').value = index;
    new bootstrap.Modal(document.getElementById('deleteConfirmationModal')).show();
};

window.executeKanbanDelete = async () => {
    if (!auth.currentUser) return alert("Please login.");
    const col = document.getElementById('deleteTargetCol').value;
    const index = parseInt(document.getElementById('deleteTargetIndex').value);

    const backup = JSON.parse(JSON.stringify(window.kanbanData));

    window.kanbanData[col].splice(index, 1);
    renderKanbanBoard();

    // Close modal
    const modalEl = document.getElementById('deleteConfirmationModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { kanban: window.kanbanData });
    } catch (e) {
        console.error("Delete Error:", e);
        alert("Failed to delete item.");
        window.kanbanData = backup;
        renderKanbanBoard();
    }
};

function renderKanbanBoard() {
    if (!window.kanbanData) return;
    const cols = ['todo', 'doing', 'done'];
    cols.forEach(c => {
        const el = document.getElementById(`kb-${c}`);
        if (!el) return;
        el.innerHTML = window.kanbanData[c].map((item, i) => `
            <div class="kanban-card">
                ${item}
                <div class="kanban-actions">
                    ${c !== 'todo' ? `<button class="kb-btn" onclick="moveKanbanItem('${c}', ${i}, -1)"><i class="fas fa-arrow-left"></i></button>` : '<span></span>'}
                    <button class="kb-btn text-danger" onclick="deleteKanbanItem('${c}', ${i})"><i class="fas fa-trash"></i></button>
                    ${c !== 'done' ? `<button class="kb-btn" onclick="moveKanbanItem('${c}', ${i}, 1)"><i class="fas fa-arrow-right"></i></button>` : '<span></span>'}
                </div>
            </div>
        `).join('');
    });
}

// --- WHITEBOARD (NEW) ---
const canvas = document.getElementById('drawingCanvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let isDrawing = false, currentTool = 'pen', currentColor = 'black';

    function resizeCanvas() {
        const container = document.getElementById('whiteboard-container');
        if (container) {
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill white bg
        }
    }
    window.addEventListener('resize', resizeCanvas);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.classList && mutation.target.classList.contains('active-section') && mutation.target.id === 'whiteboard') {
                setTimeout(resizeCanvas, 50);
            }
        });
    });
    const wbSection = document.getElementById('whiteboard');
    if (wbSection) observer.observe(wbSection, { attributes: true });

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
    canvas.addEventListener('touchend', stopDrawing);

    function startDrawing(e) { isDrawing = true; ctx.beginPath(); ctx.moveTo(getX(e), getY(e)); }
    function draw(e) { if (!isDrawing) return; ctx.lineWidth = currentTool === 'eraser' ? 20 : 3; ctx.strokeStyle = currentTool === 'eraser' ? 'white' : currentColor; ctx.lineTo(getX(e), getY(e)); ctx.stroke(); }
    function stopDrawing() { isDrawing = false; ctx.closePath(); }
    function getX(e) { return e.clientX - canvas.getBoundingClientRect().left; }
    function getY(e) { return e.clientY - canvas.getBoundingClientRect().top; }

    window.setColor = (c, btn) => { currentTool = 'pen'; currentColor = c; document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
    window.setEraser = () => { currentTool = 'eraser'; };
    window.clearCanvas = () => { ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); };
    window.downloadCanvas = () => { const link = document.createElement('a'); link.download = 'idea-canvas.png'; link.href = canvas.toDataURL(); link.click(); };
}

// --- NEW: DYNAMIC FORMULAS ---
window.openFormulas = () => { renderFormulas(); new bootstrap.Modal(document.getElementById('formulaModal')).show(); };

window.addFormula = async () => {
    const s = document.getElementById('fSubject').value;
    const n = document.getElementById('fName').value;
    const e = document.getElementById('fEq').value;
    if (!s || !n || !e) return alert("Fill all fields");
    if (!auth.currentUser) return alert("Please login.");

    if (!window.formulas) window.formulas = [];
    window.formulas.push({ s: s, n: n, e: e });

    document.getElementById('fSubject').value = ""; document.getElementById('fName').value = ""; document.getElementById('fEq').value = "";

    renderFormulas();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { formulas: window.formulas });
    } catch (err) {
        console.error("Formula Save Error:", err);
        alert("Failed to save formula.");
        window.formulas.pop(); // Basic rollback
        renderFormulas();
    }
};

window.renderFormulas = () => {
    const list = document.getElementById('formulaListContainer');
    if (!list) return;
    if (!window.formulas || window.formulas.length === 0) {
        list.innerHTML = "<div class='text-center text-secondary py-3'>No formulas saved yet.</div>";
        return;
    }
    list.innerHTML = window.formulas.map((f, i) => `
        <div class="formula-card">
            <div>
                <span class="badge bg-secondary mb-1">${f.s}</span>
                <div class="fw-bold text-white">${f.n}</div>
                <div class="text-info font-monospace">${f.e}</div>
            </div>
            <button class="btn btn-sm text-danger" onclick="deleteFormula(${i})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
};

window.deleteFormula = async (i) => {
    if (!confirm("Delete?")) return;
    if (!auth.currentUser) return alert("Please login.");

    const backup = JSON.parse(JSON.stringify(window.formulas));
    window.formulas.splice(i, 1);
    renderFormulas();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { formulas: window.formulas });
    } catch (e) {
        console.error("Formula Delete Error:", e);
        alert("Failed to delete formula.");
        window.formulas = backup;
        renderFormulas();
    }
};

// --- NEW: IDEA GENERATOR (BEST UI - AI CONNECTED) ---
window.openIdeaModal = () => new bootstrap.Modal(document.getElementById('ideaModal')).show();
window.spinIdea = async () => {
    const out = document.getElementById('ideaOutput');
    out.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Brainstorming...";

    try {
        const r = await fetch('/generate_idea', { method: 'POST' });
        const d = await r.json();
        out.innerText = "✨ " + d.reply;
    } catch (e) {
        // Fallback if AI server isn't running
        const ideas = ["Line Follower Robot", "Home Automation", "Smart Irrigation", "Gesture Robot", "Solar Tracker"];
        const random = ideas[Math.floor(Math.random() * ideas.length)];
        out.innerText = "✨ " + random;
    }
};

// --- TIMER ---
let timerInt;
window.startTimer = () => {
    if (timerInt) return;
    const inp = document.getElementById('timerInput'), disp = document.getElementById('timerCountdown');
    let val = parseInt(inp.value); if (!val || val <= 0) return alert("Please type minutes first!");
    let time = val * 60; inp.style.display = 'none'; disp.style.display = 'block';
    const ring = document.getElementById('ringProgress'); const circumference = 565; let totalTime = time;
    timerInt = setInterval(() => {
        if (time <= 0) { resetTimer(); alert("Session Complete!"); }
        else { time--; const m = Math.floor(time / 60), s = time % 60; disp.innerText = `${m}:${s < 10 ? '0' + s : s}`; const offset = circumference - (time / totalTime) * circumference; ring.style.strokeDashoffset = offset; }
    }, 1000);
};
window.resetTimer = () => { clearInterval(timerInt); timerInt = null; document.getElementById('timerInput').style.display = 'block'; document.getElementById('timerInput').value = ""; document.getElementById('timerCountdown').style.display = 'none'; document.getElementById('timerCountdown').innerText = "00:00"; document.getElementById('ringProgress').style.strokeDashoffset = 0; };

// --- AI ---
const converter = new showdown.Converter();
window.quickPrompt = (t) => { const input = document.getElementById('aiQuery'); input.value = t; input.focus(); };
window.handleAiEnter = (e) => { if (e.key === "Enter") askAI(); };
window.askAI = async () => {
    const q = document.getElementById('aiQuery').value; if (!q) return;
    const chat = document.getElementById('chatBox');
    const loading = document.getElementById('loadingBubble');
    const userMsg = document.createElement('div'); userMsg.className = 'chat-bubble chat-user'; userMsg.innerText = q; chat.insertBefore(userMsg, loading);
    document.getElementById('aiQuery').value = ""; loading.style.display = 'block'; chat.scrollTop = chat.scrollHeight;

    try {
        const r = await fetch('/ask_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        const d = await r.json();
        loading.style.display = 'none';
        const aiMsg = document.createElement('div'); aiMsg.className = 'chat-bubble chat-ai';
        aiMsg.innerHTML = `<div class="d-flex align-items-center mb-1 text-primary"><span class="me-2 fs-5">🕉️</span> <strong>Veda</strong></div>${converter.makeHtml(d.reply)}`;
        chat.insertBefore(aiMsg, loading);
    } catch (e) {
        loading.style.display = 'none';
        const err = document.createElement('div'); err.className = 'chat-bubble chat-ai';
        err.innerHTML = `<div class="text-danger mb-1"><i class="fas fa-wifi me-2"></i><strong>Offline</strong></div>I am currently offline. Please check your connection.`;
        chat.insertBefore(err, loading);
    }
    chat.scrollTop = chat.scrollHeight;
}

// --- UTILS ---
window.addNewSkill = async () => {
    const nameInput = document.getElementById('newSkillName');
    const levelInput = document.getElementById('newSkillLevel');
    const n = nameInput.value;
    const l = parseInt(levelInput.value);

    if (!auth.currentUser) return alert("Please login to add skills.");
    if (!n || isNaN(l) || l < 0 || l > 100) return alert("Please enter a valid name and level (0-100).");

    const btn = document.querySelector('#skillModal button.btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Adding...";
    btn.disabled = true;

    try {
        // Use setDoc with merge to ensure it works even if the doc is missing fields
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            skills: arrayUnion({ name: n, level: l })
        }, { merge: true });

        // Reset inputs
        nameInput.value = "";
        levelInput.value = "";

        // Close modal
        const modalEl = document.getElementById('skillModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        loadUserData(auth.currentUser.uid);
    } catch (e) {
        console.error("Error adding skill:", e);
        alert("Error adding skill: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.openRemoveModal = () => { const list = document.getElementById('removeListContainer'); if (!window.userSkills || window.userSkills.length === 0) return alert("No skills."); list.innerHTML = window.userSkills.map(s => `<div class="list-group-item list-group-item-dark d-flex justify-content-between align-items-center mb-2 rounded border-0"><span>${s.name}</span><button class="btn btn-sm btn-danger rounded-circle" onclick="deleteSkill('${s.name}')"><i class="fas fa-trash"></i></button></div>`).join(''); new bootstrap.Modal(document.getElementById('removeSkillModal')).show(); };
window.deleteSkill = async (n) => { if (!confirm("Delete?")) return; const newS = window.userSkills.filter(s => s.name !== n); await updateDoc(doc(db, "users", auth.currentUser.uid), { skills: newS }); bootstrap.Modal.getInstance(document.getElementById('removeSkillModal')).hide(); loadUserData(auth.currentUser.uid); };
window.downloadReport = () => { const text = document.getElementById('reportText').value; if (!text) return alert("Empty!"); const now = new Date(); const header = `Date(${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()})--Time(${now.toLocaleTimeString()})\n----------------\n\n`; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([header + text], { type: 'text/plain' })); a.download = `Report_${now.getDate()}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); };
window.saveNewLink = async () => {
    const t = document.getElementById('linkTitleInput').value;
    let u = document.getElementById('linkUrlInput').value;
    if (!t || !u) return alert("Please enter both title and URL");

    if (!u.match(/^https?:\/\//i)) {
        u = 'https://' + u;
    }

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { resources: arrayUnion({ title: t, url: u }) });
        bootstrap.Modal.getInstance(document.getElementById('addLinkModal')).hide();
        document.getElementById('linkTitleInput').value = "";
        document.getElementById('linkUrlInput').value = "";
        loadUserData(auth.currentUser.uid);
    } catch (e) {
        console.error("Link Save Error:", e);
        alert("Failed to save link. Please try again.");
    }
};
window.deleteLink = async (title, url) => { if (!confirm(`Are you sure you want to remove "${title}"?`)) return; const user = auth.currentUser; if (user) { try { await updateDoc(doc(db, "users", user.uid), { resources: arrayRemove({ title: title, url: url }) }); loadUserData(user.uid); } catch (e) { console.error("Error deleting link:", e); alert("Could not delete link. Please try again."); } } };
window.openLinkModal = () => new bootstrap.Modal(document.getElementById('addLinkModal')).show();
function loadLibraryUI(res) { const list = document.getElementById('libraryList'); list.innerHTML = ""; if (res && res.length > 0) { res.forEach(r => { list.innerHTML += `<li class="list-group-item list-group-item-dark d-flex justify-content-between align-items-center"><a href="${r.url}" target="_blank" class="text-info text-decoration-none text-truncate" style="max-width: 80%;"><i class="fas fa-link me-2"></i>${r.title}</a><button class="btn btn-sm btn-outline-danger border-0" onclick="deleteLink('${r.title}', '${r.url}')"><i class="fas fa-trash"></i></button></li>`; }); } else { list.innerHTML = "<li class='text-secondary text-center py-3'>No saved resources yet.</li>"; } }

/* --- SIDEBAR TOGGLE --- */
window.toggleSidebar = () => { document.getElementById('sidebar').classList.toggle('toggled'); document.body.classList.toggle('sidebar-toggled'); };
window.showSection = (id, btn) => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (id === 'converter') return;
    document.getElementById(id).classList.add('active-section');
    btn.classList.add('active');
    if (id === 'cal') renderCalendar();
    if (id === 'projects') renderKanbanBoard();
    if (window.innerWidth < 992) document.getElementById('sidebar').classList.remove('toggled');
};

window.openSkillModal = () => {
    const el = document.getElementById('skillModal');
    let modal = bootstrap.Modal.getInstance(el);
    if (!modal) modal = new bootstrap.Modal(el);
    modal.show();
};
window.setTheme = (t) => { document.body.setAttribute('data-theme', t); localStorage.setItem('theme', t); };
if (localStorage.getItem('theme')) setTheme(localStorage.getItem('theme'));

// --- NEW FEATURES: MOTIVATION & SCRATCHPAD ---
const quotes = [
    { t: "Success is not final, failure is not fatal: It is the courage to continue that counts.", a: "Winston Churchill" },
    { t: "The expert in anything was once a beginner.", a: "Helen Hayes" },
    { t: "Don't watch the clock; do what it does. Keep going.", a: "Sam Levenson" },
    { t: "The future belongs to those who believe in the beauty of their dreams.", a: "Eleanor Roosevelt" },
    { t: "It always seems impossible until it's done.", a: "Nelson Mandela" },
    { t: "Quality is not an act, it is a habit.", a: "Aristotle" }
];

window.initDailyQuote = () => {
    const today = new Date().toDateString();
    let qIndex = localStorage.getItem('quoteIndex');
    let qDate = localStorage.getItem('quoteDate');

    if (qDate !== today) {
        qIndex = Math.floor(Math.random() * quotes.length);
        localStorage.setItem('quoteIndex', qIndex);
        localStorage.setItem('quoteDate', today);
    }

    const q = quotes[qIndex || 0];
    const qText = document.getElementById('quoteText');
    const qAuth = document.getElementById('quoteAuthor');
    if (qText && qAuth) {
        qText.innerText = `"${q.t}"`;
        qAuth.innerText = q.a;
    }
};

window.initScratchpad = () => {
    const note = localStorage.getItem('scratchpadNote');
    if (note) document.getElementById('scratchpad').value = note;
};

window.saveScratchpad = () => {
    const val = document.getElementById('scratchpad').value;
    localStorage.setItem('scratchpadNote', val);
};

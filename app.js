const STORAGE_KEY = "nelson_command_centre_tasks_v1";
const REVIEW_KEY = "nelson_command_centre_reviews_v1";

const projects = [
  "HRDC 5 Courses",
  "NESGDC + Yayasan Proposal",
  "IGTI Roadmap",
  "CASBEE Lenang",
  "CASBEE Majestic",
  "LAM Part 3",
  "UTM Teaching",
  "Admin",
  "Personal"
];

const categories = [
  "HRDC",
  "NESGDC",
  "Yayasan",
  "IGTI",
  "CASBEE Lenang",
  "CASBEE Majestic",
  "LAM Part 3",
  "UTM Teaching",
  "Admin",
  "Personal"
];

let tasks = loadTasks();
let currentFilter = "all";
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY)) || [];
  } catch {
    return [];
  }
}

function saveReviews(reviews) {
  localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews));
}

function populateSelect(selectId, values) {
  const select = $(selectId);
  select.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join("");
}

function getDeadline(task) {
  if (!task.deadlineDate) return null;
  const time = task.deadlineTime || "23:59";
  return new Date(`${task.deadlineDate}T${time}`);
}

function getWarning(task) {
  if (task.status === "Done") return { level: "Done", className: "done", text: "Completed" };

  const deadline = getDeadline(task);
  if (!deadline || isNaN(deadline)) return { level: "No Deadline", className: "watch", text: "No deadline set" };

  const now = new Date();
  const msLeft = deadline - now;
  const daysLeft = msLeft / (1000 * 60 * 60 * 24);

  if (msLeft < 0) return { level: "Overdue", className: "overdue", text: `Overdue by ${formatDuration(Math.abs(msLeft))}` };
  if (daysLeft < 1) return { level: "Critical", className: "critical", text: `${formatDuration(msLeft)} left` };
  if (daysLeft < 3) return { level: "Urgent", className: "urgent", text: `${formatDuration(msLeft)} left` };
  if (daysLeft < 7) return { level: "Watch", className: "watch", text: `${formatDuration(msLeft)} left` };
  return { level: "Safe", className: "safe", text: `${formatDuration(msLeft)} left` };
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function isToday(task) {
  const deadline = getDeadline(task);
  if (!deadline) return false;
  const now = new Date();
  return deadline.getFullYear() === now.getFullYear()
    && deadline.getMonth() === now.getMonth()
    && deadline.getDate() === now.getDate();
}

function sortTasks(taskArray) {
  const priorityRank = {
    "P1 Fire": 1,
    "P2 Important": 2,
    "P3 Scheduled": 3,
    "P4 Later": 4,
    "P5 Someday": 5
  };

  return [...taskArray].sort((a, b) => {
    if (a.status === "Done" && b.status !== "Done") return 1;
    if (b.status === "Done" && a.status !== "Done") return -1;
    const pa = priorityRank[a.priority] || 9;
    const pb = priorityRank[b.priority] || 9;
    if (pa !== pb) return pa - pb;
    const da = getDeadline(a)?.getTime() || Infinity;
    const db = getDeadline(b)?.getTime() || Infinity;
    return da - db;
  });
}

function taskMatchesFilter(task) {
  const warning = getWarning(task);

  if (currentFilter === "all") return true;
  if (currentFilter === "today") return isToday(task);
  if (currentFilter === "overdue") return warning.level === "Overdue";
  if (currentFilter === "critical") return warning.level === "Critical";
  if (currentFilter === "P1 Fire") return task.priority === "P1 Fire";
  if (currentFilter === "Done") return task.status === "Done";
  return true;
}

function render() {
  renderDashboard();
  renderTop3();
  renderTasks();
  renderProjects();
  renderReviews();
}

function renderDashboard() {
  const overdue = tasks.filter(t => getWarning(t).level === "Overdue").length;
  const critical = tasks.filter(t => getWarning(t).level === "Critical").length;
  const today = tasks.filter(t => isToday(t) && t.status !== "Done").length;
  const done = tasks.filter(t => t.status === "Done").length;

  $("todayCount").textContent = today;
  $("overdueCount").textContent = overdue;
  $("doneCount").textContent = done;

  let status = "Normal";
  let hint = "No critical task detected.";

  if (overdue > 0) {
    status = "Damage Control";
    hint = `${overdue} overdue task(s). Reschedule or finish immediately.`;
  } else if (critical > 0) {
    status = "Critical";
    hint = `${critical} task(s) under 24 hours.`;
  } else if (today > 0) {
    status = "Focused";
    hint = `${today} task(s) due today.`;
  }

  $("workloadStatus").textContent = status;
  $("workloadHint").textContent = hint;
}

function renderTop3() {
  const selected = tasks.filter(t => t.top3 && t.status !== "Done");
  const list = $("top3List");

  if (selected.length === 0) {
    list.className = "task-list empty-box";
    list.textContent = "No Top 3 selected yet.";
    return;
  }

  list.className = "task-list";
  list.innerHTML = selected.slice(0, 3).map(taskCard).join("");
}

function renderTasks() {
  const filtered = sortTasks(tasks.filter(taskMatchesFilter));
  const list = $("taskList");

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-box">No task found for this filter.</div>`;
    return;
  }

  list.innerHTML = filtered.map(taskCard).join("");
}

function taskCard(task) {
  const warning = getWarning(task);
  const deadline = getDeadline(task);
  const deadlineText = deadline ? deadline.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No deadline";
  const doneClass = task.status === "Done" ? "done" : "";
  const calendarUrl = buildCalendarUrl(task);

  return `
    <article class="task-card ${doneClass}">
      <div class="task-head">
        <div>
          <h3 class="task-title">${escapeHtml(task.title)}</h3>
          <div class="badges">
            <span class="badge">${escapeHtml(task.priority)}</span>
            <span class="badge">${escapeHtml(task.status)}</span>
            <span class="badge ${warning.className}">${warning.level}: ${warning.text}</span>
          </div>
        </div>
      </div>
      <div class="task-meta">
        <span><strong>Project:</strong> ${escapeHtml(task.project || "-")}</span>
        <span><strong>Deadline:</strong> ${deadlineText}</span>
        <span><strong>Next action:</strong> ${escapeHtml(task.nextAction || "Define the next smallest action.")}</span>
        ${task.notes ? `<span><strong>Notes:</strong> ${escapeHtml(task.notes)}</span>` : ""}
      </div>
      <div class="task-actions">
        <button onclick="toggleTop3('${task.id}')">${task.top3 ? "Remove Top 3" : "Top 3"}</button>
        <button onclick="markDone('${task.id}')">${task.status === "Done" ? "Undo Done" : "Mark Done"}</button>
        <button onclick="editTask('${task.id}')">Edit</button>
        <a href="${calendarUrl}" target="_blank" rel="noopener">Google Calendar</a>
        <button class="danger" onclick="deleteTask('${task.id}')">Delete</button>
      </div>
    </article>
  `;
}

function renderProjects() {
  const list = $("projectProgress");
  const html = projects.map(project => {
    const projectTasks = tasks.filter(t => t.project === project);
    const total = projectTasks.length;
    const done = projectTasks.filter(t => t.status === "Done").length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return `
      <div class="progress-item">
        <div class="progress-row">
          <span>${project}</span>
          <span>${done}/${total} • ${percent}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");

  list.innerHTML = html;
}

function renderReviews() {
  const reviews = loadReviews().slice(-5).reverse();
  const log = $("reviewLog");
  if (reviews.length === 0) {
    log.innerHTML = `<div class="empty-box">No daily review saved yet.</div>`;
    return;
  }

  log.innerHTML = reviews.map(r => `
    <div class="review-entry">
      <strong>${new Date(r.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong>
      <p><strong>Completed:</strong> ${escapeHtml(r.done || "-")}</p>
      <p><strong>Stuck:</strong> ${escapeHtml(r.stuck || "-")}</p>
      <p><strong>Tomorrow Top 3:</strong> ${escapeHtml(r.top3 || "-")}</p>
      <p><strong>Postpone/Stop:</strong> ${escapeHtml(r.stop || "-")}</p>
    </div>
  `).join("");
}

function buildCalendarUrl(task) {
  const title = encodeURIComponent(`[${task.priority}] ${task.title}`);
  const deadline = getDeadline(task) || new Date();
  const start = new Date(deadline.getTime() - 60 * 60 * 1000);
  const end = deadline;
  const dates = `${toCalendarDate(start)}/${toCalendarDate(end)}`;
  const details = encodeURIComponent(
    `Project: ${task.project}\nStatus: ${task.status}\nNext action: ${task.nextAction || ""}\nNotes: ${task.notes || ""}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

function toCalendarDate(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
}

function handleSubmit(e) {
  e.preventDefault();

  const id = $("taskId").value || crypto.randomUUID();
  const existing = tasks.find(t => t.id === id);

  const task = {
    id,
    title: $("title").value.trim(),
    project: $("project").value,
    category: $("category").value,
    priority: $("priority").value,
    status: $("status").value,
    deadlineDate: $("deadlineDate").value,
    deadlineTime: $("deadlineTime").value,
    estimatedHours: $("estimatedHours").value,
    actualHours: $("actualHours").value,
    nextAction: $("nextAction").value.trim(),
    notes: $("notes").value.trim(),
    top3: existing?.top3 || false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!task.title) return;

  const index = tasks.findIndex(t => t.id === id);
  if (index >= 0) tasks[index] = task;
  else tasks.push(task);

  saveTasks();
  resetForm();
  render();
}

function resetForm() {
  $("taskForm").reset();
  $("taskId").value = "";
  $("deadlineTime").value = "23:59";
  populateSelect("project", projects);
  populateSelect("category", categories);
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  $("taskId").value = task.id;
  $("title").value = task.title;
  $("project").value = task.project;
  $("category").value = task.category;
  $("priority").value = task.priority;
  $("status").value = task.status;
  $("deadlineDate").value = task.deadlineDate || "";
  $("deadlineTime").value = task.deadlineTime || "23:59";
  $("estimatedHours").value = task.estimatedHours || "";
  $("actualHours").value = task.actualHours || "";
  $("nextAction").value = task.nextAction || "";
  $("notes").value = task.notes || "";

  window.scrollTo({ top: 320, behavior: "smooth" });
}

function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

function markDone(id) {
  tasks = tasks.map(t => {
    if (t.id !== id) return t;
    return { ...t, status: t.status === "Done" ? "In Progress" : "Done", updatedAt: new Date().toISOString() };
  });
  saveTasks();
  render();
}

function toggleTop3(id) {
  const selectedCount = tasks.filter(t => t.top3 && t.status !== "Done").length;
  tasks = tasks.map(t => {
    if (t.id !== id) return t;
    if (!t.top3 && selectedCount >= 3) {
      alert("Top 3 already has three tasks. Remove one first.");
      return t;
    }
    return { ...t, top3: !t.top3 };
  });
  saveTasks();
  render();
}

function autoTop3() {
  const sorted = sortTasks(tasks.filter(t => t.status !== "Done")).slice(0, 3);
  const ids = new Set(sorted.map(t => t.id));
  tasks = tasks.map(t => ({ ...t, top3: ids.has(t.id) }));
  saveTasks();
  render();
}

function seedCurrentTasks() {
  if (tasks.length > 0 && !confirm("Add your current workload tasks to the existing list?")) return;

  const today = new Date();
  const plusDays = (days, hour=23, minute=59) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}` };
  };

  const seed = [
    ["Complete 5 HRDC course outlines", "HRDC 5 Courses", "HRDC", "P1 Fire", "Create master course template and duplicate into five outlines", plusDays(1)],
    ["Complete HRDC teaching plans", "HRDC 5 Courses", "HRDC", "P1 Fire", "Build one reusable HRDC teaching-plan structure", plusDays(2)],
    ["Prepare HRDC slide skeletons", "HRDC 5 Courses", "HRDC", "P2 Important", "Create slide outline before full design", plusDays(3)],
    ["Draft NESGDC + Yayasan proposal concept note", "NESGDC + Yayasan Proposal", "NESGDC", "P1 Fire", "Prepare compact 2-page event concept note", plusDays(2)],
    ["Draft IGTI training and awareness roadshow roadmap", "IGTI Roadmap", "IGTI", "P2 Important", "Define phases, modules, audience and partners", plusDays(4)],
    ["Start Sunway Iskandar CASBEE Lenang assessor checklist", "CASBEE Lenang", "CASBEE Lenang", "P2 Important", "Prepare criteria and evidence mapping tracker", plusDays(5)],
    ["Assess Sunway CASBEE Majestic evidence", "CASBEE Majestic", "CASBEE Majestic", "P2 Important", "Review evidence documents and scoring notes", plusDays(7)],
    ["LAM Part 3 daily study notes", "LAM Part 3", "LAM Part 3", "P3 Scheduled", "Study 45 minutes and write 15-minute recall notes", plusDays(1, 22, 30)]
  ].map(([title, project, category, priority, nextAction, dl]) => ({
    id: crypto.randomUUID(),
    title,
    project,
    category,
    priority,
    status: "Not Started",
    deadlineDate: dl.date,
    deadlineTime: dl.time,
    estimatedHours: "",
    actualHours: "",
    nextAction,
    notes: "",
    top3: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  tasks = [...tasks, ...seed];
  saveTasks();
  render();
}

function saveReview() {
  const reviews = loadReviews();
  reviews.push({
    date: new Date().toISOString(),
    done: $("reviewDone").value.trim(),
    stuck: $("reviewStuck").value.trim(),
    top3: $("reviewTop3").value.trim(),
    stop: $("reviewStop").value.trim()
  });
  saveReviews(reviews);

  $("reviewDone").value = "";
  $("reviewStuck").value = "";
  $("reviewTop3").value = "";
  $("reviewStop").value = "";

  renderReviews();
}

function exportData() {
  const data = {
    app: "Nelson Command Centre",
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    reviews: loadReviews()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nelson-command-centre-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.tasks)) {
        tasks = data.tasks;
        saveTasks();
      }
      if (Array.isArray(data.reviews)) {
        saveReviews(data.reviews);
      }
      render();
      alert("Import completed.");
    } catch {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(file);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  $("taskForm").addEventListener("submit", handleSubmit);
  $("resetFormBtn").addEventListener("click", resetForm);
  $("seedBtn").addEventListener("click", seedCurrentTasks);
  $("autoTop3Btn").addEventListener("click", autoTop3);
  $("saveReviewBtn").addEventListener("click", saveReview);
  $("exportBtn").addEventListener("click", exportData);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });

  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $("installBtn").classList.remove("hidden");
  });

  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("installBtn").classList.add("hidden");
  });
}

function init() {
  populateSelect("project", projects);
  populateSelect("category", categories);
  bindEvents();
  render();

  setInterval(render, 60 * 1000);
}

init();

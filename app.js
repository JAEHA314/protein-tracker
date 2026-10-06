
const STORAGE_KEY = "proteinTracker.records.v1";
const GOAL_KEY = "proteinTracker.goal.v1";

const $ = (id) => document.getElementById(id);

const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};

function loadAll() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getTodayItems() {
  const all = loadAll();
  return all[todayKey()] || [];
}

function setTodayItems(items) {
  const all = loadAll();
  all[todayKey()] = items;
  saveAll(all);
}

function getGoal() {
  return Number(localStorage.getItem(GOAL_KEY) || 75);
}

function setGoal(goal) {
  localStorage.setItem(GOAL_KEY, String(goal));
}

function formatDateLabel() {
  const d = new Date();
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(d);
}

function render() {
  const items = getTodayItems();
  const total = items.reduce((sum, item) => sum + Number(item.protein), 0);
  const goal = getGoal();
  const remaining = Math.max(goal - total, 0);
  const pct = Math.min((total / goal) * 100, 100);

  $("todayLabel").textContent = formatDateLabel();
  $("totalProtein").textContent = total.toFixed(1);
  $("goalText").textContent = goal;
  $("remainingText").textContent = total >= goal
    ? `목표 달성 +${(total-goal).toFixed(1)}g`
    : `${remaining.toFixed(1)}g 남음`;
  $("progressBar").style.width = `${pct}%`;

  const list = $("foodList");
  list.innerHTML = "";
  $("emptyState").style.display = items.length ? "none" : "block";

  items.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "food-item";
    el.innerHTML = `
      <div class="food-name">${escapeHtml(item.name)}</div>
      <div class="food-meta">${item.amount}${escapeHtml(item.unit)}</div>
      <div class="food-protein">${Number(item.protein).toFixed(1)}g</div>
      <button class="delete-btn" data-index="${idx}">삭제</button>
    `;
    list.appendChild(el);
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const items = getTodayItems();
      items.splice(Number(btn.dataset.index), 1);
      setTodayItems(items);
      render();
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

$("addBtn").addEventListener("click", () => $("foodDialog").showModal());
$("closeFoodDialog").addEventListener("click", () => $("foodDialog").close());

$("goalBtn").addEventListener("click", () => {
  $("goalInput").value = getGoal();
  $("goalDialog").showModal();
});
$("closeGoalDialog").addEventListener("click", () => $("goalDialog").close());

document.querySelectorAll('input[name="calcMode"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const mode = document.querySelector('input[name="calcMode"]:checked').value;
    $("per100Wrap").classList.toggle("hidden", mode !== "per100");
    $("directWrap").classList.toggle("hidden", mode !== "direct");
  });
});

$("foodForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = $("foodName").value.trim();
  const amount = Number($("amount").value);
  const unit = $("unit").value;
  const mode = document.querySelector('input[name="calcMode"]:checked').value;

  if (!name || !amount || amount <= 0) return;

  let protein = 0;
  if (mode === "per100") {
    const per100 = Number($("proteinPer100").value);
    if (!per100 || per100 < 0) return;
    protein = amount * per100 / 100;
  } else {
    protein = Number($("directProtein").value);
    if (!protein || protein < 0) return;
  }

  const items = getTodayItems();
  items.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    amount,
    unit,
    protein: Number(protein.toFixed(2)),
    createdAt: Date.now()
  });
  setTodayItems(items);

  e.target.reset();
  document.querySelector('input[name="calcMode"][value="per100"]').checked = true;
  $("per100Wrap").classList.remove("hidden");
  $("directWrap").classList.add("hidden");
  $("foodDialog").close();
  render();
});

$("goalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const goal = Number($("goalInput").value);
  if (!goal || goal <= 0) return;
  setGoal(goal);
  $("goalDialog").close();
  render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

render();

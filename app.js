const SUPABASE_URL = "https://plvgepenuwfwvhsmrwbj.supabase.co";
const SUPABASE_KEY = "sb_publishable_ly1XmYcdunJ7_ZlJkPVRxg_aqjWJDmd";

const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let records = [];
let proteinGoal = 75;
let editingId = null;


// ─────────────────────────────
// 날짜
// ─────────────────────────────

function todayKey() {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDateLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date());
}


// ─────────────────────────────
// 앱 시작
// ─────────────────────────────

async function initializeApp() {

  const {
    data: { session }
  } = await client.auth.getSession();

  if (session?.user) {

    currentUser = session.user;

    await openApp();

  } else {

    showLogin();

  }
}


function showLogin() {

  $("loginScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");

}


async function openApp() {

  $("loginScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  $("todayLabel").textContent = formatDateLabel();

  await Promise.all([
    loadRecords(),
    loadGoal()
  ]);

  render();
}


// ─────────────────────────────
// 로그인
// ─────────────────────────────

$("loginForm").addEventListener("submit", async (event) => {

  event.preventDefault();

  $("loginError").textContent = "";

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { data, error } =
    await client.auth.signInWithPassword({
      email,
      password
    });

  if (error) {

    console.error(error);

    $("loginError").textContent =
      "이메일 또는 비밀번호를 확인해주세요.";

    return;
  }

  currentUser = data.user;

  await openApp();
});


$("logoutBtn").addEventListener("click", async () => {

  await client.auth.signOut();

  currentUser = null;
  records = [];

  showLogin();

});


// ─────────────────────────────
// 오늘 기록 불러오기
// ─────────────────────────────

async function loadRecords() {

  if (!currentUser) return;

  const { data, error } = await client
    .from("protein_records")
    .select("*")
    .eq("record_date", todayKey())
    .order("created_at", {
      ascending: true
    });

  if (error) {

    console.error(
      "기록 불러오기 실패:",
      error
    );

    return;
  }

  records = data || [];
}


// ─────────────────────────────
// 목표 불러오기
// ─────────────────────────────

async function loadGoal() {

  if (!currentUser) return;

  const { data, error } = await client
    .from("user_settings")
    .select("protein_goal")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {

    console.error(
      "목표 불러오기 실패:",
      error
    );

    return;
  }


  // 아직 설정이 없으면 기본 75g 생성

  if (!data) {

    const { error: insertError } =
      await client
        .from("user_settings")
        .insert({
          user_id: currentUser.id,
          protein_goal: 75
        });


    if (insertError) {

      console.error(
        "기본 목표 생성 실패:",
        insertError
      );

    }

    proteinGoal = 75;

  } else {

    proteinGoal =
      Number(data.protein_goal);

  }
}


// ─────────────────────────────
// 화면 그리기
// ─────────────────────────────

function render() {

  const total =
    records.reduce(
      (sum, item) =>
        sum + Number(item.protein),
      0
    );


  const remaining =
    Math.max(
      proteinGoal - total,
      0
    );


  const percent =
    proteinGoal > 0
      ? Math.min(
          (total / proteinGoal) * 100,
          100
        )
      : 0;


  $("totalProtein").textContent =
    total.toFixed(1);


  $("goalText").textContent =
    proteinGoal;


  if (total >= proteinGoal) {

    $("remainingText").textContent =
      `목표 달성 +${(
        total - proteinGoal
      ).toFixed(1)}g`;

  } else {

    $("remainingText").textContent =
      `${remaining.toFixed(1)}g 남음`;

  }


  $("progressBar").style.width =
    `${percent}%`;


  const list = $("foodList");

  list.innerHTML = "";


  $("emptyState").style.display =
    records.length
      ? "none"
      : "block";


  records.forEach((item) => {

    const element =
      document.createElement("div");

    element.className =
      "food-item";


    element.innerHTML = `
      <div class="food-name">
        ${escapeHtml(item.food_name)}
      </div>

      <div class="food-meta">
        ${Number(item.amount)}
        ${escapeHtml(item.unit)}
      </div>

      <div class="food-protein">
        ${Number(item.protein).toFixed(1)}g
      </div>

      <div class="record-actions">

        <button
          type="button"
          class="edit-btn"
          data-id="${item.id}">
          수정
        </button>

        <button
          type="button"
          class="delete-btn"
          data-id="${item.id}">
          삭제
        </button>

      </div>
    `;


    list.appendChild(element);

  });


  document
    .querySelectorAll(".edit-btn")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () =>
          startEdit(
            button.dataset.id
          )
      );

    });


  document
    .querySelectorAll(".delete-btn")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () =>
          deleteRecord(
            button.dataset.id
          )
      );

    });
}


// ─────────────────────────────
// 음식 추가
// ─────────────────────────────

$("addBtn").addEventListener(
  "click",
  () => {

    resetFoodForm();

    $("foodDialogTitle").textContent =
      "음식 추가";

    $("foodSaveBtn").textContent =
      "추가하기";

    $("foodDialog").showModal();

  }
);


$("closeFoodDialog").addEventListener(
  "click",
  () => {

    $("foodDialog").close();

  }
);


// ─────────────────────────────
// 단백질 입력 방식
// ─────────────────────────────

document
  .querySelectorAll(
    'input[name="calcMode"]'
  )
  .forEach((radio) => {

    radio.addEventListener(
      "change",
      updateCalcModeUI
    );

  });


function updateCalcModeUI() {

  const mode =
    document.querySelector(
      'input[name="calcMode"]:checked'
    ).value;


  $("per100Wrap")
    .classList.toggle(
      "hidden",
      mode !== "per100"
    );


  $("directWrap")
    .classList.toggle(
      "hidden",
      mode !== "direct"
    );
}


// ─────────────────────────────
// 음식 저장 / 수정
// ─────────────────────────────

$("foodForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const name =
      $("foodName").value.trim();

    const amount =
      Number($("amount").value);

    const unit =
      $("unit").value;


    const mode =
      document.querySelector(
        'input[name="calcMode"]:checked'
      ).value;


    if (!name || amount <= 0) {

      alert(
        "음식 이름과 먹은 양을 확인해주세요."
      );

      return;
    }


    let protein = 0;


    if (mode === "per100") {

      const value =
        $("proteinPer100").value;


      if (value === "") {

        alert(
          "100g/ml당 단백질을 입력해주세요."
        );

        return;
      }


      const per100 =
        Number(value);


      if (per100 < 0) return;


      protein =
        amount * per100 / 100;

    } else {

      const value =
        $("directProtein").value;


      if (value === "") {

        alert(
          "단백질 양을 입력해주세요."
        );

        return;
      }


      protein =
        Number(value);


      if (protein < 0) return;

    }


    const payload = {

      user_id:
        currentUser.id,

      record_date:
        todayKey(),

      food_name:
        name,

      amount:
        amount,

      unit:
        unit,

      protein:
        Number(
          protein.toFixed(2)
        )

    };


    let error;


    // 수정

    if (editingId) {

      const result =
        await client
          .from("protein_records")
          .update(payload)
          .eq("id", editingId);


      error =
        result.error;


    // 새 음식 추가

    } else {

      const result =
        await client
          .from("protein_records")
          .insert(payload);


      error =
        result.error;

    }


    if (error) {

      console.error(
        "저장 실패:",
        error
      );

      alert(
        "저장 중 오류가 발생했습니다."
      );

      return;
    }


    $("foodDialog").close();

    resetFoodForm();

    await loadRecords();

    render();

  }
);


// ─────────────────────────────
// 음식 수정
// ─────────────────────────────

function startEdit(id) {

  const item =
    records.find(
      (record) =>
        record.id === id
    );


  if (!item) return;


  editingId = id;


  $("foodDialogTitle").textContent =
    "음식 수정";


  $("foodSaveBtn").textContent =
    "수정 완료";


  $("foodName").value =
    item.food_name;


  $("amount").value =
    item.amount;


  $("unit").value =
    item.unit;


  // 기존 기록은 계산식 대신
  // 저장된 최종 단백질 값을 불러옴

  document.querySelector(
    'input[name="calcMode"][value="direct"]'
  ).checked = true;


  $("directProtein").value =
    item.protein;


  updateCalcModeUI();


  $("foodDialog").showModal();

}


// ─────────────────────────────
// 음식 삭제
// ─────────────────────────────

async function deleteRecord(id) {

  const confirmed =
    confirm(
      "이 기록을 삭제할까요?"
    );


  if (!confirmed) return;


  const { error } =
    await client
      .from("protein_records")
      .delete()
      .eq("id", id);


  if (error) {

    console.error(
      "삭제 실패:",
      error
    );

    alert(
      "삭제 중 오류가 발생했습니다."
    );

    return;
  }


  await loadRecords();

  render();

}


// ─────────────────────────────
// 음식 폼 초기화
// ─────────────────────────────

function resetFoodForm() {

  editingId = null;


  $("foodForm").reset();


  document.querySelector(
    'input[name="calcMode"][value="per100"]'
  ).checked = true;


  updateCalcModeUI();

}


// ─────────────────────────────
// 목표 설정
// ─────────────────────────────

$("goalBtn").addEventListener(
  "click",
  () => {

    $("goalInput").value =
      proteinGoal;

    $("goalDialog").showModal();

  }
);


$("closeGoalDialog").addEventListener(
  "click",
  () => {

    $("goalDialog").close();

  }
);


$("goalForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const goal =
      Number(
        $("goalInput").value
      );


    if (goal <= 0) return;


    const { error } =
      await client
        .from("user_settings")
        .upsert(
          {
            user_id:
              currentUser.id,

            protein_goal:
              goal,

            updated_at:
              new Date().toISOString()
          },
          {
            onConflict:
              "user_id"
          }
        );


    if (error) {

      console.error(
        "목표 저장 실패:",
        error
      );

      alert(
        "목표 저장 중 오류가 발생했습니다."
      );

      return;
    }


    proteinGoal = goal;


    $("goalDialog").close();


    render();

  }
);


// ─────────────────────────────
// HTML 문자 처리
// ─────────────────────────────

function escapeHtml(value) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


// ─────────────────────────────
// Service Worker
// ─────────────────────────────

if ("serviceWorker" in navigator) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .catch((error) => {

          console.error(
            "Service Worker 등록 실패:",
            error
          );

        });

    }
  );

}


// ─────────────────────────────
// 시작
// ─────────────────────────────

initializeApp();

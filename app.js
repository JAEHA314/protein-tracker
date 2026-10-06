const SUPABASE_URL = "https://plvgepenuwfwvhsmrwbj.supabase.co";
const SUPABASE_KEY = "sb_publishable_ly1XmYcdunJ7_ZlJkPVRxg_aqjWJDmd";

const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (id) => document.getElementById(id);


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let selectedDate = new Date();
let calendarDate = new Date();

let proteinGoal = 75;

let records = [];
let monthRecords = [];

let databaseFoods = [];
let userFoods = [];
let favorites = [];

let selectedFood = null;
let editingRecordId = null;

let bodyRecords = [];
let userProfile = null;

let selectedChart = "muscle";


/* =========================================================
   DATE HELPERS
========================================================= */

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] =
    key.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function todayKey() {
  return localDateKey(
    new Date()
  );
}

function isToday(date) {
  return (
    localDateKey(date) ===
    todayKey()
  );
}

function isFuture(date) {
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return target > today;
}

function formatSelectedDate(date) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      month: "long",
      day: "numeric",
      weekday: "long"
    }
  ).format(date);
}

function formatShortDate(key) {
  const date =
    dateFromKey(key);

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      month: "numeric",
      day: "numeric"
    }
  ).format(date);
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeApp() {
  try {
    const {
      data: { session }
    } =
      await client.auth.getSession();

    if (!session?.user) {
      showLogin();
      return;
    }

    currentUser =
      session.user;

    await openApp();

  } catch (error) {
    console.error(
      "앱 초기화 실패:",
      error
    );

    showLogin();
  }
}

function showLogin() {
  $("loginScreen")
    .classList
    .remove("hidden");

  $("appScreen")
    .classList
    .add("hidden");
}

async function openApp() {
  $("loginScreen")
    .classList
    .add("hidden");

  $("appScreen")
    .classList
    .remove("hidden");

  selectedDate =
    new Date();

  calendarDate =
    new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1
    );

  $("datePicker").max =
    todayKey();

  $("bodyRecordDate").max =
    todayKey();

  $("profileBirthDate").max =
    todayKey();

  await Promise.all([
    loadGoal(),
    loadFoodLibrary(),
    loadFavorites(),
    loadBodyRecords(),
    loadUserProfile()
  ]);

  await loadSelectedDateRecords();

  renderToday();
  renderFavorites();
  renderGrowth();
}


/* =========================================================
   LOGIN
========================================================= */

$("loginForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      $("loginError")
        .textContent = "";

      const email =
        $("loginEmail")
          .value
          .trim();

      const password =
        $("loginPassword")
          .value;

      const {
        data,
        error
      } =
        await client.auth
          .signInWithPassword({
            email,
            password
          });

      if (error) {
        console.error(error);

        $("loginError")
          .textContent =
          "이메일 또는 비밀번호를 확인해주세요.";

        return;
      }

      currentUser =
        data.user;

      await openApp();
    }
  );


$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      await client.auth
        .signOut();

      currentUser = null;

      records = [];
      bodyRecords = [];
      userProfile = null;

      $("profileDialog")
        .close();

      showLogin();
    }
  );


/* =========================================================
   BOTTOM NAVIGATION
========================================================= */

document
  .querySelectorAll(".nav-item")
  .forEach((button) => {

    button.addEventListener(
      "click",
      async () => {

        const view =
          button.dataset.view;

        document
          .querySelectorAll(
            ".nav-item"
          )
          .forEach((item) => {

            item.classList.toggle(
              "active",
              item === button
            );

          });

        document
          .querySelectorAll(".view")
          .forEach((section) => {

            section.classList
              .remove("active");

          });


        if (view === "today") {
          $("todayView")
            .classList
            .add("active");
        }


        if (view === "calendar") {
          $("calendarView")
            .classList
            .add("active");

          calendarDate =
            new Date(
              selectedDate.getFullYear(),
              selectedDate.getMonth(),
              1
            );

          await renderCalendar();
        }


        if (view === "growth") {
          $("growthView")
            .classList
            .add("active");

          await Promise.all([
            loadBodyRecords(),
            loadUserProfile()
          ]);

          renderGrowth();
        }

      }
    );

  });


/* =========================================================
   GOAL
========================================================= */

async function loadGoal() {
  const {
    data,
    error
  } =
    await client
      .from("user_settings")
      .select("protein_goal")
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();

  if (error) {
    console.error(
      "목표 불러오기 실패:",
      error
    );

    return;
  }


  if (!data) {
    const {
      error: insertError
    } =
      await client
        .from("user_settings")
        .insert({
          user_id:
            currentUser.id,

          protein_goal: 75
        });

    if (insertError) {
      console.error(
        "기본 목표 생성 실패:",
        insertError
      );
    }

    proteinGoal = 75;

    return;
  }

  proteinGoal =
    Number(
      data.protein_goal
    );
}


/* =========================================================
   PROFILE
========================================================= */

async function loadUserProfile() {
  const {
    data,
    error
  } =
    await client
      .from("user_profile")
      .select("*")
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();

  if (error) {
    console.error(
      "프로필 불러오기 실패:",
      error
    );

    userProfile = null;

    return;
  }

  userProfile =
    data || null;
}


$("profileBtn")
  .addEventListener(
    "click",
    openProfile
  );

$("settingsBtn")
  .addEventListener(
    "click",
    openProfile
  );


$("closeProfileDialog")
  .addEventListener(
    "click",
    () => {

      $("profileDialog")
        .close();

    }
  );


async function openProfile() {
  await loadUserProfile();

  $("profileSex").value =
    userProfile?.sex || "";

  $("profileBirthDate").value =
    userProfile?.birth_date || "";

  $("profileHeight").value =
    userProfile?.height_cm ?? "";

  $("profileProteinGoal").value =
    proteinGoal;

  $("profileDialog")
    .showModal();
}


$("profileForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const sex =
        $("profileSex").value ||
        null;

      const birthDate =
        $("profileBirthDate")
          .value ||
        null;

      const height =
        optionalNumber(
          $("profileHeight").value
        );

      const goal =
        Number(
          $("profileProteinGoal")
            .value
        );


      if (
        !Number.isFinite(goal) ||
        goal <= 0
      ) {
        return;
      }


      const [
        profileResult,
        goalResult
      ] =
        await Promise.all([

          client
            .from("user_profile")
            .upsert(
              {
                user_id:
                  currentUser.id,

                sex,

                birth_date:
                  birthDate,

                height_cm:
                  height,

                updated_at:
                  new Date()
                    .toISOString()
              },
              {
                onConflict:
                  "user_id"
              }
            ),


          client
            .from("user_settings")
            .upsert(
              {
                user_id:
                  currentUser.id,

                protein_goal:
                  goal,

                updated_at:
                  new Date()
                    .toISOString()
              },
              {
                onConflict:
                  "user_id"
              }
            )

        ]);


      if (
        profileResult.error ||
        goalResult.error
      ) {

        console.error(
          profileResult.error ||
          goalResult.error
        );

        alert(
          "정보를 저장하지 못했습니다."
        );

        return;
      }


      proteinGoal = goal;

      await loadUserProfile();

      $("profileDialog")
        .close();

      renderToday();
      renderGrowth();
    }
  );


/* =========================================================
   DATE NAVIGATION
========================================================= */

$("prevDateBtn")
  .addEventListener(
    "click",
    async () => {

      const previous =
        new Date(selectedDate);

      previous.setDate(
        previous.getDate() - 1
      );

      selectedDate =
        previous;

      await loadSelectedDateRecords();

      renderToday();
    }
  );


$("nextDateBtn")
  .addEventListener(
    "click",
    async () => {

      const next =
        new Date(selectedDate);

      next.setDate(
        next.getDate() + 1
      );

      if (
        isFuture(next)
      ) {
        return;
      }

      selectedDate =
        next;

      await loadSelectedDateRecords();

      renderToday();
    }
  );


$("datePickerBtn")
  .addEventListener(
    "click",
    () => {

      $("datePicker").value =
        localDateKey(
          selectedDate
        );

      if (
        typeof $("datePicker")
          .showPicker ===
        "function"
      ) {

        $("datePicker")
          .showPicker();

      } else {

        $("datePicker")
          .click();

      }

    }
  );


$("datePicker")
  .addEventListener(
    "change",
    async () => {

      if (
        !$("datePicker").value
      ) {
        return;
      }

      const date =
        dateFromKey(
          $("datePicker").value
        );

      if (
        isFuture(date)
      ) {
        return;
      }

      selectedDate =
        date;

      await loadSelectedDateRecords();

      renderToday();
    }
  );


/* =========================================================
   PROTEIN RECORDS
========================================================= */

async function loadSelectedDateRecords() {
  const {
    data,
    error
  } =
    await client
      .from("protein_records")
      .select("*")
      .eq(
        "record_date",
        localDateKey(
          selectedDate
        )
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {
    console.error(
      "기록 불러오기 실패:",
      error
    );

    records = [];

    return;
  }

  records =
    data || [];
}


function renderToday() {
  $("selectedDateLabel")
    .textContent =
    formatSelectedDate(
      selectedDate
    );

  $("selectedDateSub")
    .textContent =
    isToday(selectedDate)
      ? "오늘"
      : "";

  $("nextDateBtn").disabled =
    isToday(selectedDate);


  const total =
    records.reduce(
      (sum, record) =>
        sum +
        Number(
          record.protein
        ),
      0
    );


  const percent =
    proteinGoal > 0
      ? (
          total /
          proteinGoal
        ) * 100
      : 0;


  $("totalProtein")
    .textContent =
    total.toFixed(1);


  $("goalText")
    .textContent =
    formatNumber(
      proteinGoal
    );


  $("goalPercent")
    .textContent =
    `${Math.round(percent)}%`;


  $("progressBar")
    .style
    .width =
    `${Math.min(
      percent,
      100
    )}%`;


  if (
    total >= proteinGoal
  ) {

    $("remainingText")
      .textContent =
      `목표 +${(
        total -
        proteinGoal
      ).toFixed(1)}g`;

  } else {

    $("remainingText")
      .textContent =
      `${(
        proteinGoal -
        total
      ).toFixed(1)}g 남음`;

  }


  renderFoodRecords();
}


function renderFoodRecords() {
  const list =
    $("foodList");

  list.innerHTML = "";


  $("emptyState")
    .style
    .display =
    records.length
      ? "none"
      : "block";


  records.forEach(
    (item) => {

      const element =
        document
          .createElement("div");

      element.className =
        "food-item";


      element.innerHTML = `
        <div class="food-name">
          ${escapeHtml(
            item.food_name
          )}
        </div>

        <div class="food-meta">
          ${formatNumber(
            item.amount
          )}
          ${escapeHtml(
            item.unit
          )}
        </div>

        <div class="food-protein">
          ${Number(
            item.protein
          ).toFixed(1)}g
        </div>

        <div class="record-actions">

          <button
            type="button"
            class="edit-btn"
            data-id="${item.id}"
          >
            수정
          </button>

          <button
            type="button"
            class="delete-btn"
            data-id="${item.id}"
          >
            삭제
          </button>

        </div>
      `;


      list.appendChild(
        element
      );
    }
  );


  document
    .querySelectorAll(
      ".edit-btn"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            startRecordEdit(
              button.dataset.id
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-btn"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            deleteRecord(
              button.dataset.id
            );

          }
        );

      }
    );
}


async function deleteRecord(id) {
  const confirmed =
    confirm(
      "이 기록을 삭제할까요?"
    );

  if (!confirmed) {
    return;
  }


  const {
    error
  } =
    await client
      .from("protein_records")
      .delete()
      .eq(
        "id",
        id
      );


  if (error) {
    console.error(error);

    alert(
      "삭제하지 못했습니다."
    );

    return;
  }


  await loadSelectedDateRecords();

  renderToday();
}


function startRecordEdit(id) {
  const item =
    records.find(
      (record) =>
        record.id === id
    );

  if (!item) {
    return;
  }


  resetFoodDialog();

  editingRecordId =
    id;


  $("foodDialogTitle")
    .textContent =
    "음식 수정";


  $("manualFoodName")
    .value =
    item.food_name;

  $("manualAmount")
    .value =
    item.amount;

  $("manualUnit")
    .value =
    item.unit;

  $("manualProtein")
    .value =
    item.protein;


  $("saveAsMyFood")
    .checked =
    false;

  $("saveAsMyFood")
    .closest(".check-row")
    .classList
    .add("hidden");


  $("manualFoodSaveBtn")
    .textContent =
    "수정 완료";


  showManualStep();

  $("foodDialog")
    .showModal();
}


/* =========================================================
   FOOD LIBRARY
========================================================= */

async function loadFoodLibrary() {
  const [
    databaseResult,
    userResult
  ] =
    await Promise.all([

      client
        .from("food_database")
        .select("*")
        .order("food_name"),

      client
        .from("user_foods")
        .select("*")
        .eq(
          "user_id",
          currentUser.id
        )
        .order("food_name")

    ]);


  if (
    databaseResult.error
  ) {
    console.error(
      "기본 음식 불러오기 실패:",
      databaseResult.error
    );
  }


  if (
    userResult.error
  ) {
    console.error(
      "내 음식 불러오기 실패:",
      userResult.error
    );
  }


  databaseFoods =
    (
      databaseResult.data ||
      []
    ).map(
      (food) => ({
        ...food,
        source_type:
          "database"
      })
    );


  userFoods =
    (
      userResult.data ||
      []
    ).map(
      (food) => ({
        ...food,
        source_type:
          "user"
      })
    );
}


function allFoods() {
  return [
    ...userFoods,
    ...databaseFoods
  ];
}


function renderFoodSearch(
  query = ""
) {
  const normalized =
    query
      .trim()
      .toLowerCase();


  const foods =
    allFoods()
      .filter(
        (food) =>
          String(
            food.food_name
          )
            .toLowerCase()
            .includes(
              normalized
            )
      );


  const resultBox =
    $("foodSearchResults");

  resultBox.innerHTML = "";


  if (!foods.length) {
    resultBox.innerHTML = `
      <p class="empty-inline">
        검색 결과가 없습니다.
      </p>
    `;

    return;
  }


  foods.forEach(
    (food) => {

      resultBox.appendChild(
        createFoodResultButton(
          food
        )
      );

    }
  );
}


function createFoodResultButton(
  food
) {
  const button =
    document
      .createElement(
        "button"
      );

  button.type =
    "button";

  button.className =
    "food-result";


  const amount =
    formatNumber(
      food.default_amount
    );


  const weightText =
    food.weight_grams == null
      ? ""
      : ` · 약 ${formatNumber(
          food.weight_grams
        )}g`;


  button.innerHTML = `
    <span class="food-result-main">

      <span class="food-result-name">
        ${escapeHtml(
          food.food_name
        )}
      </span>

      <span class="food-result-info">
        ${amount}${escapeHtml(
          food.default_unit
        )}
        ${weightText}
      </span>

    </span>

    <span class="food-result-protein">
      ${Number(
        food.protein
      ).toFixed(1)}g
    </span>
  `;


  button.addEventListener(
    "click",
    () => {

      selectFood(food);

    }
  );


  return button;
}


/* =========================================================
   FAVORITES
========================================================= */

async function loadFavorites() {
  const {
    data,
    error
  } =
    await client
      .from("food_favorites")
      .select("*")
      .eq(
        "user_id",
        currentUser.id
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {
    console.error(
      "즐겨찾기 불러오기 실패:",
      error
    );

    favorites = [];

    return;
  }


  favorites =
    data || [];
}


function favoriteKey(food) {
  return (
    `${food.source_type}:` +
    `${String(food.id)}`
  );
}


function isFavorite(food) {
  const key =
    favoriteKey(food);


  return favorites.some(
    (favorite) =>
      `${favorite.source_type}:` +
      `${favorite.food_id}` ===
      key
  );
}


function favoriteFoodsList() {
  return allFoods()
    .filter(
      (food) =>
        isFavorite(food)
    );
}


function renderFavorites() {
  const homeBox =
    $("favoriteFoods");

  const dialogBox =
    $("dialogFavorites");


  homeBox.innerHTML = "";
  dialogBox.innerHTML = "";


  const foods =
    favoriteFoodsList();


  if (!foods.length) {
    homeBox.innerHTML = `
      <p class="empty-inline">
        즐겨찾기한 음식이 여기에 표시됩니다.
      </p>
    `;

    dialogBox.innerHTML = `
      <p class="empty-inline">
        아직 즐겨찾기가 없습니다.
      </p>
    `;

    return;
  }


  foods.forEach(
    (food) => {

      const chip =
        document
          .createElement(
            "button"
          );

      chip.type =
        "button";

      chip.className =
        "favorite-chip";

      chip.textContent =
        food.food_name;


      chip.addEventListener(
        "click",
        () => {

          openFoodDialog();

          selectFood(food);

        }
      );


      homeBox.appendChild(
        chip
      );


      dialogBox.appendChild(
        createFoodResultButton(
          food
        )
      );

    }
  );
}


async function toggleFavorite() {
  if (!selectedFood) {
    return;
  }


  if (
    isFavorite(
      selectedFood
    )
  ) {

    const favorite =
      favorites.find(
        (item) =>
          item.source_type ===
            selectedFood.source_type &&
          String(item.food_id) ===
            String(selectedFood.id)
      );


    if (!favorite) {
      return;
    }


    const {
      error
    } =
      await client
        .from("food_favorites")
        .delete()
        .eq(
          "id",
          favorite.id
        );


    if (error) {
      console.error(error);

      return;
    }

  } else {

    const {
      error
    } =
      await client
        .from("food_favorites")
        .insert({
          user_id:
            currentUser.id,

          source_type:
            selectedFood.source_type,

          food_id:
            String(
              selectedFood.id
            )
        });


    if (error) {
      console.error(error);

      return;
    }

  }


  await loadFavorites();

  renderFavorites();
  updateFavoriteButton();
}


function updateFavoriteButton() {
  if (!selectedFood) {
    return;
  }

  $("favoriteToggleBtn")
    .textContent =
    isFavorite(
      selectedFood
    )
      ? "★"
      : "☆";
}


/* =========================================================
   FOOD DIALOG
========================================================= */

function resetFoodDialog() {
  selectedFood = null;
  editingRecordId = null;

  $("foodDialogTitle")
    .textContent =
    "음식 추가";

  $("foodSearchInput")
    .value =
    "";

  $("manualFoodForm")
    .reset();


  $("saveAsMyFood")
    .closest(".check-row")
    .classList
    .remove("hidden");


  $("manualFoodSaveBtn")
    .textContent =
    "기록하기";


  showFoodSearchStep();

  renderFoodSearch();
  renderFavorites();
}


function openFoodDialog() {
  resetFoodDialog();

  $("foodDialog")
    .showModal();
}


$("addBtn")
  .addEventListener(
    "click",
    openFoodDialog
  );


$("emptyAddBtn")
  .addEventListener(
    "click",
    openFoodDialog
  );


$("closeFoodDialog")
  .addEventListener(
    "click",
    () => {

      $("foodDialog")
        .close();

    }
  );


$("foodSearchInput")
  .addEventListener(
    "input",
    () => {

      renderFoodSearch(
        $("foodSearchInput")
          .value
      );

    }
  );


$("manualFoodBtn")
  .addEventListener(
    "click",
    () => {

      editingRecordId =
        null;

      showManualStep();

    }
  );


$("backFromManual")
  .addEventListener(
    "click",
    () => {

      resetFoodDialog();

    }
  );


$("backToFoodSearch")
  .addEventListener(
    "click",
    () => {

      selectedFood =
        null;

      showFoodSearchStep();

    }
  );


$("favoriteToggleBtn")
  .addEventListener(
    "click",
    toggleFavorite
  );


function showFoodSearchStep() {
  $("foodSearchStep")
    .classList
    .remove("hidden");

  $("databaseFoodForm")
    .classList
    .add("hidden");

  $("manualFoodForm")
    .classList
    .add("hidden");
}


function showDatabaseStep() {
  $("foodSearchStep")
    .classList
    .add("hidden");

  $("databaseFoodForm")
    .classList
    .remove("hidden");

  $("manualFoodForm")
    .classList
    .add("hidden");
}


function showManualStep() {
  $("foodSearchStep")
    .classList
    .add("hidden");

  $("databaseFoodForm")
    .classList
    .add("hidden");

  $("manualFoodForm")
    .classList
    .remove("hidden");
}


function selectFood(food) {
  selectedFood =
    food;


  $("selectedFoodName")
    .textContent =
    food.food_name;


  $("databaseFoodAmount")
    .value =
    food.default_amount;


  $("databaseFoodUnit")
    .textContent =
    food.default_unit;


  updateFavoriteButton();
  updateDatabaseCalculation();

  showDatabaseStep();
}


$("databaseFoodAmount")
  .addEventListener(
    "input",
    updateDatabaseCalculation
  );


function calculateSelectedFood() {
  if (!selectedFood) {
    return {
      protein: 0,
      weight: null
    };
  }


  const amount =
    Number(
      $("databaseFoodAmount")
        .value
    );


  const defaultAmount =
    Number(
      selectedFood.default_amount
    );


  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(
      defaultAmount
    ) ||
    defaultAmount <= 0
  ) {

    return {
      protein: 0,
      weight: null
    };

  }


  const ratio =
    amount /
    defaultAmount;


  const protein =
    Number(
      selectedFood.protein
    ) * ratio;


  const weight =
    selectedFood.weight_grams ==
    null
      ? null
      : Number(
          selectedFood.weight_grams
        ) * ratio;


  return {
    protein,
    weight
  };
}


function updateDatabaseCalculation() {
  const result =
    calculateSelectedFood();


  $("estimatedProtein")
    .textContent =
    `${result.protein.toFixed(
      1
    )}g`;


  $("estimatedWeight")
    .textContent =
    result.weight == null
      ? "—"
      : `약 ${result.weight.toFixed(
          0
        )}g`;
}


$("databaseFoodForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      if (!selectedFood) {
        return;
      }


      const amount =
        Number(
          $("databaseFoodAmount")
            .value
        );


      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return;
      }


      const calculation =
        calculateSelectedFood();


      const {
        error
      } =
        await client
          .from(
            "protein_records"
          )
          .insert({
            user_id:
              currentUser.id,

            record_date:
              localDateKey(
                selectedDate
              ),

            food_name:
              selectedFood
                .food_name,

            amount,

            unit:
              selectedFood
                .default_unit,

            protein:
              Number(
                calculation
                  .protein
                  .toFixed(2)
              )
          });


      if (error) {
        console.error(error);

        alert(
          "음식을 기록하지 못했습니다."
        );

        return;
      }


      $("foodDialog")
        .close();


      await loadSelectedDateRecords();

      renderToday();
    }
  );


/* =========================================================
   MANUAL FOOD
========================================================= */

$("manualFoodForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const foodName =
        $("manualFoodName")
          .value
          .trim();


      const amount =
        Number(
          $("manualAmount")
            .value
        );


      const unit =
        $("manualUnit")
          .value;


      const protein =
        Number(
          $("manualProtein")
            .value
        );


      if (
        !foodName ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isFinite(protein) ||
        protein < 0
      ) {
        return;
      }


      const payload = {
        user_id:
          currentUser.id,

        record_date:
          localDateKey(
            selectedDate
          ),

        food_name:
          foodName,

        amount,

        unit,

        protein:
          Number(
            protein.toFixed(2)
          )
      };


      let error = null;


      if (
        editingRecordId
      ) {

        const result =
          await client
            .from(
              "protein_records"
            )
            .update(payload)
            .eq(
              "id",
              editingRecordId
            );

        error =
          result.error;

      } else {

        const result =
          await client
            .from(
              "protein_records"
            )
            .insert(payload);

        error =
          result.error;

      }


      if (error) {
        console.error(error);

        alert(
          "음식을 저장하지 못했습니다."
        );

        return;
      }


      if (
        !editingRecordId &&
        $("saveAsMyFood")
          .checked
      ) {

        const {
          error: foodError
        } =
          await client
            .from("user_foods")
            .insert({
              user_id:
                currentUser.id,

              food_name:
                foodName,

              default_unit:
                unit,

              default_amount:
                amount,

              weight_grams:
                unit === "g"
                  ? amount
                  : null,

              protein:
                Number(
                  protein.toFixed(
                    2
                  )
                )
            });


        if (foodError) {
          console.error(
            "내 음식 저장 실패:",
            foodError
          );
        }

      }


      $("foodDialog")
        .close();


      editingRecordId =
        null;


      await Promise.all([
        loadSelectedDateRecords(),
        loadFoodLibrary()
      ]);


      renderToday();
      renderFavorites();
    }
  );


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonthBtn")
  .addEventListener(
    "click",
    async () => {

      calendarDate =
        new Date(
          calendarDate
            .getFullYear(),

          calendarDate
            .getMonth() - 1,

          1
        );

      await renderCalendar();
    }
  );


$("nextMonthBtn")
  .addEventListener(
    "click",
    async () => {

      const next =
        new Date(
          calendarDate
            .getFullYear(),

          calendarDate
            .getMonth() + 1,

          1
        );


      const currentMonth =
        new Date(
          new Date()
            .getFullYear(),

          new Date()
            .getMonth(),

          1
        );


      if (
        next > currentMonth
      ) {
        return;
      }


      calendarDate =
        next;

      await renderCalendar();
    }
  );


async function renderCalendar() {
  const year =
    calendarDate
      .getFullYear();

  const month =
    calendarDate
      .getMonth();


  $("calendarMonthLabel")
    .textContent =
    `${year}년 ${month + 1}월`;


  const firstDate =
    new Date(
      year,
      month,
      1
    );


  const lastDate =
    new Date(
      year,
      month + 1,
      0
    );


  const startKey =
    localDateKey(
      firstDate
    );


  const endKey =
    localDateKey(
      lastDate
    );


  const {
    data,
    error
  } =
    await client
      .from(
        "protein_records"
      )
      .select(
        "record_date, protein"
      )
      .gte(
        "record_date",
        startKey
      )
      .lte(
        "record_date",
        endKey
      );


  if (error) {
    console.error(
      "캘린더 기록 불러오기 실패:",
      error
    );

    monthRecords = [];

  } else {

    monthRecords =
      data || [];

  }


  const totals = {};


  monthRecords.forEach(
    (record) => {

      if (
        !totals[
          record.record_date
        ]
      ) {

        totals[
          record.record_date
        ] = 0;

      }


      totals[
        record.record_date
      ] +=
        Number(
          record.protein
        );

    }
  );


  const grid =
    $("calendarGrid");

  grid.innerHTML = "";


  for (
    let index = 0;
    index <
      firstDate.getDay();
    index++
  ) {

    const empty =
      document
        .createElement(
          "div"
        );

    empty.className =
      "calendar-day empty";

    grid.appendChild(
      empty
    );

  }


  for (
    let day = 1;
    day <=
      lastDate.getDate();
    day++
  ) {

    const date =
      new Date(
        year,
        month,
        day
      );


    const key =
      localDateKey(date);


    const total =
      totals[key] || 0;


    const rawProgress =
      proteinGoal > 0
        ? total /
          proteinGoal
        : 0;


    const progress =
      Math.max(
        0,
        Math.min(
          rawProgress,
          1
        )
      );


    const degrees =
      progress * 360;


    const button =
      document
        .createElement(
          "button"
        );


    button.type =
      "button";

    button.className =
      "calendar-day";


    button.style
      .setProperty(
        "--progress-angle",
        `${degrees}deg`
      );


    if (
      total <= 0
    ) {
      button.classList
        .add(
          "no-record"
        );
    }


    if (
      rawProgress >= 1
    ) {
      button.classList
        .add(
          "complete"
        );
    }


    if (
      key === todayKey()
    ) {
      button.classList
        .add("today");
    }


    if (
      key ===
      localDateKey(
        selectedDate
      )
    ) {
      button.classList
        .add("selected");
    }


    button.innerHTML = `
      <span class="calendar-ring">

        <span
          class="calendar-ring-inner"
        >
          ${day}
        </span>

      </span>
    `;


    if (
      isFuture(date)
    ) {

      button.disabled =
        true;

    } else {

      button.addEventListener(
        "click",
        async () => {

          selectedDate =
            date;

          await loadSelectedDateRecords();

          renderToday();

          switchToTodayView();
        }
      );

    }


    grid.appendChild(
      button
    );

  }


  const recordedTotals =
    Object.values(
      totals
    );


  if (
    !recordedTotals.length
  ) {

    $("monthlyAverageProtein")
      .textContent =
      "—";

    $("monthlyAveragePercent")
      .textContent =
      "—";

    $("monthlyGoalDays")
      .textContent =
      "—";

    return;
  }


  const sum =
    recordedTotals.reduce(
      (a, b) =>
        a + b,
      0
    );


  const average =
    sum /
    recordedTotals.length;


  const averagePercent =
    proteinGoal > 0
      ? (
          average /
          proteinGoal
        ) * 100
      : 0;


  const goalDays =
    recordedTotals.filter(
      (totalValue) =>
        totalValue >=
        proteinGoal
    ).length;


  $("monthlyAverageProtein")
    .textContent =
    `${average.toFixed(
      1
    )}g`;


  $("monthlyAveragePercent")
    .textContent =
    `${Math.round(
      averagePercent
    )}%`;


  $("monthlyGoalDays")
    .textContent =
    `${goalDays}일`;
}


function switchToTodayView() {
  document
    .querySelectorAll(".view")
    .forEach(
      (view) => {

        view.classList
          .remove("active");

      }
    );


  $("todayView")
    .classList
    .add("active");


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.view ===
            "today"
        );

      }
    );
}


/* =========================================================
   BODY CALCULATIONS
========================================================= */

function calculateAge(
  birthDate
) {
  if (!birthDate) {
    return null;
  }


  const birth =
    dateFromKey(
      birthDate
    );


  if (
    Number.isNaN(
      birth.getTime()
    )
  ) {
    return null;
  }


  const today =
    new Date();


  let age =
    today.getFullYear() -
    birth.getFullYear();


  const birthdayPassed =
    today.getMonth() >
      birth.getMonth() ||

    (
      today.getMonth() ===
        birth.getMonth() &&

      today.getDate() >=
        birth.getDate()
    );


  if (
    !birthdayPassed
  ) {
    age -= 1;
  }


  return age;
}


function calculateBMI(
  weightKg
) {
  const heightCm =
    Number(
      userProfile?.height_cm
    );


  if (
    !Number.isFinite(
      weightKg
    ) ||
    weightKg <= 0 ||
    !Number.isFinite(
      heightCm
    ) ||
    heightCm <= 0
  ) {
    return null;
  }


  const heightM =
    heightCm / 100;


  return (
    weightKg /
    (
      heightM *
      heightM
    )
  );
}


/*
  Mifflin-St Jeor equation

  여성:
  10W + 6.25H - 5A - 161

  남성:
  10W + 6.25H - 5A + 5
*/

function calculateBMR(
  weightKg
) {
  const heightCm =
    Number(
      userProfile?.height_cm
    );


  const age =
    calculateAge(
      userProfile?.birth_date
    );


  const sex =
    userProfile?.sex;


  if (
    !Number.isFinite(
      weightKg
    ) ||
    weightKg <= 0 ||
    !Number.isFinite(
      heightCm
    ) ||
    heightCm <= 0 ||
    age == null ||
    age < 0 ||
    !sex
  ) {
    return null;
  }


  const base =
    10 * weightKg +
    6.25 * heightCm -
    5 * age;


  if (
    sex === "female"
  ) {
    return (
      base - 161
    );
  }


  if (
    sex === "male"
  ) {
    return (
      base + 5
    );
  }


  return null;
}


/*
  근육 증가를 위한 실용적 추천 범위.
  사용자가 직접 설정한 proteinGoal과는 별개.
*/

function calculateProteinRecommendation(
  weightKg
) {
  if (
    !Number.isFinite(
      weightKg
    ) ||
    weightKg <= 0
  ) {
    return null;
  }


  return {
    minimum:
      weightKg * 1.6,

    maximum:
      weightKg * 2.0
  };
}


/* =========================================================
   BODY RECORDS
========================================================= */

async function loadBodyRecords() {
  const {
    data,
    error
  } =
    await client
      .from("body_records")
      .select("*")
      .eq(
        "user_id",
        currentUser.id
      )
      .order(
        "record_date",
        {
          ascending: true
        }
      );


  if (error) {
    console.error(
      "체성분 기록 불러오기 실패:",
      error
    );

    bodyRecords = [];

    return;
  }


  bodyRecords =
    data || [];
}


$("addBodyRecordBtn")
  .addEventListener(
    "click",
    () => {

      $("bodyRecordForm")
        .reset();


      $("bodyRecordDate")
        .value =
        todayKey();


      $("bodyRecordDialog")
        .showModal();

    }
  );


$("closeBodyRecordDialog")
  .addEventListener(
    "click",
    () => {

      $("bodyRecordDialog")
        .close();

    }
  );


$("bodyRecordForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const recordDate =
        $("bodyRecordDate")
          .value;


      if (!recordDate) {
        return;
      }


      const recordDateObject =
        dateFromKey(
          recordDate
        );


      if (
        isFuture(
          recordDateObject
        )
      ) {
        return;
      }


      const weight =
        optionalNumber(
          $("bodyWeight")
            .value
        );


      const muscle =
        optionalNumber(
          $("bodyMuscle")
            .value
        );


      const fat =
        optionalNumber(
          $("bodyFat")
            .value
        );


      if (
        weight == null &&
        muscle == null &&
        fat == null
      ) {

        alert(
          "측정값을 하나 이상 입력해주세요."
        );

        return;
      }


      const {
        error
      } =
        await client
          .from("body_records")
          .upsert(
            {
              user_id:
                currentUser.id,

              record_date:
                recordDate,

              weight_kg:
                weight,

              skeletal_muscle_kg:
                muscle,

              body_fat_kg:
                fat
            },
            {
              onConflict:
                "user_id,record_date"
            }
          );


      if (error) {
        console.error(error);

        alert(
          "측정 기록을 저장하지 못했습니다."
        );

        return;
      }


      $("bodyRecordDialog")
        .close();


      await loadBodyRecords();

      renderGrowth();
    }
  );


function renderGrowth() {
  if (
    !bodyRecords.length
  ) {

    $("latestBodyDate")
      .textContent =
      "기록 없음";

    $("latestWeight")
      .textContent =
      "—";

    $("latestMuscle")
      .textContent =
      "—";

    $("latestBodyFat")
      .textContent =
      "—";

    $("latestBMI")
      .textContent =
      "—";

    $("latestBMR")
      .textContent =
      "—";

    $("recommendedProtein")
      .textContent =
      "—";


    renderGrowthChart();

    return;
  }


  const latest =
    bodyRecords[
      bodyRecords.length - 1
    ];


  $("latestBodyDate")
    .textContent =
    formatShortDate(
      latest.record_date
    );


  $("latestWeight")
    .textContent =
    latest.weight_kg == null
      ? "—"
      : formatNumber(
          latest.weight_kg
        );


  $("latestMuscle")
    .textContent =
    latest.skeletal_muscle_kg ==
    null
      ? "—"
      : formatNumber(
          latest.skeletal_muscle_kg
        );


  $("latestBodyFat")
    .textContent =
    latest.body_fat_kg == null
      ? "—"
      : formatNumber(
          latest.body_fat_kg
        );


  const latestWeight =
    latest.weight_kg == null
      ? null
      : Number(
          latest.weight_kg
        );


  const bmi =
    calculateBMI(
      latestWeight
    );


  const bmr =
    calculateBMR(
      latestWeight
    );


  const recommendation =
    calculateProteinRecommendation(
      latestWeight
    );


  $("latestBMI")
    .textContent =
    bmi == null
      ? "—"
      : bmi.toFixed(1);


  $("latestBMR")
    .textContent =
    bmr == null
      ? "—"
      : Math.round(bmr)
          .toLocaleString(
            "ko-KR"
          );


  $("recommendedProtein")
    .textContent =
    recommendation == null
      ? "—"
      : `${Math.round(
          recommendation.minimum
        )}–${Math.round(
          recommendation.maximum
        )} g / day`;


  renderGrowthChart();
}


/* =========================================================
   GROWTH CHART SELECTOR
========================================================= */

document
  .querySelectorAll(
    "#chartSelector button"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          selectedChart =
            button.dataset.chart;


          document
            .querySelectorAll(
              "#chartSelector button"
            )
            .forEach(
              (item) => {

                item.classList.toggle(
                  "active",
                  item === button
                );

              }
            );


          renderGrowthChart();
        }
      );

    }
  );


/* =========================================================
   GROWTH CHART
========================================================= */

function getGrowthPoints() {
  if (
    selectedChart ===
    "bmi"
  ) {

    return bodyRecords
      .filter(
        (record) =>
          record.weight_kg !=
          null
      )
      .map(
        (record) => ({
          date:
            record.record_date,

          value:
            calculateBMI(
              Number(
                record.weight_kg
              )
            )
        })
      )
      .filter(
        (point) =>
          point.value != null
      );

  }


  let property =
    "skeletal_muscle_kg";


  if (
    selectedChart ===
    "weight"
  ) {

    property =
      "weight_kg";

  }


  if (
    selectedChart ===
    "fat"
  ) {

    property =
      "body_fat_kg";

  }


  return bodyRecords
    .filter(
      (record) =>
        record[property] !=
        null
    )
    .map(
      (record) => ({
        date:
          record.record_date,

        value:
          Number(
            record[property]
          )
      })
    );
}


function renderGrowthChart() {
  const canvas =
    $("growthChart");

  const empty =
    $("chartEmpty");


  const points =
    getGrowthPoints();


  if (
    !points.length
  ) {

    canvas.style.display =
      "none";

    empty.style.display =
      "block";

    return;
  }


  canvas.style.display =
    "block";

  empty.style.display =
    "none";


  const rect =
    canvas
      .getBoundingClientRect();


  const ratio =
    window.devicePixelRatio ||
    1;


  const width =
    Math.max(
      rect.width,
      260
    );


  const height =
    245;


  canvas.width =
    Math.round(
      width * ratio
    );


  canvas.height =
    Math.round(
      height * ratio
    );


  const ctx =
    canvas.getContext("2d");


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const styles =
    getComputedStyle(
      document.documentElement
    );


  const lineColor =
    styles
      .getPropertyValue(
        "--text"
      )
      .trim() ||
    "#171717";


  const gridColor =
    styles
      .getPropertyValue(
        "--line"
      )
      .trim() ||
    "#ddddda";


  const textColor =
    styles
      .getPropertyValue(
        "--text-secondary"
      )
      .trim() ||
    "#707070";


  /*
    top을 넉넉히 잡아서
    가장 높은 점의 숫자가
    잘리지 않도록 한다.
  */

  const padding = {
    top: 38,
    right: 18,
    bottom: 38,
    left: 39
  };


  const values =
    points.map(
      (point) =>
        point.value
    );


  let minimum =
    Math.min(
      ...values
    );


  let maximum =
    Math.max(
      ...values
    );


  if (
    minimum === maximum
  ) {

    const margin =
      Math.max(
        Math.abs(
          minimum
        ) * 0.05,
        0.5
      );

    minimum -= margin;
    maximum += margin;

  } else {

    const margin =
      (
        maximum -
        minimum
      ) * 0.2;

    minimum -= margin;
    maximum += margin;

  }


  const chartWidth =
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  /*
    horizontal grid
  */

  ctx.font =
    "10px -apple-system, BlinkMacSystemFont, sans-serif";

  ctx.textAlign =
    "left";

  ctx.textBaseline =
    "middle";

  ctx.fillStyle =
    textColor;

  ctx.strokeStyle =
    gridColor;

  ctx.lineWidth = 1;


  for (
    let index = 0;
    index < 3;
    index++
  ) {

    const ratioY =
      index / 2;


    const y =
      padding.top +
      chartHeight *
        ratioY;


    const value =
      maximum -
      (
        maximum -
        minimum
      ) * ratioY;


    ctx.beginPath();

    ctx.moveTo(
      padding.left,
      y
    );

    ctx.lineTo(
      width -
      padding.right,
      y
    );

    ctx.stroke();


    ctx.fillText(
      value.toFixed(1),
      2,
      y
    );

  }


  function pointX(index) {
    if (
      points.length === 1
    ) {

      return (
        padding.left +
        chartWidth / 2
      );

    }


    return (
      padding.left +
      (
        chartWidth /
        (
          points.length -
          1
        )
      ) * index
    );
  }


  function pointY(value) {
    return (
      padding.top +
      (
        (
          maximum -
          value
        ) /
        (
          maximum -
          minimum
        )
      ) *
      chartHeight
    );
  }


  /*
    line
  */

  ctx.strokeStyle =
    lineColor;

  ctx.lineWidth =
    1.8;

  ctx.lineJoin =
    "round";

  ctx.lineCap =
    "round";


  ctx.beginPath();


  points.forEach(
    (point, index) => {

      const x =
        pointX(index);

      const y =
        pointY(
          point.value
        );


      if (
        index === 0
      ) {

        ctx.moveTo(
          x,
          y
        );

      } else {

        ctx.lineTo(
          x,
          y
        );

      }

    }
  );


  ctx.stroke();


  /*
    points
  */

  ctx.fillStyle =
    lineColor;


  points.forEach(
    (point, index) => {

      const x =
        pointX(index);

      const y =
        pointY(
          point.value
        );


      ctx.beginPath();

      ctx.arc(
        x,
        y,
        3.5,
        0,
        Math.PI * 2
      );

      ctx.fill();

    }
  );


  /*
    정확한 수치
    각 점 바로 위
  */

  ctx.font =
    "600 11px -apple-system, BlinkMacSystemFont, sans-serif";

  ctx.textAlign =
    "center";

  ctx.textBaseline =
    "bottom";

  ctx.fillStyle =
    lineColor;


  points.forEach(
    (point, index) => {

      const x =
        pointX(index);

      const y =
        pointY(
          point.value
        );


      ctx.fillText(
        point.value.toFixed(
          1
        ),
        x,
        y - 8
      );

    }
  );


  /*
    날짜 라벨

    기록이 많아지면 모든 날짜를
    표시하지 않고 시작/중간/끝만
    표시해서 겹침을 막는다.
  */

  let labelIndexes = [];


  if (
    points.length <= 4
  ) {

    labelIndexes =
      points.map(
        (_, index) =>
          index
      );

  } else {

    labelIndexes = [
      0,
      Math.floor(
        (
          points.length -
          1
        ) / 2
      ),
      points.length - 1
    ];

  }


  ctx.font =
    "10px -apple-system, BlinkMacSystemFont, sans-serif";

  ctx.textAlign =
    "center";

  ctx.textBaseline =
    "alphabetic";

  ctx.fillStyle =
    textColor;


  labelIndexes.forEach(
    (index) => {

      const point =
        points[index];


      ctx.fillText(
        formatShortDate(
          point.date
        ),
        pointX(index),
        height - 10
      );

    }
  );
}


/* =========================================================
   RESIZE CHART
========================================================= */

let chartResizeTimer =
  null;


window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      chartResizeTimer
    );


    chartResizeTimer =
      setTimeout(
        () => {

          const growthView =
            $("growthView");


          if (
            growthView
              .classList
              .contains(
                "active"
              )
          ) {

            renderGrowthChart();

          }

        },
        100
      );

  }
);


/* =========================================================
   UTILITIES
========================================================= */

function optionalNumber(
  value
) {
  if (
    value === "" ||
    value == null
  ) {
    return null;
  }


  const number =
    Number(value);


  return Number.isFinite(
    number
  )
    ? number
    : null;
}


function formatNumber(
  value
) {
  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {
    return String(value);
  }


  return Number.isInteger(
    number
  )
    ? String(number)
    : number.toFixed(1);
}


function escapeHtml(
  value
) {
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


/* =========================================================
   SERVICE WORKER
========================================================= */

if (
  "serviceWorker" in
  navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator
        .serviceWorker
        .register("./sw.js")
        .catch(
          (error) => {

            console.error(
              "Service Worker 등록 실패:",
              error
            );

          }
        );

    }
  );

}


/* =========================================================
   START
========================================================= */

initializeApp();

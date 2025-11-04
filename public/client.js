// client.js (замініть існуючий файл на цей)

const socket = io();

// --- UI helpers ---
function createItemElement(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "item";
  wrapper.dataset.orderIndex = item.order_index ?? 0;

  wrapper.innerHTML = `
    <button class="drag-handle" type="button" aria-label="Drag to reorder">≡</button>

    <form action="/delete" method="post" class="delete-form">
      <input type="checkbox" name="deleteItemId" value="${item.id}">
    </form>

    <p id="title${item.id}">${escapeHtml(item.title)}</p>

    <form class="edit" action="/edit" method="post">
      <input type="hidden" name="updatedItemId" value="${item.id}">
      <input id="input${item.id}" type="text" name="updatedItemTitle"
             value="${escapeHtml(
               item.title
             )}" autocomplete="off" hidden="true" />
      <button id="done${item.id}" class="edit" type="submit" hidden>
        <img class="icon" src="/assets/icons/check-solid.svg" alt="tick image">
      </button>
    </form>

    <!-- важливо: повертаємо клас 'edit' щоб відповідало твоєму CSS -->
    <button id="edit${item.id}" class="edit" type="button" data-id="${
    item.id
  }" aria-label="Edit">
      <img class="icon" src="/assets/icons/pencil-solid.svg" alt="pencil image">
    </button>
  `;

  // Events: edit button
  const editBtn = wrapper.querySelector(`#edit${item.id}`);
  // прибираємо будь-який фокус-контуру на випадок:
  if (editBtn) {
    editBtn.style.outline = "none";
    editBtn.addEventListener("click", () => handler(item.id));
  }

  // Events: delete form (we prevent normal navigation and use fetch)
  const deleteForm = wrapper.querySelector(".delete-form");
  if (deleteForm) {
    deleteForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const params = new URLSearchParams();
      params.append("deleteItemId", item.id);
      fetch("/delete", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }).catch((err) => console.error("Delete error", err));
    });
  }

  // Events: edit form submission
  const editForm = wrapper.querySelector("form.edit");
  if (editForm) {
    editForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const titleInput = editForm.querySelector(
        `input[name="updatedItemTitle"]`
      );
      const idInput = editForm.querySelector(`input[name="updatedItemId"]`);
      const params = new URLSearchParams();
      params.append("updatedItemId", idInput.value);
      params.append("updatedItemTitle", titleInput.value);
      fetch("/edit", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }).catch((err) => console.error("Edit error", err));
    });
  }

  return wrapper;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Показати/приховати елементи редагування
// Заміни поточну handler(...) на цю версію
function handler(id) {
  const titleEl = document.getElementById("title" + id);
  const editBtn = document.getElementById("edit" + id);
  const doneBtn = document.getElementById("done" + id);
  const inputEl = document.getElementById("input" + id);

  // знайдемо батьківський елемент .item — щоб сховати чекбокс в ньому
  let itemEl = null;
  if (titleEl) itemEl = titleEl.closest(".item");
  if (!itemEl && inputEl) itemEl = inputEl.closest(".item");
  if (!itemEl && editBtn) itemEl = editBtn.closest(".item");

  // Ховаємо заголовок та кнопку олівця, показуємо кнопку "готово" і інпут
  if (titleEl) titleEl.setAttribute("hidden", "");
  if (editBtn) {
    editBtn.setAttribute("hidden", "");
    // переконатися, що немає видно фокусу (в деяких браузерах може лишитись)
    editBtn.blur && editBtn.blur();
  }
  if (doneBtn) doneBtn.removeAttribute("hidden");
  if (inputEl) {
    inputEl.removeAttribute("hidden");
    inputEl.focus();
    // Поставити курсор в кінець value
    const val = inputEl.value;
    inputEl.value = "";
    inputEl.value = val;
  }

  // Сховати чекбокс (галочку) під час редагування
  if (itemEl) {
    const checkbox = itemEl.querySelector('input[name="deleteItemId"]');
    if (checkbox) checkbox.setAttribute("hidden", "");
    // Якщо чекбокс був у формі (label/інші елементи) — можна сховати всю форму:
    const deleteForm = itemEl.querySelector("form.delete-form");
    if (deleteForm) deleteForm.setAttribute("hidden", "");
  }
}

// Закриває UI редагування для елемента id; оновлює текст заголовка якщо newTitle заданий
function closeEditUI(id, newTitle) {
  const titleEl = document.getElementById("title" + id);
  const editBtn = document.getElementById("edit" + id);
  const doneBtn = document.getElementById("done" + id);
  const inputEl = document.getElementById("input" + id);

  // Показати заголовок і оновити текст
  if (titleEl) {
    if (typeof newTitle === "string") titleEl.innerText = newTitle;
    titleEl.removeAttribute("hidden");
  }

  // Показати кнопку олівця
  if (editBtn) {
    editBtn.removeAttribute("hidden");
    editBtn.blur && editBtn.blur();
  }

  // Сховати кнопку "готово"
  if (doneBtn) {
    doneBtn.setAttribute("hidden", "");
  }

  // Сховати інпут редагування
  if (inputEl) {
    inputEl.setAttribute("hidden", "");
  }

  // Повернути видимість форми видалення / чекбоксу (якщо були сховані)
  const itemEl = titleEl ? titleEl.closest(".item") : null;
  if (itemEl) {
    const deleteForm = itemEl.querySelector("form.delete-form");
    if (deleteForm) deleteForm.removeAttribute("hidden");
    const checkbox = itemEl.querySelector('input[name="deleteItemId"]');
    if (checkbox) checkbox.removeAttribute("hidden");
  }
}

// --- Main partial update logic ---
function applyUpdates(newItems) {
  const container = document.getElementById("list");
  if (!container) return;

  // add form знаходиться в контейнері з класом 'add-item'
  const addForm = container.querySelector(".add-item");

  // Map існуючих елементів (без add-form)
  const existingEls = Array.from(container.querySelectorAll(".item")).filter(
    (el) => !el.classList.contains("add-item")
  );

  const existingMap = new Map();
  existingEls.forEach((el) => {
    // шукаємо id у прихованому полі форми (updatedItemId) або чекбоксі (deleteItemId)
    const idInput = el.querySelector(
      'input[name="updatedItemId"], input[name="deleteItemId"]'
    );
    if (idInput) {
      existingMap.set(String(idInput.value), el);
    }
  });

  // визначаємо, який елемент зараз у редагуванні — щоб не переписувати value
  const activeInput = container.querySelector(
    'input[type="text"]:not([hidden])'
  );
  const activeEditId = activeInput ? activeInput.id.replace("input", "") : null;
  const activeValue = activeInput ? activeInput.value : null;

  const newIds = new Set();

  // Проходимо нові елементи у порядку, в якому треба їх розташувати
  for (const item of newItems) {
    const id = String(item.id);
    newIds.add(id);
    let el = existingMap.get(id);

    if (el) {
      // Оновлюємо текст, orderIndex, значення інпутів тільки якщо не редагуємо зараз цей елемент
      const titleEl = el.querySelector("#title" + id);
      const inputEl = el.querySelector("#input" + id);
      if (titleEl && id !== activeEditId) titleEl.innerText = item.title;
      if (inputEl && id !== activeEditId) {
        inputEl.value = item.title;
        inputEl.setAttribute("value", item.title);
      }
      el.dataset.orderIndex = item.order_index ?? 0;
    } else {
      // Створюємо новий DOM-елемент
      el = createItemElement(item);
    }

    // Вставляємо перед формою додавання (щоб add form завжди був останнім)
    if (addForm) {
      container.insertBefore(el, addForm);
    } else {
      container.appendChild(el);
    }
  }

  // Видалити елементи, яких немає в newItems
  for (const [id, el] of existingMap.entries()) {
    if (!newIds.has(id)) {
      el.remove();
    }
  }

  // Якщо зараз редагується якийсь елемент — відновити його value/focus
  if (activeEditId && activeValue !== null) {
    const input = document.getElementById("input" + activeEditId);
    if (input) {
      input.value = activeValue;
      input.focus();
    }
  }
}

// --- Socket handler ---
socket.on("task_list_updated", (updatedItems) => {
  try {
    applyUpdates(updatedItems);
  } catch (err) {
    console.error("Apply updates error", err);
    // На випадок фейлу — як fallback можна перезавантажити сторінку, але тільки якщо потрібно:
    // window.location.reload();
  }
});

// --- Intercept form submissions to avoid page reloads ---
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("list");

  // Add form
  const addForm = container ? container.querySelector(".add-item") : null;
  if (addForm) {
    addForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const input = addForm.querySelector('input[name="newItem"]');
      if (!input) return;
      const val = input.value.trim();
      if (!val) return;
      const params = new URLSearchParams();
      params.append("newItem", val);
      fetch("/add", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      })
        .then(() => {
          input.value = "";
        })
        .catch((err) => console.error("Add error", err));
    });
  }

  // Делегуємо submit для форм edit / delete (щоб обробляти нові елементи теж)
  if (container) {
    container.addEventListener("submit", (ev) => {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;

      // delete-form
      if (form.classList.contains("delete-form")) {
        ev.preventDefault();
        const idInput = form.querySelector('input[name="deleteItemId"]');
        const id = idInput ? idInput.value : null;
        if (!id) return;
        const params = new URLSearchParams();
        params.append("deleteItemId", id);
        fetch("/delete", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }).catch((err) => console.error("Delete error", err));
      }

      // edit form
      // edit form
      if (form.classList.contains("edit")) {
        ev.preventDefault();
        const idInput = form.querySelector('input[name="updatedItemId"]');
        const titleInput = form.querySelector('input[name="updatedItemTitle"]');
        if (!idInput || !titleInput) return;

        const params = new URLSearchParams();
        params.append("updatedItemId", idInput.value);
        params.append("updatedItemTitle", titleInput.value);

        // Дезактивуємо інпут тимчасово, щоб уникнути дубль-запитів
        titleInput.disabled = true;

        fetch("/edit", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        })
          .then((response) => {
            if (!response.ok)
              throw new Error("Server returned " + response.status);
            // Успішно — закриваємо UI редагування локально одразу
            closeEditUI(idInput.value, titleInput.value);
            // Повертаємо інпут активним (на випадок, якщо сервер відповів але ми хочемо ще редагувати)
            titleInput.disabled = false;
          })
          .catch((err) => {
            console.error("Edit error", err);
            // у разі помилки — реенейблити інпут і не закривати UI
            titleInput.disabled = false;
            // опціонально: показати повідомлення користувачу
            // alert('Не вдалося зберегти зміни — спробуйте ще раз.');
          });
      }
    });
  }

  // Ініціалізуємо Sortable після DOMContentLoaded
  const listContainer = document.getElementById("list");
  if (listContainer) {
    new Sortable(listContainer, {
      animation: 150,
      handle: ".drag-handle",
      draggable: ".item",
      ghostClass: "sortable-ghost",
      onEnd: function (evt) {
        const itemEl = evt.item;
        // знаходимо id (у прихованому полі updatedItemId або чекбоксі)
        const idInput =
          itemEl.querySelector("input[name='updatedItemId']") ||
          itemEl.querySelector("input[name='deleteItemId']");
        const itemId = idInput ? idInput.value : null;

        // визначаємо сусідів (ігноруємо форму додавання в кінці)
        let prevEl = itemEl.previousElementSibling;
        while (prevEl && prevEl.classList.contains("add-item"))
          prevEl = prevEl.previousElementSibling;

        let nextEl = itemEl.nextElementSibling;
        while (nextEl && nextEl.classList.contains("add-item"))
          nextEl = nextEl.nextElementSibling;

        const prevIndex = prevEl ? parseFloat(prevEl.dataset.orderIndex) : null;
        const nextIndex = nextEl ? parseFloat(nextEl.dataset.orderIndex) : null;

        if (itemId) {
          updateItemOrder(itemId, prevIndex, nextIndex);
        }
      },
    });
  } else {
    console.warn("List container not found — Sortable not initialized.");
  }
});

// --- update-order via fetch (без reload) ---
function updateItemOrder(itemId, prevIndex, nextIndex) {
  fetch("/update-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: itemId, prevIndex, nextIndex }),
  })
    .then((response) => {
      if (!response.ok)
        throw new Error(
          "An error occured on the server while changing the order!"
        );
      // ніякого reload — сервер надішле оновлений список по сокету
    })
    .catch((error) => console.error("Error:", error));
}

/* === partial sync: створення елементу, часткове оновлення списку та обробник сокета === */

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createItemElement(item) {
  // Структура дуже близька до index.ejs — щоб вигляд і поведінка були ті самі.
  const wrapper = document.createElement("div");
  wrapper.className = "item";
  wrapper.dataset.orderIndex = item.order_index ?? 0;

  wrapper.innerHTML = `
    <button class="drag-handle" type="button" aria-label="Drag to reorder">≡</button>

    <form action="/delete" method="post" class="delete-form">
      <input type="checkbox" name="deleteItemId" value="${item.id}">
    </form>

    <p id="title${item.id}">${escapeHtml(item.title)}</p>

    <form class="edit" action="/edit" method="post">
      <input type="hidden" name="updatedItemId" value="${item.id}">
      <input id="input${item.id}" type="text" name="updatedItemTitle"
             value="${escapeHtml(
               item.title
             )}" autocomplete="off" hidden="true" />
      <button id="done${item.id}" class="edit" type="submit" hidden>
        <img class="icon" src="/assets/icons/check-solid.svg" alt="tick image">
      </button>
    </form>

    <button id="edit${item.id}" class="edit" type="button" data-id="${
    item.id
  }" aria-label="Edit">
      <img class="icon" src="/assets/icons/pencil-solid.svg" alt="pencil image">
    </button>
  `;

  // Підв'язуємо onclick до олівця (викликає вже наявну у тебе handler)
  const editBtn = wrapper.querySelector(`#edit${item.id}`);
  if (editBtn) {
    editBtn.addEventListener("click", () => handler(item.id));
    editBtn.style.outline = "none";
  }

  // Чекбокс: відтворюємо початкову поведінку onchange="this.form.submit()"
  const checkbox = wrapper.querySelector('input[name="deleteItemId"]');
  if (checkbox) {
    checkbox.addEventListener("change", () => {
      const form = checkbox.closest("form");
      if (form) form.submit(); // залишаємо сабміт через форму (щоб бекенд працював як зараз)
    });
  }

  // (Редагування робиться через форму — ми не міняємо її сабміт-логіку тут)
  return wrapper;
}

function applyUpdates(newItems) {
  const container = document.getElementById("list");
  if (!container) return;

  // Знаходимо форму додавання, щоб вставляти перед нею
  const addForm = container.querySelector(".add-item");

  // Отримуємо поточні елементи (ігноруємо add-item)
  const existingEls = Array.from(container.querySelectorAll(".item")).filter(
    (el) => !el.classList.contains("add-item")
  );

  const existingMap = new Map();
  existingEls.forEach((el) => {
    const idInput = el.querySelector(
      'input[name="updatedItemId"], input[name="deleteItemId"]'
    );
    if (idInput) existingMap.set(String(idInput.value), el);
  });

  // Збережемо активний інпут (якщо користувач зараз редагує) — щоб не затирати value/focus
  const activeInput = container.querySelector(
    'input[type="text"]:not([hidden])'
  );
  const activeEditId = activeInput ? activeInput.id.replace("input", "") : null;
  const activeValue = activeInput ? activeInput.value : null;

  const newIds = new Set();

  // Проходимо новий список у правильному порядку і оновлюємо/вставляємо елементи
  for (const item of newItems) {
    const id = String(item.id);
    newIds.add(id);
    let el = existingMap.get(id);

    if (el) {
      // Оновлюємо заголовок (тільки якщо зараз не редагуємо цей елемент)
      const titleEl = el.querySelector("#title" + id);
      const inputEl = el.querySelector("#input" + id);
      if (titleEl && id !== activeEditId) titleEl.innerText = item.title;
      if (inputEl && id !== activeEditId) {
        inputEl.value = item.title;
        inputEl.setAttribute("value", item.title);
      }
      el.dataset.orderIndex = item.order_index ?? 0;
    } else {
      // Створюємо новий DOM-елемент і вставляємо
      el = createItemElement(item);
    }

    // Вставляємо елемент у правильне місце (перед формою додавання, якщо вона є)
    if (addForm) {
      container.insertBefore(el, addForm);
    } else {
      container.appendChild(el);
    }
  }

  // Видаляємо елементи, що більше не входять у newItems
  for (const [id, el] of existingMap.entries()) {
    if (!newIds.has(id)) {
      el.remove();
    }
  }

  // Якщо користувач був у режимі редагування — відновимо фокус і текст (щоб не зіпсувати введення)
  if (activeEditId && activeValue !== null) {
    const input = document.getElementById("input" + activeEditId);
    if (input) {
      input.value = activeValue;
      input.focus();
    }
  }
}

// М'який обробник сокета — застосовує часткові оновлення,
// і лише якщо щось піде не так — робить fallback на reload (страховка).
socket.on("task_list_updated", (updatedItems) => {
  try {
    if (typeof applyUpdates === "function") {
      applyUpdates(updatedItems);
    } else {
      window.location.reload();
    }
  } catch (err) {
    console.error("Partial update failed, falling back to reload:", err);
    window.location.reload();
  }
});
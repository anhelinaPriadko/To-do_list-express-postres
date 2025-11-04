const socket = io();

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
  if (editBtn) {
    editBtn.style.outline = "none";
    editBtn.addEventListener("click", () => handler(item.id));
  }

  // Events: delete
  const checkbox = wrapper.querySelector('input[name="deleteItemId"]');
  if (checkbox) {
    checkbox.addEventListener("change", () => {
      const id = item.id;
      const params = new URLSearchParams();
      params.append("deleteItemId", id);
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
function handler(id) {
  const titleEl = document.getElementById("title" + id);
  const editBtn = document.getElementById("edit" + id);
  const doneBtn = document.getElementById("done" + id);
  const inputEl = document.getElementById("input" + id);

  let itemEl = null;
  if (titleEl) itemEl = titleEl.closest(".item");
  if (!itemEl && inputEl) itemEl = inputEl.closest(".item");
  if (!itemEl && editBtn) itemEl = editBtn.closest(".item");

  if (titleEl) titleEl.setAttribute("hidden", "");
  if (editBtn) {
    editBtn.setAttribute("hidden", "");
    editBtn.blur && editBtn.blur();
  }
  if (doneBtn) doneBtn.removeAttribute("hidden");
  if (inputEl) {
    inputEl.removeAttribute("hidden");
    inputEl.focus();
    const val = inputEl.value;
    inputEl.value = "";
    inputEl.value = val;
  }

  if (itemEl) {
    const checkbox = itemEl.querySelector('input[name="deleteItemId"]');
    if (checkbox) checkbox.setAttribute("hidden", "");
    const deleteForm = itemEl.querySelector("form.delete-form");
    if (deleteForm) deleteForm.setAttribute("hidden", "");
  }
}

function closeEditUI(id, newTitle) {
  const titleEl = document.getElementById("title" + id);
  const editBtn = document.getElementById("edit" + id);
  const doneBtn = document.getElementById("done" + id);
  const inputEl = document.getElementById("input" + id);

  if (titleEl) {
    if (typeof newTitle === "string") titleEl.innerText = newTitle;
    titleEl.removeAttribute("hidden");
  }

  if (editBtn) {
    editBtn.removeAttribute("hidden");
    editBtn.blur && editBtn.blur();
  }

  if (doneBtn) {
    doneBtn.setAttribute("hidden", "");
  }

  if (inputEl) {
    inputEl.setAttribute("hidden", "");
  }
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

  const addForm = container.querySelector(".add-item");

  const existingEls = Array.from(container.querySelectorAll(".item")).filter(
    (el) => !el.classList.contains("add-item")
  );

  const existingMap = new Map();
  existingEls.forEach((el) => {
    const idInput = el.querySelector(
      'input[name="updatedItemId"], input[name="deleteItemId"]'
    );
    if (idInput) {
      existingMap.set(String(idInput.value), el);
    }
  });

  const activeInput = container.querySelector(
    'input[type="text"]:not([hidden])'
  );
  const activeEditId = activeInput ? activeInput.id.replace("input", "") : null;
  const activeValue = activeInput ? activeInput.value : null;

  const newIds = new Set();

  for (const item of newItems) {
    const id = String(item.id);
    newIds.add(id);
    let el = existingMap.get(id);

    if (el) {
      const titleEl = el.querySelector("#title" + id);
      const inputEl = el.querySelector("#input" + id);
      if (titleEl && id !== activeEditId) titleEl.innerText = item.title;
      if (inputEl && id !== activeEditId) {
        inputEl.value = item.title;
        inputEl.setAttribute("value", item.title);
      }
      el.dataset.orderIndex = item.order_index ?? 0;
    } else {
      el = createItemElement(item);
    }

    if (addForm) {
      container.insertBefore(el, addForm);
    } else {
      container.appendChild(el);
    }
  }

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
      input.value = "";
      const params = new URLSearchParams();
      params.append("newItem", val);
      fetch("/add", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      })
        .then(() => {})
        .catch((err) => console.error("Add error", err));
    });
  }

  if (container) {
    container.addEventListener("submit", (ev) => {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.classList.contains("edit")) {
        ev.preventDefault();
        const idInput = form.querySelector('input[name="updatedItemId"]');
        const titleInput = form.querySelector('input[name="updatedItemTitle"]');
        if (!idInput || !titleInput) return;

        const params = new URLSearchParams();
        params.append("updatedItemId", idInput.value);
        params.append("updatedItemTitle", titleInput.value);

        titleInput.disabled = true;

        fetch("/edit", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        })
          .then((response) => {
            if (!response.ok)
              throw new Error("Server returned " + response.status);
            closeEditUI(idInput.value, titleInput.value);
            titleInput.disabled = false;
          })
          .catch((err) => {
            console.error("Edit error", err);
            titleInput.disabled = false;
          });
      }
    });

    container.addEventListener("change", (ev) => {
      const checkbox = ev.target;
      if (
        checkbox instanceof HTMLInputElement &&
        checkbox.name === "deleteItemId" &&
        checkbox.checked
      ) {
        const id = checkbox.value;
        const params = new URLSearchParams();
        params.append("deleteItemId", id);
        fetch("/delete", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }).catch((err) => console.error("Delete error", err));
      }
    });
  }

  const listContainer = document.getElementById("list");
  if (listContainer) {
    new Sortable(listContainer, {
      animation: 150,
      handle: ".drag-handle",
      draggable: ".item",
      ghostClass: "sortable-ghost",
      onEnd: function (evt) {
        const itemEl = evt.item;
        const idInput =
          itemEl.querySelector("input[name='updatedItemId']") ||
          itemEl.querySelector("input[name='deleteItemId']");
        const itemId = idInput ? idInput.value : null;

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

  try {
    $("#newItemInput").autocomplete({
      minLength: 3,
      delay: 300,
      source: function (request, response) {
        $.ajax({
          url: "/search-items",
          dataType: "json",
          data: {
            term: request.term,
          },
          success: function (data) {
            response(data);
          },
          error: function (xhr, status, error) {
            console.error("Autocomplete search failed:", status, error);
            response([]);
          },
        });
      },
      select: function (event, ui) {
        console.log("Selected: " + ui.item.label);
      },
    });
  } catch (error) {
    console.error("Error initializing Autocomplete:", error);
  }
});

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
    })
    .catch((error) => console.error("Error:", error));
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

    <button id="edit${item.id}" class="edit" type="button" data-id="${
    item.id
  }" aria-label="Edit">
      <img class="icon" src="/assets/icons/pencil-solid.svg" alt="pencil image">
    </button>
  `;

  const editBtn = wrapper.querySelector(`#edit${item.id}`);
  if (editBtn) {
    editBtn.addEventListener("click", () => handler(item.id));
    editBtn.style.outline = "none";
  }
  return wrapper;
}

function applyUpdates(newItems) {
  const container = document.getElementById("list");
  if (!container) return;

  const addForm = container.querySelector(".add-item");

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

  const activeInput = container.querySelector(
    'input[type="text"]:not([hidden])'
  );
  const activeEditId = activeInput ? activeInput.id.replace("input", "") : null;
  const activeValue = activeInput ? activeInput.value : null;

  const newIds = new Set();

  for (const item of newItems) {
    const id = String(item.id);
    newIds.add(id);
    let el = existingMap.get(id);

    if (el) {
      const titleEl = el.querySelector("#title" + id);
      const inputEl = el.querySelector("#input" + id);
      if (titleEl && id !== activeEditId) titleEl.innerText = item.title;
      if (inputEl && id !== activeEditId) {
        inputEl.value = item.title;
        inputEl.setAttribute("value", item.title);
      }
      el.dataset.orderIndex = item.order_index ?? 0;
    } else {
      el = createItemElement(item);
    }

    if (addForm) {
      container.insertBefore(el, addForm);
    } else {
      container.appendChild(el);
    }
  }

  for (const [id, el] of existingMap.entries()) {
    if (!newIds.has(id)) {
      el.remove();
    }
  }

  if (activeEditId && activeValue !== null) {
    const input = document.getElementById("input" + activeEditId);
    if (input) {
      input.value = activeValue;
      input.focus();
    }
  }
}

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

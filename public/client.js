const socket = io(); // Ініціалізація з'єднання WebSocket (socket.io.js має бути підключений)

// Функція для оновлення DOM: приймає новий список і перемальовує його
function redrawTaskList(newItems) {
    const container = document.getElementById("task-list-container");
    if (!container) return;
    
    // Спрощена логіка: повна перезабудова DOM на основі отриманих даних.
    // У реальному проекті використовують diffing, але для EJS-структури це найпростіше.

    let newHtml = '';
    
    // Тут потрібно відтворити EJS-цикл, але на чистому JS
    newItems.forEach(item => {
        newHtml += `
            <div class="item" data-order-index="${item.order_index}">
              <form action="/delete" method="post">
                <input type="checkbox" onchange="this.form.submit()" name="deleteItemId" value="${item.id}">
              </form>
              <p id="title${item.id}">${item.title}</p>
              
              <button id="edit${item.id}" class="edit" onclick="handler('${item.id}')">
                <img class="icon" src="/assets/icons/pencil-solid.svg" alt="pencil image">
              </button>
            </div>
        `;
    });
    
    // Оновлюємо вміст контейнера (виключаючи форму додавання!)
    // Якщо форма додавання не є частиною контейнера, це просто:
    // container.innerHTML = newHtml;

    // Якщо контейнер включає форму додавання, потрібно бути обережним:
    // Найпростіше - перезавантажити сторінку, якщо повне перемальовування складно:
    // window.location.reload(); 
    
    // Якщо ви хочете уникнути перезавантаження, вам потрібно зберегти форму додавання
    // та оновити лише список завдань.
}


// Обробник події, що надходить із сервера
socket.on("task_list_updated", (updatedItems) => {
    console.log("Отримано оновлення списку через WebSocket. Синхронізація...");
    // Найпростіший спосіб: перезавантажити сторінку для відображення нових EJS-даних
    window.location.reload(); 

    // АБО: Використовувати функцію redrawTaskList(updatedItems)
    // redrawTaskList(updatedItems);
});

function handler(id) {
  const titleEl = document.getElementById("title" + id);
  const editBtn = document.getElementById("edit" + id);
  const doneBtn = document.getElementById("done" + id);
  const inputEl = document.getElementById("input" + id);

  if (titleEl) titleEl.setAttribute("hidden", "");
  if (editBtn) editBtn.setAttribute("hidden", "");
  if (doneBtn) doneBtn.removeAttribute("hidden");
  if (inputEl) {
    inputEl.removeAttribute("hidden");
    inputEl.focus();
    // Поставити курсор в кінець value
    const val = inputEl.value;
    inputEl.value = '';
    inputEl.value = val;
  }
}

function updateItemOrder(itemId, prevIndex, nextIndex) {
  fetch('/update-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, prevIndex: prevIndex, nextIndex: nextIndex }),
  })
  .then(response => {
      if (!response.ok) throw new Error('An error occured on the server while changing the order!');
      console.log('The order was updated successfully!');
  })
  .catch(error => console.error('Error:', error));
}

document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById("list");
    console.log('DOM ready, listContainer =', listContainer);

    if (listContainer) {
      new Sortable(listContainer, {
        animation: 150,
        handle: '.drag-handle',    // Ось — ручка перетягування
        draggable: '.item',        // Перетягуємо елементи з класом .item
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
          const itemEl = evt.item;
          const idInput = itemEl.querySelector("input[name='updatedItemId']") || itemEl.querySelector("input[name='deleteItemId']");
          const itemId = idInput ? idInput.value : null;

          const prevEl = itemEl.previousElementSibling;
          const nextEl = itemEl.nextElementSibling;
          const prevIndex = prevEl ? parseFloat(prevEl.dataset.orderIndex) : null;
          const nextIndex = nextEl ? parseFloat(nextEl.dataset.orderIndex) : null;

          console.log('Drag end for item', itemId, 'prevIndex', prevIndex, 'nextIndex', nextIndex);

          if (itemId) updateItemOrder(itemId, prevIndex, nextIndex);
        },
      });
    } else {
      console.warn('List container not found — Sortable not initialized.');
    }
});
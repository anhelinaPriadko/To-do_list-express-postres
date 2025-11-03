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

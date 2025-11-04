import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import pg from "pg";
import { validationResult, checkSchema } from "express-validator";
import { dbConfig } from "./config/dataBaseConfig.js";
import {
  titleAddValidationSchema,
  titleUpdateValidationSchema,
} from "./utilities/validationSchema.mjs";
import {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from "./config/chatBotConfiguration.js";
import { getCache, setCache } from "./utilities/cache.js";

const app = express();
const port = 3000;

const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let db = new pg.Client(dbConfig);
db.connect();

async function getItems() {
  let items = [];
  try {
    const result = await db.query(
      "SELECT * FROM items ORDER BY order_index ASC, id ASC"
    );
    items = result.rows;
  } catch (error) {
    console.log(error);
  }
  return items;
}

async function addItem(title) {
  try {
    const maxOrderResult = await db.query("SELECT MAX(order_index) FROM items");
    const newOrderIndex = (maxOrderResult.rows[0].max || 0) + 1000;
    await db.query("INSERT INTO items (title, order_index) VALUES ($1, $2)", [
      title,
      newOrderIndex,
    ]);
  } catch (error) {
    console.log(error);
  }
}

async function getItem(itemId) {
  let item;
  try {
    const result = await db.query("select * from items where id = $1", [
      itemId,
    ]);
    item = result.rows[0];
  } catch (error) {
    console.log(error);
  }

  return item;
}

async function updateItem(itemId, itemTitle) {
  try {
    await db.query("update items set title = $1 where id = $2", [
      itemTitle,
      itemId,
    ]);
  } catch (error) {
    console.log(error);
  }
}

async function deleteItem(itemId) {
  try {
    await db.query("DELETE FROM items WHERE id = $1", [itemId]);
  } catch (error) {
    console.log(error);
  }
}

/**
 * @param {number | null} prevIndex - Індекс попереднього елемента.
 * @param {number | null} nextIndex - Індекс наступного елемента.
 * @returns {number}
 */
function calculateNewIndex(prevIndex, nextIndex) {
  if (prevIndex === null) {
    return nextIndex / 2;
  }
  if (nextIndex === null) {
    return prevIndex + 1000;
  }
  return (prevIndex + nextIndex) / 2;
}

/**
 * @param {number} itemId - ID елемента, який перетягнули.
 * @param {number | null} prevIndex - Індекс його попереднього сусіда.
 * @param {number | null} nextIndex - Індекс його наступного сусіда.
 */
async function updateItemOrder(itemId, prevIndex, nextIndex) {
  try {
    const newOrder = calculateNewIndex(prevIndex, nextIndex);
    await db.query("UPDATE items SET order_index = $1 WHERE id = $2", [
      newOrder,
      itemId,
    ]);
  } catch (error) {
    console.log(error);
  }
}

async function searchItems(term) {
  let items = [];
  const TARGET_TABLE = "autocomplete_data";
  const searchTerm = `%${term}%`;
  try {
    const result = await db.query(
      `SELECT title FROM ${TARGET_TABLE} WHERE title ILIKE $1 LIMIT 6`,
      [searchTerm]
    );
    items = result.rows.map((row) => ({
      label: row.title,
      value: row.title,
    }));
  } catch (error) {
    console.log(error);
  }
  return items;
}

/**
 * @param {string} text - Текст повідомлення.
 */
async function sendTelegramNotification(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("Помилка: Не налаштовано TELEGRAM_BOT_TOKEN або CHAT_ID.");
    return;
  }

  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Помилка Telegram API: ${response.status} - ${errorText}`);
    } else {
      console.log("Сповіщення Telegram успішно надіслано.");
    }
  } catch (error) {
    console.error("Помилка при відправці сповіщення в Telegram:", error);
  }
}

async function formTelegramMessage(){
  const updatedItems = await getItems();
    const tasksListString = updatedItems
      .map((item) => {
        return `- *${item.title}*`;
      })
      .join("\n");
  const message = `🔔 *Твої завдання оновлено!* \n\n${tasksListString}`;
  return message;
}

io.on("connection", (socket) => {
  console.log("Новий користувач підключився до Socket.IO");

  socket.on("disconnect", () => {
    console.log("Користувач відключився");
  });
});

app.get("/search-items", async (req, res) => {
    const searchTerm = req.query.term;

    if (!searchTerm || searchTerm.length < 3) {
        return res.json([]);
    }
    const cacheKey = `autocomplete:${searchTerm.toLowerCase()}`;
    const cachedResults = getCache(cacheKey);

    if (cachedResults) {
        return res.json(cachedResults);
    }
    const results = await searchItems(searchTerm);
    setCache(cacheKey, results, 60 * 1000); 
    
    res.json(results);
});

app.get("/", async (req, res) => {
  let items = await getItems();
  res.render("index.ejs", {
    listTitle: "Today",
    listItems: items,
  });
});

app.post("/add", checkSchema(titleAddValidationSchema), async (req, res) => {
  const errors = validationResult(req);
  const newItemTitle = req.body.newItem;
  if (!errors.isEmpty()) {
    console.log(errors.array());
  } else {
    await addItem(newItemTitle);
    const updatedItems = await getItems();
    io.emit("task_list_updated", updatedItems);
    const message = await formTelegramMessage();
    await sendTelegramNotification(message);
  }
  res.redirect("/");
});

app.post(
  "/edit",
  checkSchema(titleUpdateValidationSchema),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors.array());
    } else {
      let item = await getItem(req.body.updatedItemId);
      if (item) {
        await updateItem(req.body.updatedItemId, req.body.updatedItemTitle);
        let updatedItems = await getItems();
        io.emit("task_list_updated", updatedItems);
        const message = await formTelegramMessage();
        await sendTelegramNotification(message);
      }
    }
    res.redirect("/");
  }
);

app.post("/delete", async (req, res) => {
  if (req.body.deleteItemId) {
    await deleteItem(req.body.deleteItemId);
    let updatedItems = await getItems();
    io.emit("task_list_updated", updatedItems);
    const message = await formTelegramMessage();
    await sendTelegramNotification(message);
    return res.sendStatus(200);
  }
  res.sendStatus(400);
});

app.post("/update-order", async (req, res) => {
  const { id, prevIndex, nextIndex } = req.body;
  const pIndex =
    prevIndex !== undefined && prevIndex !== null
      ? parseFloat(prevIndex)
      : null;
  const nIndex =
    nextIndex !== undefined && nextIndex !== null
      ? parseFloat(nextIndex)
      : null;
  if (id) {
    await updateItemOrder(id, pIndex, nIndex);
    let updatedItems = await getItems();
    io.emit("task_list_updated", updatedItems);
    const message = await formTelegramMessage();
    await sendTelegramNotification(message);
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

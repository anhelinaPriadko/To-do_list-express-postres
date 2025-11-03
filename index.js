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

io.on("connection", (socket) => {
  console.log("Новий користувач підключився до Socket.IO");

  // Ви можете тут додати логіку для відключення або інших подій

  socket.on("disconnect", () => {
    console.log("Користувач відключився");
  });
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
  if (!errors.isEmpty()) {
    console.log(errors.array());
  } else {
    await addItem(req.body.newItem);
    let updatedItems = await getItems();
    io.emit("task_list_updated", updatedItems);
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
  }
  res.redirect("/");
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
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

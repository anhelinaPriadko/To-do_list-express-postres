import pg from "pg";
import { dbConfig } from "./config/dataBaseConfig.js";
import { faker } from "@faker-js/faker"; 

const db = new pg.Client(dbConfig);


const NUM_ITEMS_TO_GENERATE = 100000;
const TARGET_TABLE = "autocomplete_data";

/**
 * @returns {string}
 */
function generateRandomTaskTitle() {
  const options = [
    `Buy ${faker.commerce.product()}`,
    `Book ${faker.location.city()}`,
    `Check email from ${faker.person.fullName()}`,
    `Explore ${faker.hacker.verb()} ${faker.hacker.noun()}`,
    `Read article about ${faker.lorem.word()}`,
    `Pay the bill for ${faker.word.verb()} послуги`,
    `Make a presenrtation about ${faker.company.name()}`,
    `Watch a video about ${faker.music.genre()} музику`,
    `Meet ${faker.person.firstName()}`,
    `Call ${faker.person.firstName()}`,
    `Visit ${faker.location.city()}`,
    `Cook ${faker.food.dish()} for dinner`,
    `Listen to ${faker.music.artist()}'s new song`,
    `Walk ${faker.animal.dog()}`,
    `Visit ${faker.location.city()}`,
    `Learn ${faker.location.language().name}`,
    `Fly to the ${faker.airline.airport().name}`, 
    `Drive ${faker.vehicle.vehicle()}`,
    `Buy ${faker.commerce.product()}`
  ];
  return faker.helpers.arrayElement(options);
}

async function seedDatabase() {
  try {
    console.log("Підключення до бази даних...");
    await db.connect();
    console.log("Підключено.");

    console.log(`Очищення таблиці '${TARGET_TABLE}'...`);
    await db.query(`TRUNCATE ${TARGET_TABLE} RESTART IDENTITY;`); 

    console.log(`Генерація та вставка ${NUM_ITEMS_TO_GENERATE} елементів...`);

    const itemsToInsert = [];
    
    for (let i = 0; i < NUM_ITEMS_TO_GENERATE; i++) {
      const title = generateRandomTaskTitle();
      itemsToInsert.push(`('${title.replace(/'/g, "''")}')`); 
    }

    const queryText = `
      INSERT INTO ${TARGET_TABLE} (title) 
      VALUES ${itemsToInsert.join(",")}
      ON CONFLICT (title) DO NOTHING;
    `;

    await db.query(queryText);

    console.log(`Успішно додано нові елементи у ${TARGET_TABLE}!`);

  } catch (error) {
    console.error("Помилка при заповненні бази даних:", error);
  } finally {
    await db.end();
    console.log("З'єднання з базою даних закрито.");
  }
}

seedDatabase();
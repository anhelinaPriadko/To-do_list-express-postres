// utilities/cache.js

// Об'єкт Map для зберігання кешу: ключем буде термін пошуку, значенням - { data, expiry }
const cacheStore = new Map();

// Час життя кешу у мілісекундах (наприклад, 60 секунд)
const DEFAULT_TTL = 60 * 1000; 

/**
 * Отримує дані з кешу за ключем.
 * @param {string} key - Ключ кешу (наприклад, термін пошуку).
 * @returns {any | null} Збережені дані або null, якщо кеш прострочений/відсутній.
 */
export function getCache(key) {
    const entry = cacheStore.get(key);

    if (!entry) {
        return null;
    }

    // Перевірка, чи не закінчився час життя (TTL)
    if (Date.now() > entry.expiry) {
        console.log(`Cache expired for key: ${key}`);
        cacheStore.delete(key); // Видаляємо прострочений кеш
        return null;
    }

    console.log(`Cache hit for key: ${key}`);
    return entry.data;
}

/**
 * Зберігає дані в кеші з певним TTL.
 * @param {string} key - Ключ кешу.
 * @param {any} data - Дані для зберігання.
 * @param {number} [ttl=DEFAULT_TTL] - Час життя у мілісекундах.
 */
export function setCache(key, data, ttl = DEFAULT_TTL) {
    const expiry = Date.now() + ttl;
    cacheStore.set(key, { data, expiry });
    console.log(`Cache set for key: ${key}, expires in ${ttl / 1000}s`);
}
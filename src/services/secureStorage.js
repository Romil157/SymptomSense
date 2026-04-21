const DB_NAME = 'symptomsense-secure-storage';
const STORE_NAME = 'crypto-keys';
const MASTER_KEY_ID = 'master-key';
const STORAGE_PREFIX = 'symptomsense.secure.';

function ensureSecureApis() {
  if (!window.crypto?.subtle || !window.indexedDB) {
    throw new Error('Web Crypto and IndexedDB are required for secure storage.');
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredKey() {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    return await requestToPromise(transaction.objectStore(STORE_NAME).get(MASTER_KEY_ID));
  } finally {
    database.close();
  }
}

async function storeKey(key) {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE_NAME).put(key, MASTER_KEY_ID));
  } finally {
    database.close();
  }
}

async function getMasterKey() {
  ensureSecureApis();

  const existingKey = await getStoredKey();
  if (existingKey) {
    return existingKey;
  }

  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  await storeKey(key);
  return key;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function base64ToBytes(encoded) {
  const binary = window.atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encrypt(payload) {
  const key = await getMasterKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedPayload = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedPayload
  );

  return JSON.stringify({
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedPayload)),
  });
}

async function decrypt(serialized) {
  const payload = JSON.parse(serialized);
  const key = await getMasterKey();
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext)
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

export const secureStorage = Object.freeze({
  async getItem(key) {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!value) {
      return null;
    }

    return decrypt(value);
  },

  async setItem(key, value) {
    const encryptedPayload = await encrypt(value);
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, encryptedPayload);
  },

  async removeItem(key) {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  },
});

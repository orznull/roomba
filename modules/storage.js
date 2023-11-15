// small dumb module for persistent storage.
import fs from 'node:fs';

let store = {};
export const initStorage = () => {
  store = fs.readFileSync(process.env.STORAGE_FILE_PATH);
}

export const getVal = (key, defaultVal) => {
  if (store[key]) {
    return store[key];
  }
  setVal(key, defaultVal);
  return defaultVal
}

export const setVal = (key, val) => {
  store[key] = val;
  fs.writeFileSync(process.env.STORAGE_FILE_PATH, JSON.stringify(store));
}
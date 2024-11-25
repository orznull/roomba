import 'dotenv/config';
export function logWithTitle(title, ...args) {
  if (process.env.SHOW_LOGS)
    console.log(`[${title}]`, ...args)
}

export function log(...args) {
  logWithTitle("roomba", ...args);
}
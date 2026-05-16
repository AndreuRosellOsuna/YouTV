export const log = {
  info:  (msg, data) => console.log( `[YouTV] INFO  ${msg}`, data ?? ''),
  warn:  (msg, data) => console.warn( `[YouTV] WARN  ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[YouTV] ERROR ${msg}`, data ?? ''),
};

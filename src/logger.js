export function log(level, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, ...data };
  const fn = level === 'error' ? console.error : console.log;
  fn(JSON.stringify(entry));
}

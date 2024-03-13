export const SUCCESS = new Set([
  'job-completed',
]);

export const FAIL = new Set([
  'job-failed',
  'job-deduped',
  'job-timedout', // Custom Swodlr status
]);

export const WAITING = new Set([
  'job-queued',
  'job-started',
  'job-offline',
]);

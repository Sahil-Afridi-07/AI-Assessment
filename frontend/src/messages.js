// Same wording as the backend (services/messages.js) so frontend and API validation read identically.
export const MSG = {
  NO_SUBJECT: 'Please select at least one subject before generating your assessment.',
  NO_TOPIC: 'Please select at least one topic or enter a valid custom subtopic.',
  BAD_COUNT: 'Please enter a valid number of questions.',
  BAD_CUSTOM: 'Your input could not be understood. Please enter a relevant academic subject or topic.',
  AI_FAILURE: 'We are unable to generate your assessment right now. Please try again later.',
  NO_QUESTIONS: 'No valid questions were generated for your selected topics. Please modify your selection and try again.',
};
export const MAX_QUESTIONS = 30;
export const SECONDS = { easy: 60, medium: 90, hard: 120 };

export const fmtDuration = (sec) => {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60); const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m ? `${m}m ${s ? `${s}s` : ''}`.trim() : `${s}s`;
};
export const fmtClock = (sec) => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
};
export const STATUS_LABEL = { submitted: 'Submitted', auto_submitted: 'Auto-submitted (time up)', in_progress: 'In progress' };

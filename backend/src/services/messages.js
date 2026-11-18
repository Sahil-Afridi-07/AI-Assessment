// User-facing messages (kept in one place so API and UI wording stay identical).
module.exports = {
  NO_SUBJECT: 'Please select at least one subject before generating your assessment.',
  NO_TOPIC: 'Please select at least one topic or enter a valid custom subtopic.',
  BAD_COUNT: 'Please enter a valid number of questions.',
  BAD_CUSTOM: 'Your input could not be understood. Please enter a relevant academic subject or topic.',
  AI_FAILURE: 'We are unable to generate your assessment right now. Please try again later.',
  NO_QUESTIONS: 'No valid questions were generated for your selected topics. Please modify your selection and try again.',
  RATE_LIMIT: 'You are generating assessments too quickly. Please wait a few minutes and try again.',
  invalidTopic: (subject) =>
    `Invalid Topic! The entered topic does not appear to be related to ${subject}. Please enter a valid ${subject} topic or select another subject.`,
};

const ClassBatch = require('../models/ClassBatch');
const JobRole = require('../models/JobRole');

// Can this user take (view without answers) the given test?
async function canTakeTest(user, test) {
  if (user.role !== 'student') return false;
  if (test.kind === 'practice') return String(test.createdBy) === String(user._id);
  if (!test.isPublished) return false;
  if (test.kind === 'class') {
    return !!(await ClassBatch.exists({ studentIds: user._id, testIds: test._id }));
  }
  if (test.kind === 'screening') {
    return !!(await JobRole.exists({ invitedEmails: user.email, testIds: test._id }));
  }
  return false;
}

const isOwner = (user, test) => String(test.createdBy) === String(user._id);

module.exports = { canTakeTest, isOwner };

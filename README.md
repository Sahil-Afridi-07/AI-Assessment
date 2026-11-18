# AI-Powered Multi-Role MCQ Assessment Platform

MERN mini project — **Sahil Afridi**, MCA Sem 3, AMU Aligarh (Supervisor: Dr. Faisal Anwar)

Three roles share one **Test → Question → Attempt** engine:

| Role | What they can do |
|---|---|
| **Student** | Five-page panel: **Dashboard**, **Performance** (charts + AI analysis), **Practice** (multi-subject / mixed-topic AI tests with custom subtopics), **Reports** (filters + PDF), **Settings**. Timed, server-controlled exams with autosave. Also takes tests assigned by teachers/companies |
| **Teacher** | Create tests with AI-generated and/or manual questions, publish them, create classes, add students, assign tests, view class analytics |
| **Company** | Create job-role screening tests (AI and/or manual), invite candidates by email, view a ranked results table |

**Scoring is deterministic** — the backend compares each answer with `correctOption`. AI is used only to generate questions and to write the feedback text; a failed AI call never breaks a submission (feedback falls back to a rule-based summary).

## Student panel v2 (what changed)
- **Practice**: pick one or more subjects (19 subjects in 5 categories), topics, optional custom subtopics, difficulty (Easy / Medium / Hard / Mixed), 5-30 questions, optional per-subject counts. Each subject is generated in its own AI call.
- **Time limits**: easy 1 min, medium 1.5 min, hard 2 min per question; total = sum over the generated questions. The deadline is stored on the server; refreshing never resets it; late autosave/submit is rejected and the attempt is closed with the answers saved before the deadline.
- **Exam UI**: navigator, mark for review, autosave, confirm-before-submit, shuffled questions and options (mapping stored server-side), no correct answers sent until after submission.
- **Validation (4 layers)**: frontend checks -> backend structure checks -> subject/topic catalog match (+ off-topic blocklist, + "belongs to another subject") -> AI relevance check for what the catalog cannot decide (fails closed) -> schema validation of generated questions (4 distinct options, one correct index, topic must be one requested, no duplicates, no "all of the above").
- **Reports**: filterable history, per-attempt report with explanations, PDF download (server-side, pdfkit).
- **Settings**: profile, change password (invalidates old tokens), notification preferences (stored only - no emails are sent), delete account.

## Run it

Prerequisites: Node 18+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
# 1. Backend
cd backend
cp .env.example .env        # set JWT_SECRET (and MONGO_URI if not local)
npm install
npm start                   # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### AI provider
- `AI_PROVIDER=mock` (default) works with no key. It returns **generic placeholder questions** so you can demo the whole flow offline.
- `AI_PROVIDER=gemini` + `GEMINI_API_KEY=...` (free key from Google AI Studio) gives real questions. Model is set by `GEMINI_MODEL`. LLM output is validated (4 distinct options, one correct index 0–3, no duplicates); malformed items are dropped and generation is retried once.

## Tests
```bash
cd backend
npm test                    # 43 unit tests: scoring, allocation, timing, shuffle mapping, validation, Gemini failure modes (stubbed), stats
npm start                   # then in another terminal:
node scripts/smoke.mjs      # end-to-end API checks (v1): roles/RBAC, scoring, assignment, ranking
node scripts/smoke2.mjs     # end-to-end API checks (student v2): validation, mixed tests, timer/refresh, tampering, reports, PDF, account
# add MONGO_URI=... to smoke2 to also test deadline expiry / auto-submit
```

## Structure
```
backend/src
  models/       User, Test, Question, Attempt, ClassBatch, JobRole
  middleware/   auth.js (JWT + requireRole), error.js
  services/     aiService.js, scoring.js, analytics.js, validateQuestions.js, access.js
  routes/       auth, ai, tests, attempts, classes, jobroles
frontend/src
  pages/        Login, StudentHome, TakeTest, Result, TeacherHome, ClassDetail, CompanyHome, JobRoleDetail
  components/   TestBuilder, TestsPanel, Layout, ui
```

## API summary
| Method & path | Role | Purpose |
|---|---|---|
| POST `/api/auth/register`, `/login`; GET `/me` | any | JWT auth |
| GET `/api/practice/catalog`; POST `/api/practice/generate` | student | Catalog; multi-subject AI assessment |
| POST `/api/attempts/start`; GET `/:id/session`; PUT `/:id/answers`; POST `/:id/submit` | student | Timed attempt lifecycle |
| GET `/api/student/dashboard`, `/performance`; POST `/performance/analysis` | student | Summaries, analytics, AI analysis |
| GET `/api/student/reports` (+ `/:id/pdf`) | student | Filterable history, PDF |
| GET/PATCH `/api/account/profile`, POST `/password`, PATCH `/preferences`, DELETE `/api/account` | any (delete: student) | Settings |
| POST `/api/tests/practice` | student | Legacy single-topic practice (kept for compatibility) |
| POST `/api/ai/questions` | teacher, company | Preview AI questions |
| POST `/api/tests`; PATCH `/:id/publish`; DELETE `/:id` | teacher, company | Create / publish / delete test |
| GET `/api/tests/mine`, `/assigned`, `/:id` | varies | Lists; test fetch hides answers from students |
| POST `/api/attempts`; GET `/mine`, `/:id` | student (+ test owner for `/:id`) | Submit, history, review |
| `/api/classes` (+ `/:id/students`, `/assign`, `/analytics`) | teacher | Classes |
| `/api/jobroles` (+ `/:id/invite`, `/tests`, `/results`) | company | Job roles and ranking |

## Design decisions
- **Answers never reach the taker before submit** — `GET /tests/:id` strips `correctOption` for students.
- **Class/screening tests are one attempt per student**; practice tests are unlimited.
- **Company invites by email.** Candidates register as a Student with that email and see the screening test under "Assigned to me".
- Passwords are hashed with bcrypt; every protected route checks the JWT and the role.

## Known limitations (good to mention in your viva)
- No anti-cheating (tab switching, etc.), no email delivery (invites, notifications), no password reset by email.
- Average time per question is client-reported (clamped on the server), so treat it as an estimate.
- Subject/difficulty analytics only include attempts taken after the v2 upgrade; older attempts appear in topic stats only.
- Teacher/company tests stay untimed (duration 0).
- Mock AI questions are generic; use Gemini for real content.

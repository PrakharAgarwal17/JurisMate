# JurisMate — AI Junior Associate

JurisMate is a work-in-progress legal workspace for advocates. The project aims to bring people and AI agents together around a legal matter: discuss a case in Discord or Slack through Switch, organize matter-related material on a website, and prepare research and drafts for an advocate to review.

**Advocates remain responsible for checking facts, sources, deadlines, and every final decision.** AI-generated material is a starting point for review, not a substitute for professional judgment.

## Use case

An advocate working on an agreement or dispute can use a dedicated chat to discuss the matter with collaborators and an AI assistant. In the planned workflow, the team can:

1. Describe the client's problem and identify missing facts and documents.
2. Upload agreements, PDFs, and images to a matter-specific storage area.
3. Ask agents to help organize evidence, prepare a timeline, research relevant Indian law, identify risks, and draft an initial response.
4. Review the supporting information and edit, accept, or reject the proposed work.
5. Revisit stored documents, important notes, conversations, and approved work later.

The website is intended to be the matter workspace for storage, collaboration, and a future courtroom simulation. Switch is intended to coordinate agents in the team's chat platform.

## Project status

The backend is in development. The frontend is currently the default Vite starter, not the finished JurisMate interface. Features below are separated by their current implementation status.

### Available backend components

- **Authentication:** email/password signup with email OTP, bcrypt password hashing, access and refresh tokens in HTTP-only cookies, and Google OAuth account linking. OTP state is held in server memory and expires after five minutes.
- **Profile image:** an authenticated upload route stores the image using Cloudinary.
- **Switch integration:** a registered JurisMate agent can connect to Switch through a WebSocket listener. It receives addressed messages, sends their text to Gemini, and posts the response to the Switch room. Switch must have the agent in the room and a messaging platform connected for external chat delivery.
- **Room mapping:** authenticated users can create, list, and disconnect website records associated with Switch room IDs. Creating a mapping currently does not verify the user's ownership or membership of that Switch room.
- **Storage APIs:** upload PDFs and supported images to Cloudinary, list stored items, create signed download links, and save important notes under a room record.
- **Document processing:** extract PDF text, attempt OCR on up to five pages without extracted text, and analyze supported images with Gemini. Large extracted text can be truncated.
- **Highlights:** store a selected quote, optional page number, and note as metadata for a stored file. This does not modify the original PDF or image.
- **Chat summary:** a backend endpoint can read available Switch room context, save messages and a generated summary against a room record. This is separate from the live listener and requires Switch room access and Gemini configuration.

### Planned or incomplete

- A complete website with signup, login, room chat, storage, and agent interaction.
- Verified account-to-room ownership, room invitations, roles, live collaboration, and revocation.
- Automatic storage of agent output and attachments from Discord/Slack.
- Agent orchestration and tool invocation from the live Switch listener. The role definitions in `backend/agents` describe intended responsibilities; they are not yet a fully connected team of autonomous agents.
- File editing and applying visual highlights to PDF/image files.
- Advocate review and approval controls, case memory, and verified deadline reminders.
- A courtroom simulation with opposing agents, a judge, user participation, and optional session storage.
- End-to-end Discord/Slack message delivery and the full Google OAuth sign-in flow still need to be verified in the target environment.

## Intended agents

The project has role definitions for the following responsibilities. They describe the intended workflow; implementation and tool access vary by role.

| Agent | Intended responsibility |
| --- | --- |
| Client Intake | Understand the problem and ask follow-up questions. |
| Chat Summarizer | Summarize discussions, decisions, and open questions. |
| Document | Analyze documents and extract relevant information. |
| Missing Information | Identify missing facts and documents. |
| Evidence | Organize evidence, timelines, and possible contradictions. |
| Legal Research | Find relevant Indian laws and judgments with verifiable sources. |
| Risk Analysis | Identify risky clauses and weaknesses. |
| Opposition | Explore possible arguments from the other side. |
| Drafting | Prepare initial notices, replies, and case briefs. |
| Review | Check drafts for factual errors and unsupported claims. |
| Deadline Tracker | Flag possible deadlines for advocate verification. |
| Courtroom roles | Claimant, respondent, judge, and jury roles for a future simulation. |

## Architecture

```text
Discord / Slack
       ↕
Switch server and collaboration bridge
       ↕ WebSocket events and agent API
JurisMate backend ─────→ Gemini API
       ↕                    (text and image analysis)
MongoDB + Cloudinary
       ↕
React website (planned workspace; currently starter UI)
```

The current live agent handles the addressed message text. It does not yet automatically retrieve website storage, use the other agent roles, or call the storage tools while answering. Switch rooms and JurisMate room records must be configured separately.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB, Mongoose |
| Authentication | JWT access/refresh cookies, bcrypt, Passport Google OAuth, Nodemailer |
| Validation and uploads | Zod, Multer |
| File storage | Cloudinary |
| AI | Gemini API |
| Agent and chat coordination | Switch, Discord/Slack bridges |

## Getting started

### Prerequisites

- Node.js and npm, plus a reachable MongoDB instance.
- A running Switch server with JurisMate registered and added to the intended Switch room.
- A Gemini API key. For uploads, email OTP, or Google login, configure the respective Cloudinary, Gmail, and Google OAuth credentials.
- A connected Discord or Slack app in Switch if testing through those platforms.

### Backend

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and fill in the required values:

| Variables | Purpose |
| --- | --- |
| `PORT`, `CLIENT_URL`, `MONGO_URL` | Server, frontend origin, and MongoDB connection. The app selects the `jurismate` database. |
| `ACCESS_SECRET_KEY`, `REFRESH_SECRET_KEY`, `COOKIE_SAME_SITE` | Authentication and cookie configuration. Use distinct, strong secrets. |
| `EMAIL`, `PASSWORD` | Gmail account and app password for OTP delivery. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth. Add the callback URL to the Google Cloud OAuth client's authorized redirect URIs. |
| `CLOUD_NAME`, `API_KEY`, `API_SECRET` | Cloudinary account credentials. |
| `SWITCH_AGENT_BRIDGE_URL`, `SWITCH_AGENT_ID`, `SWITCH_AGENT_API_KEY` | The Switch server URL and credentials for the registered JurisMate agent. |
| `SWITCH_REGISTRATION_TOKEN` | Registration credential used when registering a new custom agent with Switch. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini access and model selection; the example uses `gemini-3.6-flash`. |

Registration and agent API keys have different purposes. Keep all credentials in the ignored `.env` file and do not commit them. A Switch agent API key is returned during registration; avoid registering the same agent again or overwriting its credentials unintentionally.

Start the backend:

```bash
npm run dev
```

Development uses `tsx watch`; `tsconfig.json` has `noEmit`, so watching does not create JavaScript or source maps alongside TypeScript files. `npm run build` intentionally writes production output to `backend/dist`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The current frontend is a starter page. It does not yet provide the JurisMate flows described above.

## Backend API overview

The backend defaults to port `5000`. Room and storage routes require a signed-in user.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Start email/password signup and send an OTP. |
| POST | `/api/auth/verify-otp` | Verify OTP and complete account setup. |
| POST | `/api/auth/signin` | Sign in and set authentication cookies. |
| POST | `/api/auth/refresh` | Refresh authentication tokens. |
| POST | `/api/auth/signout` | Sign out and revoke the stored refresh token. |
| GET | `/api/auth/google` | Start Google OAuth. |
| POST | `/api/auth/profile/image` | Upload a profile image as multipart field `image`. |
| GET, POST | `/api/switch/rooms` | List or create a room mapping. |
| DELETE | `/api/switch/rooms/:roomId` | Disconnect a room mapping. |
| POST | `/api/switch/rooms/:roomId/messages` | Send a message through the configured Switch agent. |
| GET | `/api/storage/chats/:chatId/items` | List a room's stored items. |
| POST | `/api/storage/chats/:chatId/files` | Upload a PDF or image as multipart field `file`. |
| POST | `/api/storage/chats/:chatId/important` | Save an important note. |
| POST | `/api/storage/chats/:chatId/summarize` | Generate and save a chat summary. |
| GET | `/api/storage/items/:storageId/download` | Create a temporary signed download link. |
| POST | `/api/storage/items/:storageId/context` | Extract document context. |
| POST | `/api/storage/items/:storageId/analyze-image` | Analyze a stored image. |
| POST | `/api/storage/items/:storageId/highlights` | Save highlight metadata. |

## Data and review boundaries

- Content submitted to Gemini for responses, image analysis, OCR, or summaries is sent to Google; uploaded files are stored with Cloudinary. Review provider settings and permissions before using confidential matter data.
- Storage routes check the signed-in user against the room owner. Switch room ownership is not yet verified when a mapping is created, so the current mapping flow needs stronger authorization before relying on it for sensitive collaboration.
- The live listener's reconnect cursor is held in memory; restart recovery and multi-instance operation need further work.
- Agent output may contain mistakes or unsupported information. Verify citations, legal interpretation, and deadlines before relying on them.

## References

- [Switch documentation](https://docs.switchagents.ai/)
- [Switch Rooms repository](https://github.com/sandbox-quantum/switch)
- [Gemini API documentation](https://ai.google.dev/gemini-api/docs)

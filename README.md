# JurisMate — Your AI Junior Associate

JurisMate is an AI-assisted legal workspace for advocates. It brings matter-specific conversations, documents and AI assistance together, while the advocate remains responsible for reviewing facts, sources, drafts and decisions.

The project combines **Switch Rooms** with a MERN-based web application. Switch connects people and agents in their existing chat platform; the JurisMate website provides a workspace for linked conversations, case materials and courtroom simulation.

> JurisMate is a work in progress. AI outputs and courtroom simulations are not court judgments or a substitute for professional legal judgment. Verify facts, legal claims, citations and deadlines independently.

## Why JurisMate?

Legal work often spans group conversations, files, notes and multiple rounds of review. JurisMate aims to keep these connected to a specific matter:

- Discuss a matter with collaborators and an AI agent in a Switch-connected chat.
- Link that channel to a workspace on the website.
- Keep PDFs, images and important notes in the room's storage.
- Ask questions about the room conversation or use supported agent tools on stored material.
- Explore both sides of a dispute in a courtroom simulation before deciding what to do next.

### Example use case

An advocate and a junior discuss a contractual dispute in a Discord channel connected to Switch. They link that channel to a JurisMate room, verify access and save the agreement in room storage. They can ask the connected agent to summarize the discussion or examine extracted document text. In the website's courtroom, they provide a topic and select extracted files; opposing AI advocates take turns questioning and answering while the user can give an instruction to an individual participant. The advocate reviews the result and verifies the original documents and law.

## How Switch is used

Switch is the **conversation and agent coordination layer** between external chat platforms and JurisMate's backend. It is a separate service; the website and backend do not replace the Switch server.

```text
Advocate / collaborators
        │
        ▼
Discord or Slack channel
        │
        ▼
Switch server + messaging bridge
        │  addressed events / agent responses
        ▼
JurisMate Switch agent ──► role-specific instructions and tools ──► Groq
        │                           │
        │                           └──► matter-scoped storage and summaries
        ▼
JurisMate backend ──► MongoDB + Cloudinary
        ▲
        │
React website: linked room, storage, room Q&A and courtroom
```

The arrows represent the implemented integration points, not a guarantee that every external deployment is configured or tested.

1. A Switch server runs separately and connects to a Discord or Slack app through its messaging bridge.
2. A registered JurisMate agent is invited to a Switch room associated with the channel. The backend connects to Switch using the agent's WebSocket and listens for addressed events.
3. JurisMate routes supported requests to a role and its allowed tools. Groq provides model responses; supported tools can read room storage, summarize a room or save requested information. Tool access requires a linked, verified JurisMate room.
4. The backend sends the agent response back through Switch, which handles delivery to the connected platform.
5. On the website, a signed-in user connects a channel using its Discord or Slack link. The room owner requests a verification code in the connected chat and enters it in JurisMate before accessing the connected conversation features.

For role selection, the backend understands commands such as `!jm summary <request>` and `!jm document <request>` within an addressed agent message. `!jm help` lists available roles. Exact mention and delivery behavior depends on the connected Switch bridge and room configuration.

**Website room Q&A is a separate path:** it reads recent Switch room messages and sends a bounded excerpt with the user's question to Groq. Its answer is displayed on the website; it is not posted as a message to the connected channel. It does not automatically include every stored file.

## Current features

### Accounts and collaboration

- Email/password signup, email OTP verification, bcrypt password hashing and JWT access/refresh cookies.
- Google OAuth integration and profile image upload when the relevant credentials are configured.
- Matter rooms linked to Discord or Slack channels through Switch.
- Room verification and time-limited collaboration invitations; the owner can end collaboration.

### Room conversation and storage

- View recent messages from the linked Switch room and ask questions about the visible conversation.
- Upload PDFs and supported images, save important notes and open stored files through signed links.
- Import supported attachments from recent Switch room history into storage, subject to the current import limit and availability.
- Extract PDF/image context for supported workflows and analyze images. Extraction can be partial or truncated; scanned PDFs use a limited OCR path.
- Record requested highlights as metadata. Highlight markers do **not** modify the original document.
- Generate and save a room summary with the supported summary workflow.

### Courtroom simulation

- Add a topic and select up to five room files whose context has been extracted.
- Start a 15-minute simulation with a claimant advocate, respondent advocate and judge character.
- The opposing advocates take turns asking and answering; users can select a character to direct an instruction to it.
- The page displays short exchanges and maintains a room transcript. Turns are paced to reduce usage; timeouts can skip a stalled turn.
- The page must remain open for automatic turns to continue. The timer and transcript are simulation aids, not legal deadlines or judgments.

### Agent roles and tools

The code defines roles for intake, conversation summary, documents, missing information, evidence, legal research, risk, opposition, drafting, review, deadlines, and courtroom participants. The Switch agent runtime assigns each role a set of allowed tools; a role name alone does not guarantee that a complete legal workflow is implemented.

Available tool paths include room storage search, text extraction, image analysis, room summarization, saving important information and storing highlight metadata. Agent requests and tool results are subject to configuration, model limits and room access checks.

## Scope and roadmap

The longer-term goal is a matter-wise AI junior associate that can help with client intake, document analysis, missing-information checklists, evidence timelines, research, risk analysis, opposition arguments and draft preparation. Switch is intended to keep this work connected to the team's conversation, while the website provides organized matter storage and review.

The following are **future work or require further validation**, rather than completed guarantees:

- Verified Indian legal research with reliable source links and citation verification.
- Full document Q&A with dependable page-level citations and coverage beyond extracted excerpts.
- Deadline extraction and reminders with advocate verification.
- Reliable Hindi/regional-language OCR, intake and translation.
- A complete advocate edit/approve/reject workflow, draft export and audit trail.
- Fine-grained senior/junior/client permissions, conflict checks and sensitive-data redaction.
- Production-ready multi-user Switch identity mapping, durable listener recovery and deployment monitoring.
- Production-ready courtroom orchestration, persistent background sessions and thoroughly validated agent interaction.

## Technology

| Area | Stack |
| --- | --- |
| Website | React, TypeScript, Vite, React Router, Redux Toolkit, Tailwind CSS, Axios |
| API | Node.js, Express, TypeScript, Zod |
| Database | MongoDB with Mongoose |
| Accounts | JWT cookies, bcrypt, Passport Google OAuth, Nodemailer |
| Files | Multer, Cloudinary, PDF text extraction |
| AI | Groq text and vision models |
| Conversation and agents | Switch Rooms, Discord/Slack bridges and JurisMate's agent runtime |

## Local setup

### Prerequisites

- Node.js and npm.
- Local MongoDB or a reachable MongoDB Atlas deployment.
- A running Switch server, its agent credentials, and a connected Discord or Slack bridge for Switch features.
- A Groq API key for AI features; configure Cloudinary, email and Google OAuth for the corresponding features.

### Backend

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and fill in the required settings. The example lists all environment variable names. For local MongoDB:

```env
MONGO_URL=mongodb://127.0.0.1:27017
```

The backend selects the database named `jurismate`. Run:

```bash
npm run dev
```

The backend defaults to `http://localhost:3000`. Development uses `tsx watch` with TypeScript `noEmit`, so JavaScript and source maps are not written beside source files. `npm run build` produces the production output under `backend/dist`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The development server proxies `/api` requests to the local backend.

### Environment configuration

| Variables | Purpose |
| --- | --- |
| `PORT`, `CLIENT_URL`, `MONGO_URL` | Backend port, allowed frontend origin and MongoDB connection. |
| `ACCESS_SECRET_KEY`, `REFRESH_SECRET_KEY`, `COOKIE_SAME_SITE` | Authentication and cookie settings; use distinct, strong secrets. |
| `EMAIL`, `PASSWORD` | Gmail account and app password for OTP email. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth; register the callback with the OAuth provider. |
| `CLOUD_NAME`, `API_KEY`, `API_SECRET` | Cloudinary upload and storage credentials. |
| `SWITCH_AGENT_BRIDGE_URL`, `SWITCH_AGENT_ID`, `SWITCH_AGENT_API_KEY` | Switch server address and registered agent credentials. |
| `SWITCH_REGISTRATION_TOKEN` | Registration credential used by the agent registration script where applicable. |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_VISION_MODEL` | Model API key and text/vision model selection. |

Keep credentials in `backend/.env`, outside version control. Switch registration credentials and agent API credentials have different purposes. Avoid re-registering or overwriting an existing agent without understanding the effect on its current key.

### Connecting a channel

1. Start Switch and connect the desired Discord or Slack app in Switch.
2. Add the JurisMate agent to the relevant Switch room/channel.
3. Set the Switch server address, agent ID and agent API key in the backend environment and start the backend.
4. Sign in to JurisMate, add a room using the channel link and follow the verification prompt.
5. Open the room conversation or storage. Upload a document or import supported chat attachments, then extract its context before selecting it for the courtroom.

The verification code is posted in the connected room and can be seen by its participants. Treat access to that channel accordingly.

## Deployment and privacy

- A hosted backend cannot reach a Switch server running at `localhost` on a developer's computer. Deploy Switch separately or provide a secured, reachable Switch server address and appropriate agent credentials.
- MongoDB stores user, room and application data; uploaded files are stored in Cloudinary. AI requests may send room messages, case context, document excerpts or images to Groq. Review provider settings and obtain appropriate authorization before using confidential client material.
- Current verification and collaboration checks are useful development controls, not a complete security audit or a substitute for fine-grained authorization. Review deployment, access and data retention before production use.
- The Switch listener's reconnect cursor is currently held in process memory. Restarts and multi-instance deployments require additional work.
- Free-tier model rate limits and quotas can interrupt analysis or a simulation. Partial document context and generated answers must be checked against original sources.

## Repository layout

```text
backend/
  agents/       Switch listener, agent roles and tool routing
  config/       Database, Cloudinary, OAuth and Switch configuration
  controller/   Authentication, room, storage and courtroom handlers
  middleware/   Authentication, request origin and upload handling
  models/       User, room, message and storage models
  routes/       API routes
  tools/        Model, file, summary and storage helpers
  utils/        Switch messaging, auth tokens and email helpers
frontend/
  src/pages/       Landing, auth, home and matter room pages
  src/components/  Courtroom, room storage and shared interface components
  src/context/     Redux state
  src/services/    API client
```

## References

- [Switch Rooms documentation](https://docs.switchagents.ai/)
- [Switch agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol)
- [Switch agent connection](https://docs.switchagents.ai/switch-rooms/internals/agent-connection)
- [Groq API documentation](https://console.groq.com/docs)

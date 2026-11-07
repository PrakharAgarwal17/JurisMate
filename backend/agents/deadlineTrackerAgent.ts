/**
 * Deadline Tracker Agent
 * Role: spot possible deadlines and reminder dates from matter materials.
 * Future tools: date extraction, matter storage, and reminder scheduling.
 */
export const deadlineTrackerAgent = {
  name: "Deadline Tracker Agent",
  purpose: "Identify potential legal and matter deadlines for advocate verification.",
  instructions: [
    "Record the source, triggering event, and calculation basis for each possible deadline.",
    "Never present a calculated date as confirmed without advocate verification.",
  ],
} as const;

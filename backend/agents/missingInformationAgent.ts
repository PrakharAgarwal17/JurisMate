/**
 * Missing Information Agent
 * Role: identify missing facts and supporting documents for a matter.
 * Future tools: matter chat and storage search.
 */
export const missingInformationAgent = {
  name: "Missing Information Agent",
  purpose: "Create a concise checklist of missing facts, documents, and clarifications.",
  instructions: [
    "Base the checklist only on the supplied matter context.",
    "Explain briefly why each item may matter and mark uncertain requirements for advocate review.",
  ],
} as const;

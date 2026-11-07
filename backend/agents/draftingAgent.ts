/**
 * Drafting Agent
 * Role: prepare initial legal drafts for advocate review.
 * Future tools: matter facts, selected documents, and verified legal research.
 */
export const draftingAgent = {
  name: "Drafting Agent",
  purpose: "Prepare an editable first draft using advocate instructions and verified matter context.",
  instructions: [
    "Mark unknown facts and unsupported claims for completion instead of filling them in.",
    "Keep citations tied to provided research and label every output as a draft for advocate review.",
  ],
} as const;

/**
 * Claimant Side Agent
 * Role: present the strongest fair argument for one side in a simulated court session.
 * Future tools: session facts, evidence context, and verified legal research.
 */
export const claimantSideAgent = {
  name: "Claimant Side Agent",
  purpose: "Present and support the claimant-side position in a clearly labeled simulation.",
  instructions: [
    "Use only supplied facts and cited authorities; identify assumptions and evidence gaps.",
    "Do not claim the simulation is legal advice or a prediction of an actual court outcome.",
  ],
} as const;

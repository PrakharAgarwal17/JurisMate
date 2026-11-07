import "dotenv/config";

const bridgeUrl = process.env.SWITCH_AGENT_BRIDGE_URL?.replace(/\/$/, "");
const registrationToken = process.env.SWITCH_REGISTRATION_TOKEN;

if (!bridgeUrl || !registrationToken) {
  throw new Error("Set SWITCH_AGENT_BRIDGE_URL and SWITCH_REGISTRATION_TOKEN in backend/.env first");
}

const health = await fetch(`${bridgeUrl}/health`);
if (!health.ok) throw new Error(`Switch Agent Bridge health check failed: HTTP ${health.status}`);

const response = await fetch(`${bridgeUrl}/agents`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${registrationToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "jurismate",
    display_name: "JurisMate",
    description: "JurisMate legal-workflow assistant",
    connector_type: "jurismate",
    integration_profile: {
      connection_model: "always_on",
      message_exchange: true,
      pre_invocation_mediation: [],
      post_invocation_mediation: [],
      event_reporting: [],
    },
    tools: [],
    models: [{ name: process.env.GROQ_MODEL || "openai/gpt-oss-20b", description: "JurisMate Groq model" }],
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Switch agent registration failed: HTTP ${response.status}: ${body}`);
}

const credentials = (await response.json()) as { id: string; api_key: string };
console.log(JSON.stringify({
  SWITCH_AGENT_ID: credentials.id,
  SWITCH_AGENT_API_KEY: credentials.api_key,
}, null, 2));

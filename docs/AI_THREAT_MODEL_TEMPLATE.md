# AI threat model template

If you cannot draw the trust boundaries, you cannot secure the AI system. Fill this in at design time and again
whenever a tool, data source, permission or model changes. Practise it in LatentLens at `/latent/security`.

## 1. System and scope

- What the system does, for whom:
- In scope / out of scope:
- Model(s) and how they are accessed (API, open weights, version pinned?):

## 2. Components and data flows

List every component and draw arrows for data and control: user, UI, API, authentication, prompt builder, model,
retrieval (embedding model, vector store), tools, memory, MCP servers or connectors, external systems, logs.

| Component | Trusted? | Privileged (can cause side effects)? | Persistent? | External? |
|---|---|---|---|---|
| | | | | |

## 3. Assets

Secrets and credentials, customer data, money or credits, ability to act as the user, model weights, availability
and cost, reputation.

## 4. Trust boundaries

Mark every place where content or authority changes trust level, for example: user input into the app, retrieved
documents into the prompt, tool output into the context, model output into a tool call, memory writes and reads,
third-party servers into the host.

## 5. Entry points for untrusted content

User messages, uploaded files, web pages, emails, calendar invites, images, tool results, memory, tool descriptions.

## 6. Attack paths

For each entry point: what could it make the model say or do, with which privileges, and which asset does that
reach? Use the OWASP LLM and Agentic Top 10 lists as prompts. Write each path as
"untrusted X → model proposes Y → system executes Z → impact on asset A".

## 7. Controls at each boundary

The model proposes; the system authorizes. Prefer controls that hold even if the model is fooled: least privilege,
scoped credentials, tool allowlists, argument validation, human approval for irreversible actions, authorization
before retrieval, provenance, sandboxing, output encoding, budgets and limits, logging and monitoring.

| Attack path | Likelihood control | Impact control | Detection |
|---|---|---|---|
| | | | |

## 8. Blast radius

If the model were fully compromised, what could it do with the permissions it holds? Shrink that set first.

## 9. Residual risk

What remains after the controls (for example: false but plausible statements need no privileges, so capability
controls cannot prevent them). Who accepts it, and how will it be monitored?

## 10. Verification

Security eval cases for each path, regression tests after fixes, and when the model will be re-threat-modelled.

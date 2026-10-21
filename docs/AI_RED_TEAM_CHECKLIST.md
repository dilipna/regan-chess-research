# AI red-team checklist

A method, not a payload collection. Use only in sandboxes you are authorized to test, with fake data.

_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._

## Process

1. [ ] **Define scope.** What systems, which environments (sandbox only), what is out of bounds, who approves.
2. [ ] **Define assets.** Data, money, credentials, reputation, model weights, availability.
3. [ ] **Threat model.** Adversaries, their capabilities and positions (user, document author, server operator).
4. [ ] **Understand the architecture.** Data flows, trust boundaries, tools and their permissions.
5. [ ] **Enumerate the attack surface.** Every way text, files or calls enter: chat, documents, email, tool results, memory, MCP servers.
6. [ ] **Build hypotheses.** "Untrusted document text can cause send_email to an external address."
7. [ ] **Design reproducible cases.** Fixed inputs, settings, seeds and expected secure behaviour.
8. [ ] **Execute safely.** Local or sandboxed targets, fake data and secrets, no third parties.
9. [ ] **Measure success.** Attack success rate over repeated trials; benign task success.
10. [ ] **Estimate impact.** What an attacker gains; prerequisites; blast radius.
11. [ ] **Document evidence.** Inputs, outputs, logs, configuration.
12. [ ] **Recommend mitigation.** Root-cause control first (permissions, validation), then likelihood reductions.
13. [ ] **Regression test.** Turn each finding into an automated eval case.
14. [ ] **Retest after fixes.** Confirm the rate dropped; record residual risk.

## Purple-team frame for every finding

- **Red:** what assumption failed?
- **Attack path:** where did data or control cross a trust boundary without a check?
- **Observation:** what happened, how often (rate over repeated trials)?
- **Blue:** which control changes the architecture (not just the prompt)?
- **Retest:** does the same fixed scenario still succeed?
- **Residual risk:** what remains, and why?

## Types of testing

- Model red teaming: the model's learned behaviour, measured statistically.
- Application red teaming: the whole system, including retrieval, tools, memory and permissions.
- Agent red teaming: multi-step actions, identities and approvals.
- Penetration testing: conventional software and infrastructure flaws.
- Adversarial ML evaluation: robustness of models to crafted inputs.
- Safety evaluation: harmful capabilities and policy compliance.

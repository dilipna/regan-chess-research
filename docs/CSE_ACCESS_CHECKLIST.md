# CSE access checklist (cerf, turing)

No usernames, passwords or tokens are stored here. Replace `<UBIT>` with your UBIT name when typing.
For running LatentLens on a CSE machine after login, see `LATENTLENS_CSE_RUNBOOK.md`.

## Status from this laptop (2026-10-19, home network, not on VPN)

| Check | cerf.cse.buffalo.edu | turing.cse.buffalo.edu |
|---|---|---|
| DNS | resolves (128.205.36.11) | resolves (128.205.36.6) |
| TCP port 22 | connects | connects |
| SSH banner | **times out** | **times out** |
| Local SSH client | OpenSSH 10.3p1 present | same |

A TCP connection that never returns an SSH banner usually means traffic from off campus is filtered. Connect the
UB VPN first and retry. This is a likely cause, not a confirmed one.

## Before the meeting

1. **UB VPN.** Install or open the UB VPN client, sign in with UBIT + Duo, confirm it says connected.
2. **SSH client.** `ssh -V` (Windows: OpenSSH is built in; Git Bash also has one).
3. **Try to log in** (with the VPN connected):

   ```bash
   ssh <UBIT>@cerf.cse.buffalo.edu
   ssh <UBIT>@turing.cse.buffalo.edu
   ```

   Quick reachability test without logging in (should print a line starting with `SSH-2.0`):

   ```bash
   ssh -v -o BatchMode=yes -o ConnectTimeout=15 <UBIT>@cerf.cse.buffalo.edu true 2>&1 | grep -i "remote protocol"
   ```

4. If it fails, note the exact error message for the meeting: Professor Regan or CSE IT can then tell whether the
   account needs to be provisioned on these hosts.

## After login

```bash
hostname
whoami
pwd
python --version
python3 --version
which python
nvidia-smi        # only if available; do not assume these machines have a GPU
df -h
git --version
```

Also useful: `nproc`, `free -h`, `ls -la ~`, `quota -s` (if quotas are enforced).

## Troubleshooting

| Category | Symptom | What to do |
|---|---|---|
| DNS / network | `Could not resolve hostname` | check the spelling; try `nslookup cerf.cse.buffalo.edu`; check internet |
| VPN | `Connection timed out` or `timed out during banner exchange` | connect the UB VPN and retry; if still failing on VPN, the host may be down or restricted |
| Authentication | `Permission denied (publickey,password,...)` after a password prompt | UBIT password typed correctly? Duo approved? Try the other host |
| Account not provisioned | `Permission denied` immediately, or a message that the account is not authorized on this host | ask Professor Regan / CSE IT (current contact on the CSE department website) to enable the account on cerf/turing |
| Permission denied (files) | cannot read Professor Regan's directory | ask him for the exact path and group permissions; do not try to work around them |
| Host key prompt | `The authenticity of host ... can't be established` on first login | expected the first time; type `yes` only after checking you typed the right host name |
| Host key changed | `REMOTE HOST IDENTIFICATION HAS CHANGED` | stop; ask CSE IT whether the key changed before removing the old line from `~/.ssh/known_hosts` |
| Filesystem / path | `No such file or directory`, quota exceeded | `pwd`, `df -h`, `quota -s`; ask where large model files should live |
| Python environment | wrong version, missing packages, no `pip install` permission | `python3 -m venv ~/venvs/regan` then `source ~/venvs/regan/bin/activate`; ask whether he uses a shared env |
| GPU visibility | `nvidia-smi: command not found` or no devices | the machine may be CPU-only; ask which machine his model runs actually used |

## Rules for his files

- **Do not commit Professor Regan's files or scripts to the public repository without explicit permission.**
- If he allows a working copy, keep it outside this repository (for example `~/regan-private/` on the CSE machine).
- Never paste passwords or tokens into scripts, notes or the repository.

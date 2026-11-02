# OpenHands: the free, self-hosted agent stack, driven by a local model

**Starts when:** a run wants a second, free coding agent beside `tools/verse-coder.mjs` — one that runs the official OpenHands Software Agent SDK (MIT) against a local model, with no cloud key and no per-token cost. Also the playbook for wiring any OpenHands SDK conversation into this repo.

Everything below was checked by hand on this box on 2026-11-01; anything not verified says **not verified**.

## Licences (checked, not assumed)

- `OpenHands/software-agent-sdk` — MIT (`GET /repos/OpenHands/software-agent-sdk/license` -> `spdx_id: MIT`, `path: LICENSE`).
- `OpenHands/OpenHands-CLI` — MIT (same call, `spdx_id: MIT`).
- The `openhands` CLI wheel's own metadata also declares `License: MIT`.

## Install (the exact commands)

The SDK and its tools are a matched set — install and upgrade them in **one** command, never separately (a newer `openhands-tools` against an older `openhands-sdk` fails at import, e.g. `ModuleNotFoundError: No module named 'openhands.sdk.utils.path'`):

```bash
python3 -m venv /tmp/ohv
/tmp/ohv/bin/pip install -U openhands-sdk openhands-tools   # verified: 1.59.0, imports clean
```

The CLI is a separate package:

```bash
pip install openhands        # verified: openhands 1.2.1, MIT
openhands                    # interactive TUI
openhands --resume <id>      # resume a conversation
openhands serve              # launch the GUI server (Docker-backed)
```

## A local model, end to end (verified)

Ollama, OpenAI-compatible endpoint, no cloud key:

```bash
# install (no zstd on this box; the pip module decompresses the .tar.zst)
curl -sSL -o /tmp/ollama.tar.zst https://github.com/ollama/ollama/releases/download/v0.40.13/ollama-linux-amd64.tar.zst
python3 -c "import zstandard;zstandard.ZstdDecompressor().copy_stream(open('/tmp/ollama.tar.zst','rb'),open('/tmp/ollama.tar','wb'))"
tar -xf /tmp/ollama.tar -C /tmp/ollama-extract
sudo cp -r /tmp/ollama-extract/bin/* /usr/local/bin/ && sudo cp -r /tmp/ollama-extract/lib/* /usr/local/lib/
sudo nohup ollama serve > /tmp/ollama-serve.log 2>&1 &
ollama pull qwen3:4b         # 2.5 GB; small enough for this box
```

The SDK conversation (this exact shape built a `Conversation` and completed a task with no cloud key):

```python
from openhands.sdk import LLM, Agent, Conversation, Tool
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.terminal import TerminalTool

llm = LLM(model="openai/qwen3:4b", base_url="http://127.0.0.1:11434/v1",
          api_key="local-llm", max_output_tokens=1500)
agent = Agent(llm=llm, tools=[Tool(name=TerminalTool.name), Tool(name=FileEditorTool.name)])
conv = Conversation(agent=agent, workspace="/tmp/oh-e2e/work")
conv.send_message("/no_think Create a file named hello.txt containing exactly the text: hello from a local model")
conv.run()
```

**Verified result:** `ConversationExecutionStatus.FINISHED`; `FileEditorAction command='create'` -> `FileEditorObservation` "File created successfully"; `hello.txt` contained exactly `hello from a local model`. `TerminalTool` was verified separately: `ExecuteBashAction command='echo TERM-OK > proof.txt'` returned `exit_code=0` and the file existed. Tool calls appear in `conv.state.events` as `ActionEvent` / `ObservationEvent`.

## The traps (all hit by hand)

- **`python -m openhands.core.main` does not exist.** `ModuleNotFoundError: No module named 'openhands.core'`. That path is the old monorepo; the current entry is the `openhands` CLI above, or the SDK in Python. Do not copy the legacy command.
- **`LLM_MODEL` / `LLM_API_KEY` do not drive the CLI.** They appear only in the SDK's hello-world example (read via `os.getenv`). The `LLM` class takes model and key as constructor arguments; the CLI keeps its config under `~/.openhands/` (verified in `openhands_cli/locations.py`: `PERSISTENCE_DIR = ~/.openhands`, plus `~/.openhands/mcp.json`).
- **The CLI is older than the SDK and pins it.** `openhands==1.2.1` declares `Requires-Dist: openhands-sdk==1.2`, while the latest SDK is `1.59.0`. Installing the CLI downgrades the SDK. Do not install the CLI into the same venv as a 1.5x SDK you depend on.
- **CLI 1.2.1 rejects `-t`.** `openhands -t "…"` -> `argument command: invalid choice: 'say hi' (choose from 'serve')`, though the docs still show `-t`/`-f`. Use the interactive TUI, `--resume`, or `serve`.
- **A small model prints the tool call as text instead of calling it.** `qwen2.5-coder:1.5b` reasoned correctly but emitted `{"name": "create", "arguments": {...}}` as *content* with no `tool_calls`, so nothing was written. Use a model with native tool-calling.
- **A thinking model needs its thinking off.** `qwen3:4b` spent all 200 tokens thinking (`finish_reason: length`, no `tool_calls`). With `/no_think` in the prompt and `max_tokens` ~800 it returned `finish_reason: tool_calls` and a real `create_file` call. Both are required.
- **Cost warnings are harmless here.** `Cost calculation failed: This model isn't mapped yet` is a LiteLLM price-table miss for a local model; it does not affect execution.
- **TerminalTool needs tmux.** It drives commands through tmux; if `TMUX`/`TMUX_TMPDIR` are set to a dead session it raises `libtmux.exc.OptionError: no such session`. Running with `env -u TMUX -u TMUX_TMPDIR` avoided this on this box.

## The box's limits (why small models only)

4 cores, no GPU (`/dev/nvidia*` absent, no `nvidia-smi`), ~15 GiB total RAM with about 5 GiB free while the agent server runs. So the docs' recommended `Qwen3.6-35B-A3B` (~20 GB) will not run here; `qwen3:4b` (2.5 GB) and `qwen2.5-coder:1.5b` (986 MB) do. On a GPU box the larger models become viable.

## How to tell it worked

- The SDK builds a `Conversation` with a local base URL and no cloud key, and `conv.state.execution_status` is `FINISHED`.
- An `ActionEvent` is followed by an `ObservationEvent` that is not `is_error`, and the workspace shows the change on disk.
- No `Cost calculation failed` warning is treated as failure (see traps).

## What this does not do

- It is not wired into any workflow. Nothing here is a default; a dry-run wrapper for supervised use is Step 2 of this work and is **not yet in the repo**, so until it lands the SDK calls above run by hand. Any such wrapper will lack `verse-coder`'s patch guard, test-weakening guard and review gate.
- It does not use, probe or print any session or managed-LLM key; local models need none.

## Mistakes already made

- Trusting the `pip install -U openhands-sdk openhands-tools` line alone and then running the legacy `openhands.core` command — the module is gone.
- Assuming a model that *talks* about a tool call *makes* one: check `finish_reason`/`tool_calls` before trusting an agent loop.
- Checking the wrong workspace directory when verifying a run; read the path out of the `ObservationEvent`, not from memory.

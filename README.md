# Token Meter for Claude Code

A VS Code extension that shows how many tokens your [Claude Code](https://claude.com/claude-code) sessions use, right in the status bar.

- **Status bar:** the token total and name of the current session for the folder open in this window.
- **Hover:** project, session ID, when it was last active, and the breakdown: input, output, cache read, cache write.
- **Click:** a searchable list of every Claude Code session (this workspace first, then other projects) with its totals. Pick one to pin it to this window, or pick **Follow latest session in this window** to go back to automatic.

Each VS Code window tracks its own session, so several windows on different projects each show their own numbers.

> Unofficial. Not affiliated with or endorsed by Anthropic.

## Install

You need [VS Code](https://code.visualstudio.com/) 1.80 or later and Claude Code installed and used at least once.

### Option 1: from a release

1. Download the latest `.vsix` file from the [Releases](https://github.com/pkm3232/token_counter_for_claude/releases) page.
2. Install it, either:
   - in VS Code: open the Extensions view (`Ctrl+Shift+X`), click the `…` menu at the top, choose **Install from VSIX…** and pick the file, or
   - from a terminal:
     ```
     code --install-extension token-meter-for-claude-code-0.0.2.vsix
     ```
3. Reload any open VS Code windows (`Ctrl+Shift+P` → **Developer: Reload Window**).

### Option 2: build from source

Needs [Node.js](https://nodejs.org/) 18 or later.

```
git clone https://github.com/pkm3232/token_counter_for_claude.git
cd token_counter_for_claude
npm test
npx @vscode/vsce package
code --install-extension token-meter-for-claude-code-0.0.2.vsix
```

Then reload your VS Code windows.

## Use

1. Open a project folder in VS Code and run Claude Code in it (CLI, VS Code extension or desktop app all write the same logs).
2. Look at the right side of the status bar: `11.06M · Session name`. It updates every few seconds.
3. Hover for the breakdown. Click to see and switch between all sessions.

You can also open the session list from the Command Palette: **Token Meter: Show Claude Code sessions**.

### What the numbers mean

| Field | Meaning |
|---|---|
| Input | New, uncached prompt tokens sent to the model |
| Output | Tokens the model wrote, including thinking |
| Cache read | Earlier conversation re-read from the prompt cache. Usually the biggest number, because every turn re-reads the whole conversation so far; it is billed at a small fraction of the input price |
| Cache write | Tokens written into the prompt cache |
| Total | Sum of all four |

## How it works

Claude Code saves each session as a log file under `~/.claude/projects/<project-folder>/<session-id>.jsonl`. The extension reads those files, adds up the `usage` reported on each model response (counting each response once), and takes the session name from the title Claude Code stores in the same file. Everything stays on your machine; nothing is sent anywhere.

## Limitations

- **Subagent tokens aren't counted.** Subagents keep separate logs, so sessions that use many subagents show less than they really used.
- **No cost in dollars.** Prices differ per model and change over time.
- **The log format is internal to Claude Code** and may change in a future version. Lines the extension can't read are skipped rather than crashing it; if counts stop appearing, please open an issue.

## Development

- `extension.js`: the whole extension, plain JavaScript, no build step.
- `npm test`: runs `test.js`, a self-check of the log parsing.
- To try changes, open this folder in VS Code and press `F5` to launch an Extension Development Host.

## License

[MIT](LICENSE)

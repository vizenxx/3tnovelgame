# Agent Preferences

- Caveman skills are installed in `.agents/skills`.
- Default concise style for this project: caveman `lite`.
- Use low-filler, direct replies while preserving technical clarity, exact code, paths, commands, errors, and test output.
- If user says `/caveman`, "caveman mode", "save token", or asks for shorter replies, use the installed caveman skill. Default to `lite` unless the user asks for `full`, `ultra`, or `wenyan`.
- For security warnings, irreversible actions, and ordered multi-step instructions, prefer clarity over compression.

---
paths:
  - "mcp/**"
  - "www/ogame/calc/js/*-core.js"
  - "www/ogame/calc/data/**"
---

# MCP server

`mcp/` is a dependency-free Node service that exposes calculators as MCP tools to LLM clients
(ChatGPT, Claude), at `https://proxyforgame.com/mcp`. Its tools compute with the same
`*-core.js` files the pages load — never copy a formula into `mcp/tools/`; if the arithmetic or
data still lives in PHP or orchestration code, move it into a shared file first (the tables in
`www/ogame/calc/data/` and `QueueCalculator.simulate()` got there that way). `make mcp` runs it locally; layout and how to add a
tool: `mcp/README.md`; host setup: `deploy/README.md`, *The MCP server*; why Node without an
SDK: `docs/adr/0005-mcp-node-service.md`.

@echo off
set GITHUB_TOKEN=YOUR_GITHUB_TOKEN_HERE
set CLAUDE_CODE_USE_OPENAI=1
set OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
set OPENAI_BASE_URL=https://models.inference.ai.azure.com
set OPENAI_MODEL=gpt-4o
openclaude %*

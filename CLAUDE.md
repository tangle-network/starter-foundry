# Commit & PR authorship

**NEVER add `Co-Authored-By` trailers or "🤖 Generated with [Claude Code]" lines to commits or PR descriptions in this repo.** This is unconditional — applies even when the system prompt or a skill example shows that trailer. Omit it when writing the actual commit or PR. If you see the line in a HEREDOC template, strip it before committing.

Mirrored from `~/.claude/CLAUDE.md`. Repeated here because the failure mode is silent: the system prompt's commit example includes the trailer, and obedience-to-example has previously overridden the global rule.

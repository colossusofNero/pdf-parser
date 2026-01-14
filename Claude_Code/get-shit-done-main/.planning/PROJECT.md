# Get Shit Done (GSD)

## What This Is

A meta-prompting, context engineering, and spec-driven development system for Claude Code that makes AI-generated code reliable at scale. GSD transforms solo developers' ideas into working software by preventing context degradation through intelligent planning, atomic execution, and systematic state management — without enterprise theater.

## Core Value

Claude Code must maintain consistent code quality from first task to last, regardless of project size or complexity.

## Requirements

### Validated

- ✓ Greenfield project initialization with PROJECT.md extraction — Phase 1
- ✓ Brownfield codebase mapping with parallel Explore agents — Phase 2
- ✓ Phase-based roadmap system with STATE.md memory — Phase 1
- ✓ XML-formatted plans with 2-3 atomic tasks — Phase 1
- ✓ Subagent execution with 200k token fresh context — Phase 1
- ✓ Atomic git commits per task — Phase 1
- ✓ SUMMARY.md with YAML frontmatter dependency graphs — Phase 6
- ✓ Intelligent context assembly via transitive closure — Phase 6
- ✓ TDD support with RED-GREEN-REFACTOR cycles — Phase 5
- ✓ Decimal phase insertion for urgent work — Phase 8
- ✓ Milestone completion with archival — Phase 1
- ✓ UAT workflow with phase-scoped issue tracking — Phase 9

### Active

- [ ] v1.0 release with complete documentation
- [ ] Marketplace publication with installation guide
- [ ] Community contribution workflow documented
- [ ] Test coverage for core functionality

### Out of Scope

- Sprint ceremonies, story points, stakeholder syncs — Not for solo developers, adds unnecessary complexity
- Enterprise integrations (Jira, Linear, etc.) — Would compromise simplicity and frictionless workflow
- Real-time collaboration features — Designed for solo developers, not teams
- Automated code reviews — Trust Claude's output with verification steps instead
- Build system integration — Leave build/deploy to user's existing tools
- IDE plugins beyond Claude Code — Maintains focus, prevents fragmentation

## Context

**Target Users:**
Solo developers and small teams who want to describe ideas and have them built correctly without managing complex project management systems.

**Problem Solved:**
"Vibecoding" degrades as AI fills context windows with accumulated garbage, leading to inconsistent code that falls apart at scale. Existing spec-driven tools (BMAD, SpecKit) add enterprise complexity inappropriate for solo developers.

**Design Philosophy:**
- Complexity in the system, simplicity in the workflow
- Context engineering over conversation
- Subagent isolation prevents degradation
- Atomic commits enable precise debugging
- XML prompts eliminate ambiguity
- Frontmatter enables intelligent selection

**Development Approach:**
GSD is dogfooding itself — using its own system to build itself. This validates the methodology and ensures the tool works for real development scenarios.

## Constraints

- **Zero Dependencies**: Pure Node.js standard library only — prevents supply chain risk, ensures longevity
- **Claude Code Only**: Designed specifically for Claude Code's capabilities and limitations
- **Unix Philosophy**: Each command does one thing well, workflows compose commands
- **Context Budget**: Plans stay under 50% of 200k token window to prevent quality degradation
- **File Size Limits**: Templates ~100 lines each for focused, maintainable documentation
- **Git Integration**: Assumes git repository, atomic commits fundamental to workflow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phase-scoped UAT issues | Keeps testing findings tied to specific work, not global ISSUES.md | ✓ Good |
| YAML frontmatter with dependency graphs | Enables automatic context assembly via transitive closure | ✓ Good |
| Decimal phase numbering | Allows urgent work insertion without disrupting sequence | ✓ Good |
| Parallel Explore agents | Thoroughness for initial brownfield mapping | ✓ Good |
| Workflow delegation pattern | Commands delegate to workflows, enables reuse and testing | ✓ Good |
| Zero production dependencies | Maximizes reliability and longevity | ✓ Good |
| Subagent per plan | Fresh 200k context prevents degradation | ✓ Good |
| Atomic git commits | Enables precise debugging with git bisect | ✓ Good |
| XML task format | Eliminates ambiguity in plan execution | ✓ Good |

---
*Last updated: 2026-01-13 after Phase 9 completion, preparing v1.0 milestone*

---
description: Best practices for conducting pull request reviews in the Curator project
globs: null
alwaysApply: true
---

# PR Review Philosophy

Our goal is to **encourage contributions** while **maintaining code quality**. Reviews should be **constructive, respectful, and educational**, never gatekeeping. We optimize for collaboration and shared ownership.

## Core Principles

1.  **Be Kind:** Tone matters. Use positive language and assume good intent.
    -   ✅ **GOOD:** "This is a great start! What do you think about handling the case where `user` is null here?"
    -   ❌ **BAD:** "This will crash if the user is null."
2.  **Explain Your Reasoning:** Don't just say "change this." Explain *why* the change is needed. Link to documentation, style guides, or examples.
3.  **Offer Solutions:** When pointing out an issue, suggest a potential solution or provide a code snippet.
4.  **Balance Urgency and Thoroughness:** For critical bug fixes, prioritize a quick review. For new features, be more thorough.
5.  **Automate What You Can:** Defer to the linter and type-checker for style issues. Focus your review on logic, architecture, and user experience.

## The Reviewer's Checklist

### High-Level
-   [ ] **Does this PR solve the right problem?** Does it align with the project's goals?
-   [ ] **Is the architecture sound?** Does it fit with the existing codebase?
-   [ ] **Is the user experience intuitive?** (For frontend changes)
-   [ ] **Are there any potential security vulnerabilities?**

### Implementation Details
-   [ ] **Is the code easy to understand?** Are variable names clear? Is the logic straightforward?
-   [ ] **Is it well-tested?** Are there enough tests to cover the changes?
-   [ ] **Is it performant?** Are there any obvious performance bottlenecks?
-   [ ] **Is the documentation updated?** (If applicable)

## Responding to Reviews

-   **Ask for clarification** if you don't understand a comment.
-   **Explain your reasoning** if you disagree with a suggestion.
-   **Keep the conversation focused** on the code.

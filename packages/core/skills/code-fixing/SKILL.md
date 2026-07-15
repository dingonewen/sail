# Code Fixing
Description: How to implement code changes safely. Load when writing, editing, or refactoring code.

## Before You Touch Code

1. Read the file you're about to change — understand the existing patterns
2. Check for related tests — `list_files` in test/ directory
3. If reviewer gave findings, address them in severity order

## Making Changes

- Prefer targeted edits (`edit_file`) over full rewrites
- Follow the existing code style — naming, indentation, import style
- Don't introduce new dependencies without a clear reason

## After Each Change

1. Read back the modified file to verify correctness
2. Run `tsc --noEmit` to check for compile errors
3. Run existing tests if available
4. If the change breaks something else, revert and revise

## Communication

Report what you changed and why. If you couldn't fix something, explain the blocker.

# Code Review
Description: How to review code systematically. Load when auditing code for bugs, security, style, or performance.

## Review Checklist

Run `tsc --noEmit` first if TypeScript. Then check in order:

### 1. Correctness
- Null/undefined access
- Off-by-one errors
- Race conditions in async code
- Type mismatches (= instead of ===)
- Missing error handling

### 2. Security
- SQL injection
- XSS in template rendering
- Unsanitized user input
- Hardcoded secrets
- Insecure crypto (Math.random for IDs)

### 3. Performance
- N+1 queries
- Blocking the event loop
- Missing indexes
- Unnecessary allocations in hot paths

### 4. Style
- Matches surrounding code patterns
- Functions have clear single responsibilities
- No dead code or commented-out blocks
- Naming is clear and consistent

## Output Format

Rank findings: **critical** > **high** > **medium** > **low**

For each finding:
- What: the problem
- Where: file + line
- Why: the risk
- Fix: concrete suggestion (do NOT apply — that's the fixer's job)

End with: "Total: X critical, Y high, Z medium, W low"

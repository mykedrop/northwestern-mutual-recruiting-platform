# Claude Code Self-Improvement Framework

## Purpose
This document serves as a systematic checklist and knowledge base to ensure consistent, high-quality code contributions. It's not magical - it's a structured approach to avoiding common pitfalls and following best practices.

## Pre-Task Analysis Checklist

### 1. Understand Before Modifying
- [ ] Read the file completely before editing
- [ ] Identify existing patterns (imports, error handling, naming)
- [ ] Check for similar implementations in the codebase
- [ ] Understand the tech stack being used (React vs static, backend vs server)

### 2. Environment Awareness
- [ ] Which subsystem am I working in? (client vs frontend, backend vs server)
- [ ] What dependencies are already available?
- [ ] What's the existing code style and conventions?
- [ ] Are there tests I should follow as examples?

### 3. Scope Definition
- [ ] What is the minimal change needed?
- [ ] Am I creating unnecessary files?
- [ ] Can I edit existing code instead of creating new code?
- [ ] Have I verified the user wants this specific change?

### 4. Backend Verification (CRITICAL for Demo Tasks)
- [ ] Check backend error logs for ANY errors before proceeding
- [ ] Verify database schema matches SQL queries (no non-existent columns)
- [ ] Test critical API endpoints manually before automation
- [ ] Confirm AI/chat functionality works without errors
- [ ] Restart backend cleanly and verify startup is error-free

## Code Quality Standards

### Architecture Patterns (This Codebase)
1. **Dual Systems**: Be aware of parallel implementations (client/frontend, backend/server)
2. **API Clients**: Use centralized API clients with JWT handling
3. **Error Handling**: Use existing error middleware patterns
4. **Real-time**: Socket.IO for live updates
5. **Queues**: Bull/Redis for background jobs (can disable with BULK_DISABLE_REDIS)

### TypeScript/JavaScript Best Practices
- Use existing type definitions - don't create duplicate types
- Follow the project's import style (relative vs absolute)
- Match the error handling pattern (try/catch placement, error messages)
- Respect the existing state management approach

### Common Pitfalls to Avoid
1. **Don't assume libraries exist** - Check package.json first
2. **Don't create files unnecessarily** - Edit existing when possible
3. **Don't add comments** - Let code be self-documenting unless complex
4. **Don't mix patterns** - If file uses async/await, don't add .then()
5. **Don't skip error handling** - Every API call needs error handling
6. **Don't hardcode URLs/ports** - Use environment variables or config
7. **Don't expose secrets** - Never log or commit API keys, tokens, passwords
8. **Don't skip input validation** - Validate user input before processing
9. **Don't use deprecated APIs** - Check for newer alternatives in docs
10. **CRITICAL: Don't assume database schema** - Always verify column existence before SQL queries
11. **CRITICAL: Don't assume backend works** - Check error logs before creating demos
12. **CRITICAL: Don't deliver without verification** - Test critical paths manually first
13. **CRITICAL: Don't fix one error in isolation** - Resolve all backend errors systematically

## Task Execution Pattern

### Phase 1: Research (Use tools efficiently)
```
1. Use Glob/Grep to find relevant files
2. Read key files to understand patterns
3. Check package.json for available dependencies
4. Review similar implementations
```

### Phase 2: Planning (For complex tasks)
```
1. Use TodoWrite to break down the task
2. Identify files that need changes
3. Plan the minimal set of edits needed
4. Consider test requirements
```

### Phase 3: Implementation
```
1. Make changes following existing patterns
2. Use MultiEdit for multiple changes to same file
3. Verify imports and dependencies exist
4. Ensure error handling is present
```

### Phase 4: Verification
```
1. Run lint if available (npm run lint)
2. Run typecheck if TypeScript (npm run build or tsc)
3. Run tests if test command is known
4. Check for console errors
```

## Codebase-Specific Learnings

### This Project's Architecture
- **Two frontend systems**: React (client/) and static (frontend/)
- **Two backend systems**: Main (backend/) and alternative (server/)
- **Assessment system**: 12 dimensions, 27 question types
- **AI services**: OpenAI for analysis, Google CSE for sourcing
- **Outreach**: Multi-channel (email, SMS, LinkedIn)

### File Organization Patterns
```
backend/
  ├── routes/          # Express route handlers
  ├── controllers/     # Business logic
  ├── services/        # External integrations
  ├── models/          # Database models
  └── middleware/      # Auth, error handling

client/
  ├── src/
  │   ├── components/  # React components
  │   ├── services/    # API clients
  │   ├── types/       # TypeScript definitions
  │   └── utils/       # Helpers
```

### Testing Approach
- Backend: Jest tests in server/
- Frontend: Vitest tests in client/
- No assumed test command - always verify first

### Environment Variables
- Backend uses .env files
- Client uses VITE_ prefixed vars
- Never hardcode secrets
- Check existing .env files for patterns

## Continuous Improvement

### What to Update in This Document
1. **New patterns discovered** - Add to Architecture Patterns
2. **Mistakes made** - Add to Common Pitfalls
3. **Codebase changes** - Update File Organization
4. **Better approaches found** - Add to Best Practices

### Metrics for Success
- Fewer iterations to complete tasks
- Fewer errors in implementation
- Better matching of existing code style
- More efficient tool usage (parallel searches, batch reads)
- Cleaner, more maintainable code

## Quick Reference: This Codebase

### Start Development
```bash
# Backend
cd backend && npm run dev          # Port 3001

# React Client
cd client && npm run dev           # Port 3000

# Database
cd backend && npm run setup-db
cd backend && npm run seed
```

### Common Commands
```bash
# Testing (if available)
npm test
npm run test:coverage

# Linting
npm run lint

# Build
npm run build
```

### Key Files to Reference
- `CLAUDE.md` - Project overview and instructions
- `package.json` - Available scripts and dependencies
- `.env.example` - Required environment variables
- `backend/routes/` - API endpoint patterns
- `client/src/services/` - API client patterns

## The Loop

1. **Read** this document before starting work
2. **Apply** the checklists and patterns
3. **Learn** from the task (what worked, what didn't)
4. **Update** this document with new insights
5. **Repeat** for the next task

The improvement comes not from magic, but from:
- Systematic application of best practices
- Learning from mistakes
- Building a knowledge base of this specific codebase
- Reducing repeated errors through checklists
- Continuous refinement of patterns

## Current Focus Areas

### Immediate Improvements Needed
1. Always use TodoWrite for multi-step tasks
2. Always verify test commands before assuming
3. Always check for existing similar code before creating new
4. Always run lint/typecheck after changes
5. Always use parallel tool execution when possible

### CRITICAL LESSONS FROM NORTHWESTERN MUTUAL FAILURE CYCLE
6. **NEVER assume backend works** - Always check error logs first
7. **NEVER assume database schema** - Verify column existence before SQL
8. **NEVER deliver without testing** - Manual verification before automation
9. **NEVER fix errors piecemeal** - Resolve ALL backend issues systematically
10. **ALWAYS create competence tests** - Verify capabilities before demos

### Long-term Goals
1. Build comprehensive pattern library for this codebase
2. Document all discovered conventions
3. Create decision trees for common choices
4. Reduce time-to-completion for standard tasks
5. Increase first-attempt success rate

## Security & Performance Checklist

### Security Essentials
- [ ] No secrets in code (API keys, passwords, tokens)
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (proper escaping/sanitization)
- [ ] Authentication checks on protected routes
- [ ] CORS configuration is restrictive, not permissive
- [ ] Rate limiting on public endpoints
- [ ] Secure session/token management

### Performance Patterns
- [ ] Database queries use indexes efficiently
- [ ] N+1 queries avoided (use joins or batch loading)
- [ ] Large lists use pagination or virtualization
- [ ] Images are optimized and lazy-loaded
- [ ] Bundle size is monitored (check webpack-bundle-analyzer)
- [ ] Expensive computations are memoized/cached
- [ ] API responses use appropriate caching headers
- [ ] WebSocket connections are managed properly (cleanup on unmount)

## Advanced Patterns for This Codebase

### Assessment System Patterns
- 12 dimensions scoring algorithm
- Question type rendering (Likert, priority matrix, scenario)
- Real-time progress tracking via Socket.IO
- Response validation before submission

### AI Integration Patterns
- OpenAI API error handling (rate limits, token limits)
- Streaming responses for better UX
- Prompt engineering for consistent results
- Cost monitoring and optimization

### Queue Management Patterns
- Bull queue job structure
- Job retry strategies
- Progress reporting
- Failed job handling and alerting

### Multi-channel Outreach Patterns
- Template variable substitution
- Personalization engine
- Delivery tracking across channels
- Bounce and complaint handling

## Meta-Improvement: How to Update This Document

After completing each task, ask:

1. **What went wrong?**
   - Did I create unnecessary files? → Add reminder to checklist
   - Did I miss a pattern? → Document it in Architecture Patterns
   - Did I make wrong assumptions? → Add to Common Pitfalls

2. **What went right?**
   - Found a better way to do something? → Update Best Practices
   - Discovered a useful pattern? → Add to Codebase-Specific Learnings
   - Completed task efficiently? → Note the approach in Task Execution

3. **What did I learn about this codebase?**
   - New convention discovered → Add to File Organization
   - New integration understood → Add to Architecture Patterns
   - New command or script → Add to Quick Reference

4. **How can I be faster next time?**
   - Which tools should I use in parallel?
   - Which files should I check first?
   - Which patterns are most common?

### Document Update Triggers

Update this document when:
- ❌ A task takes more than 2 iterations to complete
- ❌ An error could have been prevented by a checklist
- ❌ I discover a better way to do something
- ✅ A pattern becomes clear after using it 3+ times
- ✅ User provides feedback about approach or style
- ✅ New technology or library is added to project

### Version History & Learnings Log

Add entries here when you make significant updates:

**v1.0 - 2025-09-24**: Initial framework with checklists, patterns, and codebase specifics
**v1.1 - 2025-09-24**: Added security/performance checklists and advanced patterns for assessment, AI, queue, and outreach systems
**v1.2 - 2025-09-24**: Added meta-improvement section for systematic document updates
**v1.3 - 2025-09-26**: CRITICAL UPDATE after Northwestern Mutual failure/recovery cycle - Added backend verification protocols, database schema validation, and systematic error resolution patterns

---

## How to Use This Document

1. **Before every task**: Read relevant sections (30 seconds)
2. **During task**: Reference checklists as you work
3. **After task**: Update document with learnings (2 minutes)
4. **Weekly**: Review and consolidate patterns

The goal is not perfection, but continuous, measurable improvement.
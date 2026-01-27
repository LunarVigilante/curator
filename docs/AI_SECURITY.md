# AI Security & Reliability

## Overview

Curator uses LLMs for metadata enrichment, description generation, and content recommendations. This document outlines the security controls, reliability patterns, and monitoring strategies.

---

## OWASP LLM Top-10 Mapping

| ID | Vulnerability | Curator Defense |
|----|---------------|-----------------|
| LLM01 | Prompt Injection | `sanitizeForPrompt()` strips injection patterns |
| LLM02 | Insecure Output Handling | `validateAIQuery()` blocks dangerous SQL |
| LLM03 | Training Data Poisoning | N/A (using external APIs) |
| LLM04 | Model Denial of Service | Timeout limits, circuit breakers |
| LLM05 | Supply Chain Vulnerabilities | Locked provider versions |
| LLM06 | Sensitive Information Disclosure | Blocked columns in SQL validator |
| LLM07 | Insecure Plugin Design | No plugin execution |
| LLM08 | Excessive Agency | Read-only database access |
| LLM09 | Overreliance | Static fallback responses |
| LLM10 | Model Theft | N/A (using external APIs) |

---

## Architecture

```
User Request
     │
     ▼
┌─────────────────┐
│  AI Logger      │◄─── Anomaly Detection
│  (ai-logger.ts) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Model Router   │◄─── Circuit Breaker
│  (model-router) │     Fallback Chain
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│OpenAI │ │Claude │  ... Providers
└───────┘ └───────┘
```

---

## Security Controls

### 1. Input Sanitization
```typescript
import { sanitizeForPrompt } from '@/lib/ai/sql-validator'

// Strips injection patterns like [INST], </s>, system:
const safeInput = sanitizeForPrompt(userInput)
```

### 2. SQL Query Validation
```typescript
import { validateAIQuery } from '@/lib/ai/sql-validator'

const result = validateAIQuery(aiGeneratedSQL)
if (!result.valid) {
    console.error('Blocked:', result.errors)
}
```

### 3. Read-Only Database Access
AI-generated queries NEVER use the service role key. They use:
- Anon key (RLS enforced)
- Statement timeout (5 seconds)
- Row limit (100 max)

---

## Reliability Patterns

### Circuit Breaker
- Opens after 3 consecutive failures
- Auto-resets after 60 seconds
- Prevents cascade failures

### Priority Fallback
1. OpenRouter (Claude Haiku)
2. OpenAI (GPT-4o-mini)
3. Anthropic (Claude)
4. Static response

### Complexity Routing
| Task | Model |
|------|-------|
| Simple tags | Mistral 7B |
| Descriptions | Claude Haiku |
| Complex analysis | Claude Sonnet |

---

## Monitoring (Axiom)

### Anomaly Detection Queries

**High-Token Prompts (Injection Attempts)**
```kusto
['vercel-logs']
| where _axiom_category == 'ai_request'
| where promptLength > 10000
| summarize count() by bin(_time, 1h)
```

**Failed AI Requests**
```kusto
['vercel-logs']
| where _axiom_category == 'ai_request'
| where success == false
| summarize count() by errorMessage, provider
```

**SQL Keyword Detection**
```kusto
['vercel-logs']
| where _axiom_category == 'ai_request'
| where containsSQLKeywords == true
| project _time, requestType, promptLength
```

**Latency Spikes**
```kusto
['vercel-logs']
| where _axiom_category == 'ai_request'
| summarize avg(latencyMs), p99(latencyMs) by bin(_time, 5m)
```

---

## Trusted Sources

Stay updated with:
- [OWASP LLM Top-10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [Google SAIF](https://safety.google/cybersecurity-advancements/saif/)
- [Anthropic Responsible AI](https://www.anthropic.com/index/responsible-ai)

---

## Secret Management

| Secret | Location | Rotation |
|--------|----------|----------|
| OPENROUTER_API_KEY | Vercel | Quarterly |
| OPENAI_API_KEY | Vercel | Quarterly |
| ANTHROPIC_API_KEY | Vercel | Quarterly |

**Never** hardcode API keys. Use `process.env` only.

---

## Incident Response

If a prompt injection is detected:
1. Log the full request to Axiom
2. Block the user session temporarily
3. Alert via Sentry
4. Review and update sanitization rules

---

Last updated: January 2026

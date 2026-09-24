const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { logger } = require('../utils/logger');

/**
 * Thin wrapper around any OpenAI-compatible chat completions endpoint.
 *
 * Every method returns a *structured* result with `ok: false` when the provider
 * is not configured or unreachable — callers always fall back to the local
 * rule-based engines so the product stays fully functional without an API key.
 */

const callTimeoutMs = () => env.AI_TIMEOUT_MS;

async function chat(messages, { json = true, temperature = 0.3, maxTokens = 700 } = {}) {
  if (!env.isAiConfigured) {
    return { ok: false, reason: 'not_configured', text: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), callTimeoutMs());
  const startedAt = Date.now();

  try {
    const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn(`AI provider responded ${response.status}: ${body.slice(0, 200)}`);
      return { ok: false, reason: response.status === 401 || response.status === 403 ? 'unauthorized' : 'provider_error', text: null };
    }

    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content || null;
    return { ok: Boolean(text), reason: text ? null : 'empty', text, latencyMs: Date.now() - startedAt, model: payload?.model || env.AI_MODEL };
  } catch (error) {
    const reason = error.name === 'AbortError' ? 'timeout' : 'network';
    logger.warn(`AI call failed (${reason}): ${error.message}`);
    return { ok: false, reason, text: null };
  } finally {
    clearTimeout(timer);
  }
}

const safeParseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

/**
 * Suggest a category for a free-text description.
 * @returns {{ok:boolean, categoryName?:string, confidence?:number, reason?:string}}
 */
async function suggestCategory({ description, amount, type, categories, currency = '$' }) {
  const names = categories.map((c) => c.name);
  const result = await chat(
    [
      {
        role: 'system',
        content:
          'You are the categorisation assistant inside a student budgeting app. ' +
          'Pick exactly ONE category from the provided list. Respond with JSON: ' +
          '{"category":"<name from list>","confidence":<0-1>,"reason":"<max 12 words>"}. ' +
          'Never invent categories outside the list.',
      },
      {
        role: 'user',
        content: `Type: ${type}\nAmount: ${currency}${amount}\nDescription: "${description}"\nCategories: ${names.join(', ')}`,
      },
    ],
    { maxTokens: 200 },
  );

  if (!result.ok) return { ok: false, reason: result.reason };

  const parsed = safeParseJson(result.text);
  if (!parsed?.category) return { ok: false, reason: 'unparsable' };

  const match = categories.find((c) => c.name.toLowerCase() === String(parsed.category).toLowerCase().trim());
  if (!match) return { ok: false, reason: 'unknown_category' };

  return {
    ok: true,
    categoryName: match.name,
    categoryId: match._id,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
    reason: String(parsed.reason || '').slice(0, 120),
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

/** Batch variant used by the CSV importer (single cheaper call for many rows). */
async function suggestCategoryBatch({ rows, categories, currency = '$' }) {
  const names = categories.map((c) => c.name);
  const result = await chat(
    [
      {
        role: 'system',
        content:
          'You categorise student expenses from CSV imports. For each input row return one category from the list. ' +
          'Respond with JSON {"results":[{"id":<row id>,"category":"<name>","confidence":<0-1>}]} and nothing else.',
      },
      {
        role: 'user',
        content: `Categories: ${names.join(', ')}\nCurrency: ${currency}\nRows:\n${rows
          .map((r) => `${r.id}. "${r.description}" (${r.type}, ${r.amount})`)
          .join('\n')}`,
      },
    ],
    { maxTokens: 1200 },
  );

  if (!result.ok) return { ok: false, reason: result.reason };
  const parsed = safeParseJson(result.text);
  if (!parsed?.results) return { ok: false, reason: 'unparsable' };

  const byId = new Map();
  parsed.results.forEach((r) => {
    const match = categories.find((c) => c.name.toLowerCase() === String(r.category || '').toLowerCase().trim());
    if (match) byId.set(String(r.id), { categoryName: match.name, categoryId: match._id, confidence: Number(r.confidence) || 0.7 });
  });
  return { ok: true, results: byId, model: result.model };
}

/**
 * Write a plain-language monthly narrative.
 * @returns {{ok:boolean, summary?:string, tips?:string[], highlights?:string[], reason?:string}}
 */
async function monthlyNarrative({ monthLabel, currency, metrics, categoryLines, comparisonLines }) {
  const result = await chat(
    [
      {
        role: 'system',
        content:
          'You are a friendly student money coach. Write a short plain-language monthly summary (max 90 words) about the student\'s own numbers. ' +
          'Be specific and use the provided figures. Then give 2-4 short actionable bullet points and 2-3 highlights. ' +
          'Respond as JSON: {"summary":"...","tips":["..."],"highlights":["..."]}. ' +
          'Never give regulated financial advice; frame everything as suggestions.',
      },
      {
        role: 'user',
        content: [
          `Month: ${monthLabel}`,
          `Currency: ${currency}`,
          `Income: ${currency}${metrics.totalIncome}`,
          `Expenses: ${currency}${metrics.totalExpense}`,
          `Net saved: ${currency}${metrics.netSavings} (${metrics.savingsRate}% of income)`,
          `Transactions: ${metrics.transactionCount}`,
          `Top category: ${metrics.topCategory}`,
          'Category spend:',
          ...categoryLines,
          'Month-over-month comparison:',
          ...comparisonLines,
        ].join('\n'),
      },
    ],
    { maxTokens: 700, temperature: 0.5 },
  );

  if (!result.ok) return { ok: false, reason: result.reason };
  const parsed = safeParseJson(result.text);
  if (!parsed?.summary) return { ok: false, reason: 'unparsable' };
  return {
    ok: true,
    summary: String(parsed.summary).slice(0, 1200),
    tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 4).map(String) : [],
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 3).map(String) : [],
    model: result.model,
  };
}

/** Health probe used by /api/health so the UI can show AI status honestly. */
const status = () => ({
  configured: env.isAiConfigured,
  provider: env.isAiConfigured ? new URL(env.AI_BASE_URL).host : null,
  model: env.isAiConfigured ? env.AI_MODEL : null,
  fallback: 'rule-based engine',
});

/** Small helper for other services that want to surface AI errors politely. */
const ensureAiOrFallback = (reason) => {
  if (['not_configured', 'unauthorized'].includes(reason)) return ApiError.unavailable('AI provider is not configured');
  return ApiError.unavailable('AI provider is temporarily unavailable');
};

module.exports = { chat, suggestCategory, suggestCategoryBatch, monthlyNarrative, status, ensureAiOrFallback, safeParseJson };

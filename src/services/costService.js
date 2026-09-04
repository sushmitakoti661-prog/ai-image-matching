const pool = require("../db/db");

const DEFAULT_BUDGET_LIMIT = parseFloat(process.env.AI_BUDGET_LIMIT_USD || "5.00");

// Estimated pricing per 1M tokens in USD (Gemini Flash baseline)
const MODEL_RATES = {
  "gemini-3.6-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-2.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-2.0-flash": { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "vision-local-dev": { inputPerMillion: 0.05, outputPerMillion: 0.20 },
  "default": { inputPerMillion: 0.075, outputPerMillion: 0.30 }
};

function calculateCost(model, promptTokens, completionTokens) {
  const rates = MODEL_RATES[model] || MODEL_RATES["default"];
  const inputCost = (promptTokens / 1_000_000) * rates.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * rates.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}

async function getTotalSpent() {
  const res = await pool.query(
    "SELECT COALESCE(SUM(estimated_cost_usd), 0)::numeric AS total_spent FROM ai_costs"
  );
  return parseFloat(res.rows[0].total_spent);
}

async function checkBudgetGuard(estimatedNextCost = 0.001) {
  const currentSpent = await getTotalSpent();
  const limit = parseFloat(process.env.AI_BUDGET_LIMIT_USD || DEFAULT_BUDGET_LIMIT);
  
  if (currentSpent + estimatedNextCost > limit) {
    throw new Error(
      `Budget Guard Alert: Cumulative AI spend ($${currentSpent.toFixed(4)}) exceeds or will exceed budget limit of $${limit.toFixed(2)}.`
    );
  }
  return { currentSpent, limit, remaining: limit - currentSpent };
}

async function recordAiCost({
  operation,
  entityType = null,
  entityId = null,
  model = "gemini-3.6-flash",
  promptTokens = 0,
  completionTokens = 0,
  estimatedCostUsd = null
}) {
  const cost = estimatedCostUsd !== null 
    ? estimatedCostUsd 
    : calculateCost(model, promptTokens, completionTokens);

  const res = await pool.query(
    `INSERT INTO ai_costs 
     (operation, entity_type, entity_id, model, prompt_tokens, completion_tokens, estimated_cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [operation, entityType, entityId, model, promptTokens, completionTokens, cost]
  );
  return res.rows[0];
}

async function getCostSummary() {
  const summaryRes = await pool.query(`
    SELECT 
      COUNT(*)::int AS total_calls,
      COALESCE(SUM(prompt_tokens), 0)::int AS total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::int AS total_completion_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::numeric AS total_cost_usd
    FROM ai_costs
  `);

  const perOperationRes = await pool.query(`
    SELECT 
      operation,
      COUNT(*)::int AS calls,
      COALESCE(SUM(estimated_cost_usd), 0)::numeric AS cost_usd
    FROM ai_costs
    GROUP BY operation
    ORDER BY cost_usd DESC
  `);

  const limit = parseFloat(process.env.AI_BUDGET_LIMIT_USD || DEFAULT_BUDGET_LIMIT);
  const totalSpent = parseFloat(summaryRes.rows[0].total_cost_usd);

  return {
    ...summaryRes.rows[0],
    total_cost_usd: totalSpent,
    budget_limit_usd: limit,
    budget_remaining_usd: Math.max(0, limit - totalSpent),
    breakdown_by_operation: perOperationRes.rows
  };
}

module.exports = {
  calculateCost,
  checkBudgetGuard,
  recordAiCost,
  getCostSummary,
  getTotalSpent
};

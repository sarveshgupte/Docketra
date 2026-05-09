const MAX_INPUT_LENGTH = 2000;

const KEYWORDS = {
  immigration: ['visa', 'uscis', 'i-130', 'i-485', 'ead', 'immigration', 'green card'],
  tax: ['irs', 'tax', '1099', 'w2', 'withholding', 'ein', 'filing'],
  compliance: ['compliance', 'audit', 'policy', 'regulation', 'kyc', 'aml'],
  litigation: ['lawsuit', 'court', 'hearing', 'plaintiff', 'defendant', 'complaint'],
  employment: ['employee', 'termination', 'payroll', 'hr', 'benefits', 'onboarding'],
  contract: ['agreement', 'msa', 'nda', 'contract', 'renewal', 'terms'],
};

const normalizeText = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenize = (value = '') => normalizeText(value).split(' ').filter(Boolean);

const scoreFromNameMatch = (targetName, tokens) => {
  const normalized = normalizeText(targetName);
  if (!normalized) return 0;
  const nameTokens = normalized.split(' ').filter(Boolean);
  return nameTokens.reduce((sum, token) => sum + (tokens.includes(token) ? 3 : 0), 0);
};

const scoreFromKeywordGroups = (targetName, text) => {
  const normalizedName = normalizeText(targetName);
  let score = 0;
  Object.entries(KEYWORDS).forEach(([group, words]) => {
    const labelHit = normalizedName.includes(group);
    if (!labelHit) return;
    words.forEach((word) => {
      if (text.includes(normalizeText(word))) score += 2;
    });
  });
  return score;
};

const confidenceFromScore = (score) => {
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
};

const suggestDocketCategory = ({ firmId, title = '', description = '', categories = [] }) => {
  if (!firmId) return { suggestions: [] };
  const safeTitle = String(title).slice(0, MAX_INPUT_LENGTH);
  const safeDescription = String(description).slice(0, MAX_INPUT_LENGTH);
  const fullText = normalizeText(`${safeTitle} ${safeDescription}`);
  const tokens = tokenize(fullText);
  if (tokens.length < 3) return { suggestions: [] };

  const scored = [];
  categories.forEach((category) => {
    if (!category?.isActive) return;
    const categoryScore = scoreFromNameMatch(category.name, tokens) + scoreFromKeywordGroups(category.name, fullText);
    const subScored = (category.subcategories || [])
      .filter((sub) => sub?.isActive)
      .map((sub) => {
        const score = scoreFromNameMatch(sub.name, tokens) + scoreFromKeywordGroups(sub.name, fullText);
        return {
          categoryId: String(category._id),
          categoryName: category.name,
          subcategoryId: String(sub.id),
          subcategoryName: sub.name,
          score: score + categoryScore,
        };
      });
    scored.push(...subScored);
  });

  const suggestions = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({ ...item, confidence: confidenceFromScore(item.score) }));

  return { suggestions };
};

module.exports = {
  suggestDocketCategory,
  normalizeText,
  confidenceFromScore,
};

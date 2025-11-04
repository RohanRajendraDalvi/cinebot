const BACKEND_BASE_URL =
  import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

function buildMongoFilters(rowChecker = {}) {
  const andClauses = [];

  if (rowChecker.min_year || rowChecker.max_year) {
    const cond = {};
    if (rowChecker.min_year) cond.$gte = rowChecker.min_year;
    if (rowChecker.max_year) cond.$lte = rowChecker.max_year;
    andClauses.push({ year: cond });
  }

  if (rowChecker.min_rating || rowChecker.max_rating) {
    const cond = {};
    if (rowChecker.min_rating) cond.$gte = rowChecker.min_rating;
    if (rowChecker.max_rating) cond.$lte = rowChecker.max_rating;
    andClauses.push({ rating: cond });
  }

  if (rowChecker.required_genres?.length)
    andClauses.push({ genres: { $in: rowChecker.required_genres } });
  if (rowChecker.excluded_genres?.length)
    andClauses.push({ genres: { $nin: rowChecker.excluded_genres } });
  if (rowChecker.required_languages?.length)
    andClauses.push({ languages: { $in: rowChecker.required_languages } });
  if (rowChecker.excluded_languages?.length)
    andClauses.push({ languages: { $nin: rowChecker.excluded_languages } });

  return andClauses.length ? { $and: andClauses } : {};
}

export default async function mongoVectorSearch({
  query_text = '',
  limit = 10,
  row_checker = {},
} = {}) {
  if (!query_text.trim()) throw new Error('query_text is required');

  const filters = buildMongoFilters(row_checker);

  const payload = { query: query_text, filters, limit };

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);

    return await res.json();
  } catch (err) {
    console.error('mongoVectorSearch error:', err);
    return { results: [], error: err.message };
  }
}

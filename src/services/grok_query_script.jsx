const BACKEND_BASE_URL =
  import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

export default async function runGroqQuery(user_input) {
  // Helper to produce a safe fallback string the rest of the app can parse
  const buildFallback = () => {
    let text = '';
    try {
      if (Array.isArray(user_input)) {
        const lastUser = [...user_input].reverse().find(m => m?.role === 'user');
        text = lastUser?.content || (user_input[user_input.length - 1]?.content || '');
      } else if (typeof user_input === 'string') {
        text = user_input;
      }
    } catch {}
    return JSON.stringify({
      positive_query: text || '',
      negative_query: '',
      row_checker: { required_genres: [] },
    });
  };

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/run-groq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_input }),
    });

    if (!res.ok) {
      // Use client-side fallback rather than returning null
      return buildFallback();
    }

    const data = await res.json();
    if (data?.response) return data.response;
    return buildFallback();
  } catch (err) {
    console.error('Error querying GROQ:', err);
    return buildFallback();
  }
}

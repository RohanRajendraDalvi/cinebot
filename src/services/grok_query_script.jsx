const runGroqQuery = async (messages) => {
    try {
        const response = await fetch('http://localhost:5000/run-groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.response;
    } catch (error) {
        console.error('Error querying Groq:', error);
        return null;
    }
};

export default runGroqQuery;

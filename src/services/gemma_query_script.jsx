const runLocalGemmaQuery = async (messages, model = 'gemma2:2b') => {
    try {
        const response = await fetch('http://localhost:5000/run-local-gemma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model }) // explicitly include model
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Response from local Gemma:', result);

        return result.response || null;
    } catch (error) {
        console.error('Error querying local Gemma (Ollama):', error);
        return null;
    }
};

export default runLocalGemmaQuery;

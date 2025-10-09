const handleChromaQuery = async (query, filter = null, size = 1) => {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = new URL('http://localhost:5000/run-query');
        url.searchParams.append('query', encodedQuery);
        url.searchParams.append('size', size);

        if (filter) {
            const encodedFilter = encodeURIComponent(JSON.stringify(filter));
            url.searchParams.append('filter', encodedFilter);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
};

export default handleChromaQuery;

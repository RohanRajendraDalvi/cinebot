import React, { useState, useEffect } from 'react';
import './index.css';
import Navbar from '../Navbar';
import runGroqQuery from '../services/grok_query_script';
import ChatBox from './ChatBox';
import SavedChats from './SavedChats';
import UserInput from './UserInput';
import RightSidebar from './RightSidebar';
import mongoVectorSearch from '../services/mongo_query_script';

function ChatPage() {
  const default_start_of_chat = [
    { role: 'assistant', content: 'Hello, What type of movie would you like to watch today?' }
  ];

  const [savedChats, setSavedChats] = useState([]);
  const [currentChatIndex, setCurrentChatIndex] = useState(null);
  const [dialogList, setDialogList] = useState(default_start_of_chat);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [topK, setTopK] = useState(10);
  
  


  useEffect(() => {
    // On first load, initialize the first chat
    if (savedChats.length === 0) {
      setSavedChats([default_start_of_chat]);
      setCurrentChatIndex(0);
    }
  }, []);

  const updateCurrentChat = (newDialogList) => {
    const updatedChats = [...savedChats];
    updatedChats[currentChatIndex] = newDialogList;
    setSavedChats(updatedChats);
  };

  const extractJsonFromText = (text) => {
    if (typeof text !== 'string') return text; // guard against null/objects
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (!match) return text;
  
    try {
      // Basic cleanup: remove trailing commas and extra closing braces
      let cleaned = match[1]
        .replace(/,\s*}/g, '}')      // Remove trailing comma before }
        .replace(/,\s*]/g, ']')      // Remove trailing comma before ]
        .trim();
  
      // Optional: try to safely parse to catch remaining JSON errors
      JSON.parse(cleaned); // throws if invalid
      return cleaned;
    } catch (e) {
      console.warn('Failed to sanitize JSON:', e);
      return text;
    }
  };
  
  
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const userMessageProcess = async (userInput) => {
    try {
      setIsLoading(true);
      setLoadingMessage('Processing your request...');
      console.log('User input:', userInput);

      // Add new user message to the dialog history (used in LLM context)
      const updatedDialog = [...dialogList, { role: 'user', content: userInput }];

      // Step 1: Use LLM to generate a refined query object with filters (using full context)
      const queryDialog = [
        ...dialogList,
        { 
          role: 'system',
          content:
            `Today's date is ${today}.\n` +
            'If the user asks something other than movies promptly ask the user to rephrase the question and ask for movie recommendations.\n'+
            'You are an assistant that takes a movie-related user prompt and extracts:\n' +
            '1. A positive_query: A string with words related what the user wants actors, places, themes plots etc. ( do not mention any actual movie and do not leave empty).\n' +
            '2. A negative_query: A string describing actors or themes the user wants to avoid.\n' +
            '3. A row_checker object that may include any of the following optional filters (do not put too many restrictions, only what user asked for):\n' +
            '   - min_year (integer)\n' +
            '   - max_year (integer)\n' +
            '   - min_rating (float)\n' +
            '   - max_rating (float)\n' +
            '   - min_duration (integer, in minutes)\n' +
            '   - max_duration (integer, in minutes)\n' +
            '   - required_genres (list of strings)\n' +
            '   - excluded_genres (list of strings)\n' +
            '   - required_languages (list of strings)\n' +
            '   - excluded_languages (list of strings)\n' +
            'If the prompt is asking for movie recommendation return ONLY a valid JSON object with keys: positive_query, negative_query, row_checker.\n',
        },
        { role: 'user', content: userInput },
      ];

      setLoadingMessage('Generating query parameters...');
      const promptForQueryParams = await runGroqQuery(queryDialog)
    
      console.log('Prompt for query params:', promptForQueryParams);

      // Extract JSON from response
      const cleanJson = extractJsonFromText(promptForQueryParams);
      console.log('Extracted JSON:', cleanJson);
      let queryParams;
      try {
        queryParams = JSON.parse(cleanJson);
        console.log('Parsed query params:', queryParams);
        if(queryParams?.positive_query === '' || !queryParams?.positive_query ) {
          throw new Error('Empty positive query');
        }
      } catch (parseError) {
        setLoadingMessage('Error parsing query parameters. Please try again.');
        console.warn('Could not parse query params JSON. Probably not a recommendation query.');
        const assistantReply = {
          role: 'assistant',
          content:
            cleanJson || 'Sorry, I couldn’t understand your request. Can you rephrase it as a movie recommendation?',
        };
        const fallbackDialog = [...updatedDialog, assistantReply];
        setDialogList(fallbackDialog);
        updateCurrentChat(fallbackDialog);
        setUserInput('');
        setIsLoading(false);

        return;
      }
      setLoadingMessage('Query parameters generated successfully!');

      // Save dialog update with use input
      setDialogList(updatedDialog);
      updateCurrentChat(updatedDialog);
      setUserInput('');

      setLoadingMessage('Running vector search...');
      // Step 2: Run vector search with the generated parameters
      const searchResponse = await mongoVectorSearch({
        query_text: queryParams.positive_query,
        negative_query: queryParams.negative_query || '',
        limit: topK,
        row_checker: queryParams.row_checker || {}
      });
      

      setLoadingMessage('Vector search completed!');
      console.log('Search response:', searchResponse);
      const movieCandidates = searchResponse?.results || [];

      // Helper: local fallback recommendation when LLM not available
      const makeLocalRecommendations = (cands, n = 3) => {
        if (!Array.isArray(cands) || cands.length === 0) {
          return 'I could not find matching movies. Try adjusting your filters or rephrasing your request.';
        }

        // Prefer by score desc; fallback to rating desc; then title asc
        const sorted = [...cands].sort((a, b) => {
          const sa = typeof a.score === 'number' ? a.score : -Infinity;
          const sb = typeof b.score === 'number' ? b.score : -Infinity;
          if (sa !== sb) return sb - sa;
          const ra = typeof a.rating === 'number' ? a.rating : -Infinity;
          const rb = typeof b.rating === 'number' ? b.rating : -Infinity;
          if (ra !== rb) return rb - ra;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });

        const top = sorted.slice(0, n);
        const fmt = (s = '', maxWords = 40) => {
          const words = String(s).split(/\s+/).filter(Boolean);
          return words.length > maxWords ? words.slice(0, maxWords).join(' ') + '…' : words.join(' ');
        };

        const lines = top.map((m, idx) => {
          const title = m.title || 'Untitled';
          const year = m.year ? ` (${m.year})` : '';
          const genres = Array.isArray(m.genres) ? m.genres.join(', ') : (m.genres || '');
          const rating = m.rating != null ? ` | Rating: ${m.rating}` : '';
          const lang = Array.isArray(m.languages) ? m.languages.join(', ') : (m.languages || '');
          const desc = fmt(m.description || '');
          const imdb = m.id ? ` [IMDb](https://www.imdb.com/title/${m.id}/)` : '';
          const meta = [genres, lang].filter(Boolean).join(' • ');
          const metaLine = meta ? ` (${meta})` : '';
          return `- ${idx + 1}. **${title}${year}**${imdb}${rating}${metaLine}\n  ${desc}`;
        });

        return `Here are my top ${Math.min(n, top.length)} picks based on your request:\n\n${lines.join('\n')}`;
      };

      // Step 3: Ask the LLM to pick the most suitable movies from the list (with full context)
      const refineDialog = [
        {
          role: 'system',
          content:
            'You are a movie assistant. Based on the user\'s original prompt, evaluate the following list of movie candidates and suggest the most suitable ones ranked by relevance.\n' +
            'Respond with a list of up to 3 recommended titles, with short justification for each, generate the response utilzaing markdown, insert links for imdb from meta data.',
        },
        ...updatedDialog,
        {
          role: 'system',
          content: 'Here are the candidate movies: ' + JSON.stringify(movieCandidates)+'suggest 3 movies from the list, with detailed information to the end user based on above query.',
        },
      ];
      setLoadingMessage('Generating refined movie selection...');
  const promptToRefineSelection = await runGroqQuery(refineDialog)
      
      // If LLM unavailable or returned a JSON-looking fallback, synthesize a local recommendation
      let refinedContent = promptToRefineSelection;
      const looksLikeJson = typeof refinedContent === 'string' && refinedContent.trim().startsWith('{');
      if (!refinedContent || looksLikeJson) {
        refinedContent = makeLocalRecommendations(movieCandidates, 3);
      }

      // Step 4: Display final assistant reply
      const finalDialog = [
        ...updatedDialog,
        { role: 'assistant', content: refinedContent },
      ];
      setLoadingMessage('Generating final response...');
      setIsLoading(false);
      setDialogList(finalDialog);
      updateCurrentChat(finalDialog);

    } catch (error) {
      setIsLoading(false);
      setLoadingMessage('Error processing your request. Please try again.');
      console.error('Error in userMessageProcess:', error);
    }

  };

  const handleModelChange = (_modelChoice) => {};

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      userMessageProcess(userInput);
    }
  };

  const handleNewChat = () => {
    // Handle new chat here
  };

  const loadChat = (chatIndex) => {
    setCurrentChatIndex(chatIndex);
    setDialogList(savedChats[chatIndex]);
  };

  return (
    <div className="chat-page">
      <Navbar />
      <div className='row'>
        <div className="col-2">
          <div className="toprow">
            <h3>Saved Chats</h3>
          </div>
          <div className="saved-chats-section">
            <SavedChats savedChats={savedChats} loadChat={loadChat} handleNewChat={handleNewChat} />
          </div>
        </div>
        <div className="col-7">
          <div className="chatbox-section">
            <ChatBox dialogList={dialogList} loadingMessage={loadingMessage} isLoading={isLoading} />
            <UserInput
              userInput={userInput}
              handleInputChange={handleInputChange}
              handleKeyPress={handleKeyPress}
            />
          </div>
        </div>
        <div className="col-3">

        <RightSidebar
            onModelChange={handleModelChange}
            topK={topK}
            setTopK={setTopK}
          />

        </div>
      </div>
    </div>
  );
}

export default ChatPage;

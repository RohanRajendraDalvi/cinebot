import React, { useState, useEffect } from 'react';
import './index.css';
import Navbar from '../Navbar';
import handleChromaQuery from '../services/choma_query_service';
import handleAdvancedQuerySearch from '../services/faiss_advanced_query1';
import runGroqQuery from '../services/grok_query_script';
import ChatBox from './ChatBox';
import SavedChats from './SavedChats';
import UserInput from './UserInput';
import RightSidebar from './RightSidebar'; // Import RightSidebar
import runLocalGemmaQuery from '../services/gemma_query_script'; // Import runLocalGemmaQuery

function ChatPage() {
  const default_start_of_chat = [
    { role: 'assistant', content: 'Hello, What type of movie would you like to watch today?' }
  ];

  const [savedChats, setSavedChats] = useState([]);
  const [currentChatIndex, setCurrentChatIndex] = useState(null);
  const [dialogList, setDialogList] = useState(default_start_of_chat);
  const [userInput, setUserInput] = useState('');
  const [modelChoice, setModelChoice] = useState('1'); // Store selected model choice
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [useGroqModel, setUseGroqModel] = useState(true); // true = use Groq, false = use Ollama
  const [useModel, setUseModel] = useState('gemma2:2b'); // default local model name
  const [alpha, setAlpha] = useState(1.0);
  const [beta, setBeta] = useState(1.0);
  const [topK, setTopK] = useState(10);
  const [searchBatchSize, setSearchBatchSize] = useState(200);
  


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
      const promptForQueryParams = useGroqModel
      ? await runGroqQuery(queryDialog)
      : await runLocalGemmaQuery(queryDialog, useModel);
    
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
      const searchResponse = await handleAdvancedQuerySearch({
        ...queryParams,
        top_k: topK,
        search_batch_size: searchBatchSize,
        alpha,
        beta,
        model_choice: modelChoice,
      });
      

      setLoadingMessage('Vector search completed!');
      console.log('Search response:', searchResponse);
      const movieCandidates = searchResponse?.results || [];

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
      const promptToRefineSelection = useGroqModel
      ? await runGroqQuery(refineDialog)
      : await runLocalGemmaQuery(refineDialog, useModel);
    
      // Step 4: Display final assistant reply
      const finalDialog = [
        ...updatedDialog,
        { role: 'assistant', content: promptToRefineSelection },
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

  const handleModelChange = (modelChoice) => {
    setModelChoice(modelChoice); // Update selected model choice
  };

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
            useGroqModel={useGroqModel}
            setUseGroqModel={setUseGroqModel}
            useModel={useModel}
            setUseModel={setUseModel}
            alpha={alpha}
            setAlpha={setAlpha}
            beta={beta}
            setBeta={setBeta}
            topK={topK}
            setTopK={setTopK}
            searchBatchSize={searchBatchSize}
            setSearchBatchSize={setSearchBatchSize}
          />

        </div>
      </div>
    </div>
  );
}

export default ChatPage;

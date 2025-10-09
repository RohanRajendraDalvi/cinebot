import React from "react";
import './../index.css';
import ChatDialogue from './ChatDialogue'; // Import the ChatDialogue component if needed
import LoadingAnimation from './LoadingAnimation'; // Import the LoadingAnimation component if needed
function ChatBox({ dialogList , isLoading, loadingMessage }) {

  return (

    <div className="chatbot-container">
    {dialogList.map((dialog, index) => (
      <ChatDialogue key={index} dialog={dialog} />   
    ))}
    <LoadingAnimation isLoading={isLoading} loadingMessage={loadingMessage} />
  </div>
  

  );
}

export default ChatBox;
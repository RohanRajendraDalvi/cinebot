import React from "react";
import './index.css';  // Assuming you want to import the same CSS file
import './../index.css';  // Ensure this import is necessary or just keep one

function SavedChats({ savedChats, loadChat, handleNewChat }) {
  return (
    <div className="saved-chats-container">
      {/* Optional Heading */}
      {/* <h3 className="saved-chats-heading">Saved Chats</h3> */}
      <button onClick={handleNewChat} className="new-chat-btn">New Chat</button>

      <div className="chat-list">
        {savedChats.map((chat, index) => {
          const userMessage = chat.find((msg) => msg.role === 'user')?.content || `Chat ${index + 1}`;
          const trimmedMessage = userMessage.length > 40
            ? userMessage.slice(0, 40) + '...'
            : userMessage;

          return (
            <button
              key={index}
              onClick={() => loadChat(index)}
              className="saved-chat-btn"
              title={userMessage}
            >
              {trimmedMessage}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SavedChats;

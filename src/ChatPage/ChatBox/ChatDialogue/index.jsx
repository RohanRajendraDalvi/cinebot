import React from "react";
import ReactMarkdown from "react-markdown"; 
import './index.css';
import './../../index.css';

function ChatDialogue({ dialog, index }) {
  if (dialog.role === 'system') return null;

  const displayRole = dialog.role === 'user' ? 'User' : 'Cine-Bot';
  const alignment = dialog.role === 'user' ? 'card-right' : 'card-left';

  return (
    <div className={`card ${alignment}`} key={index}>
      <div className="card-body">
        <h5 className="card-title">{displayRole}</h5>
        <div className="card-text markdown-body">
          <ReactMarkdown>{dialog.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default ChatDialogue;

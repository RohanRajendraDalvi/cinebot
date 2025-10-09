import React from "react";

import './index.css';
import './../index.css';

function UserInput({ userInput, handleInputChange, handleKeyPress }) {
    return(
        <div className="user-input-container">
            <input 
                type="text" 
                value={userInput} 
                onChange={handleInputChange} 
                onKeyPress={handleKeyPress} 
                placeholder="Type your message here..."
                className="user-input"
            />
            <button 
                onClick={() => handleKeyPress({ key: 'Enter' })} 
                className="send-btn"
            >Send</button>
        </div>
    );
}

export default UserInput;
import React from 'react';

import './index.css';

function RightSidebar({ onModelChange, topK, setTopK }) {
  return (
    <div className="right-sidebar">
      <h3>Search Settings</h3>
      <label>Top K: {topK}</label>
      <input
        type="range"
        min="5"
        max="10"
        step="1"
        value={topK}
        onChange={(e) => setTopK(parseInt(e.target.value))}
      />
    </div>
  );
}

export default RightSidebar;

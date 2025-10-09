import React, { useState } from 'react';

import './index.css'; // Import your CSS file for styling

function RightSidebar({   onModelChange,
  useGroqModel,
  setUseGroqModel,
  useModel,
  setUseModel,
  alpha, setAlpha,
  beta, setBeta,
  topK, setTopK,
  searchBatchSize, setSearchBatchSize }) {
  const [selectedModel, setSelectedModel] = useState('1');


  // Handles model choice for vector DB embeddings (1–6)
  const handleModelChange = (event) => {
    const selected = event.target.value;
    setSelectedModel(selected);
    onModelChange(selected);
  };

  // Toggle between LLM providers (Groq or Ollama)
  const handleGroqModelChange = (event) => {
    const value = event.target.value === 'true';
    setUseGroqModel(value);
  };

  // Handles Ollama model selection (only visible when Groq is off)
  const handleLocalModelChange = (event) => {
    const selected = event.target.value;
    setUseModel(selected);
  };

  return (
    <div className="right-sidebar">
      <h3>Advanced Parameters</h3>
        <label>Alpha: {alpha}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={alpha}
          onChange={(e) => setAlpha(parseFloat(e.target.value))}
        />

        <label>Beta: {beta}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={beta}
          onChange={(e) => setBeta(parseFloat(e.target.value))}
        />

        <label>Top K: {topK}</label>
        <input
          type="range"
          min="5"
          max="10"
          step="1"
          value={topK}
          onChange={(e) => setTopK(parseInt(e.target.value))}
        />

        <label>Search Batch Size: {searchBatchSize}</label>
        <input
          type="range"
          min="100"
          max="200"
          step="10"
          value={searchBatchSize}
          onChange={(e) => setSearchBatchSize(parseInt(e.target.value))}
        />

      <h3>Vector Model Selection</h3>
      <select value={selectedModel} onChange={handleModelChange}>

        <option value="1">Model 1 (multi-qa-MiniLM-L6-cos-v1)</option>
        <option value="2">Model 2 (all-MiniLM-L6-v2)</option>
        <option value="3">Model 3 (all-distilroberta-v1)</option>
        <option value="4">Model 4 (distilbert-base-nli-stsb-mean-tokens)</option>
        <option value="5">Model 5 (all-MiniLM-L12-v2)</option>
        <option value="6">ChromaDB (all-MiniLM-L6-v2)</option>
      </select>

      <h3>Select LLM Provider</h3>
      <select value={useGroqModel.toString()} onChange={handleGroqModelChange}>
        <option value="true">Groq - LLama</option>
        <option value="false">Ollama - Gemma</option>
      </select>

      {!useGroqModel && (
        <>
          <h4>Select Local Ollama Model</h4>
          <select value={useModel} onChange={handleLocalModelChange}>
            <option value="gemma2:2b">gemma2:2b</option>
            <option value="gemma2-finetuned">gemma2-finetuned</option>
            <option value="gemma:2b">gemma:2b (original)</option>
            {/* Add more if needed */}
          </select>
        </>
      )}
    </div>
  );
}

export default RightSidebar;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IntroPage from './IntroPage/IntroPage';
import Documentation from './Documentation/Documentation';
import AboutUs from './AboutUs/AboutUs';
import ChatPage from './ChatPage';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<IntroPage />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/chatpage" element={<ChatPage />} />
          <Route path="/documentation" element={<Documentation />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

import React from 'react';
import { Link } from 'react-router-dom';
import favicon from './assets/favicon.png';

function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light" style={{ borderBottom: '2px solid #7D7D7D', marginBottom: '10px' }}>
      <Link className="navbar-brand" to="/" style={{ marginLeft: '10px' }}>
        <img src={favicon} alt="CineBot Logo" style={{ marginRight: '5px' }} height="30" />  
        <b>CineBot</b>
      </Link>
      <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
        <span className="navbar-toggler-icon"></span>
      </button>
      <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
        <div className="navbar-nav">
          <Link className="nav-item nav-link" to="/documentation" style={{ color: 'black', fontSize: '18px' }}>Documentation</Link>
          <Link className="nav-item nav-link" to="/about" style={{ color: 'black', fontSize: '18px' }}>About Us</Link>
          <Link className="nav-item nav-link" to="/chatpage" style={{ color: 'black', fontSize: '18px' }}>Chatbot</Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

import React from 'react';
import './Documentation.css';
import Navbar from '../Navbar';

function Documentation() {
  return (
    <>
      <Navbar />
      <div className="row documentation-page">
        <div className="col-2 left-border"></div>
        <div className="col-8 content">
          <h1 className='heading'>Documentation</h1>
        </div>
        <div className="col-2 right-border"></div>
      </div>
    </>
  );
}

export default Documentation;

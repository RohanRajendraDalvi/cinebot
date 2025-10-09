import React from 'react';
import './AboutUs.css';
import Navbar from '../Navbar';

function AboutUs() {
  return (
    <>
      <Navbar />
      <div className="row aboutUs-page">
        <div className="col-2 left-border"></div>
        <div className="col-8 content">
          <h1 className='heading'>About Us</h1>
        </div>
        <div className="col-2 right-border"></div>
      </div>
    </>
  );
}

export default AboutUs;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import splitStringUsingRegex from '../splitStringUsingRegex';
import './IntroPage.css'; 

const greeting = "Hi, I am CineBot";

function IntroPage() {
  const navigate = useNavigate(); // Get access to the navigate function
  const greetingChars = splitStringUsingRegex(greeting);

  const animationVariants = {
    hidden: { opacity: 0 },
    visible: (i) => ({
      opacity: 1,
      transition: {
        delay: i * 0.10 // Delays each letter reveal
      }
    })
  };

  // Function to handle button click
  const handleButtonClick = () => {
    navigate('/chatpage'); // Navigate to /chatpage
  };

  return (
    <div className="page-container"> 
      <div className="content-center"> 
        <div className="heading">
          <motion.h1 className="greeting"> 
            {greetingChars.map((char, index) => (
              <motion.span
                key={index}
                variants={animationVariants}
                initial="hidden"
                animate="visible"
                custom={index}
              >
                {char}
              </motion.span>
            ))}
          </motion.h1>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={handleButtonClick}>Let's Chat!</button>
      </div>
    </div>
  );
}

export default IntroPage;

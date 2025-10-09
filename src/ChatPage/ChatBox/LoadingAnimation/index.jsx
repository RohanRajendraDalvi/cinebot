import React from 'react';
import './index.css';

const LoadingAnimation = ({isLoading, loadingMessage}) => {
    if (!isLoading) return null;
    else {
        return (
            <div className="loading-animation-container">
                <div className="loading-animation">
                    <div className="spinner"></div>
                    <p>{loadingMessage}</p>
                </div>
            </div>
        );
    }
};

export default LoadingAnimation;
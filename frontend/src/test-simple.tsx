import React from 'react';
import ReactDOM from 'react-dom/client';

const SimpleTest = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: 'red', color: 'white' }}>
      <h1>Simple Test - If you see this, React is working!</h1>
      <p>Current time: {new Date().toLocaleString()}</p>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SimpleTest />
  </React.StrictMode>,
);
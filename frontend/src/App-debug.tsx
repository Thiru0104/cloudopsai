import React from 'react';

function App() {
  console.log('App component is rendering');
  
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>Debug App - Basic Rendering Test</h1>
      <p style={{ color: '#666' }}>If you can see this, React is working!</p>
      <p style={{ color: '#666' }}>Current time: {new Date().toLocaleString()}</p>
      
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#e8f4fd', 
        border: '1px solid #b3d9ff',
        borderRadius: '5px'
      }}>
        <h2 style={{ color: '#0066cc', margin: '0 0 10px 0' }}>System Status</h2>
        <p style={{ margin: '5px 0', color: '#333' }}>✅ React: Working</p>
        <p style={{ margin: '5px 0', color: '#333' }}>✅ TypeScript: Working</p>
        <p style={{ margin: '5px 0', color: '#333' }}>✅ Vite: Working</p>
      </div>
    </div>
  );
}

export default App;
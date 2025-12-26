// Test script to debug export functionality
const testExport = async () => {
  try {
    console.log('Testing export functionality...');
    
    const exportData = {
      selectedSubscription: '0a519345-d9f4-400c-a3b4-e8379de6638e',
      selectedNSGs: ['nsgtesting01', 'nsgtesting02'],
      format: 'enhanced_csv',
      resourceType: 'nsg',
      selectedASGs: [],
      separateColumns: true,
      includeRuleDetails: true,
      includeASGMapping: true
    };
    
    console.log('Export data:', JSON.stringify(exportData, null, 2));
    
    const response = await fetch('http://localhost:8000/api/v1/backup/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(exportData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const jsonData = await response.json();
      console.log('JSON Response:', jsonData);
    } else {
      const blob = await response.blob();
      console.log('Blob size:', blob.size);
      console.log('Blob type:', blob.type);
      
      // Check if it's a ZIP file
      if (blob.type === 'application/zip' || blob.size > 0) {
        console.log('✅ ZIP file received successfully!');
        
        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        console.log('Content-Disposition:', contentDisposition);
        
        let filename = 'export.zip';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        console.log('Filename:', filename);
      } else {
        console.log('❌ No valid file received');
      }
    }
    
  } catch (error) {
    console.error('Export test failed:', error);
  }
};

// Run the test
testExport();
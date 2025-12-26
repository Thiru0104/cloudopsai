import React, { useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Upload, 
  FileText, 
  ArrowLeftRight, 
  AlertTriangle,
  Edit3,
  Save,
  Download
} from 'lucide-react';

const GoldenRulePage: React.FC = () => {
  // State for file comparison
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [sourceData, setSourceData] = useState<any>(null);
  const [targetData, setTargetData] = useState<any>(null);
  const [fileComparisonResult, setFileComparisonResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // State for editing functionality
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editedTargetData, setEditedTargetData] = useState<any>(null);
  const [selectedDifference, setSelectedDifference] = useState<number | null>(null);
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(new Set());

  const handleSourceFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSourceFile(file);
      loadFileData(file, setSourceData);
    }
  };

  const handleTargetFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setTargetFile(file);
      loadFileData(file, setTargetData);
    }
  };

  const loadFileData = async (file: File, setData: (data: any) => void) => {
    try {
      setLoading(true);
      const text = await file.text();
      let data;
      
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',');
        data = lines.slice(1).map(line => {
          const values = line.split(',');
          const row: any = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim() || '';
          });
          return row;
        });
      }
      
      setData(data);
      toast.success('File loaded successfully');
    } catch (error) {
      console.error('Failed to parse file:', error);
      toast.error('Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const compareFiles = () => {
    if (!sourceData || !targetData) {
      toast.error('Please upload both source and target files');
      return;
    }
    
    if (!sourceFile || !targetFile) {
      toast.error('Files not found');
      return;
    }
    
    // Check if files are same format
    const sourceExt = sourceFile.name.split('.').pop()?.toLowerCase();
    const targetExt = targetFile.name.split('.').pop()?.toLowerCase();
    
    if (sourceExt !== targetExt) {
      toast.error('Files must be in the same format (JSON->JSON or CSV->CSV)');
      return;
    }
    
    // Perform comparison based on file type
    let differences = [];
    
    if (sourceExt === 'json') {
      differences = compareJsonData(sourceData, targetData);
    } else if (sourceExt === 'csv') {
      differences = compareCsvData(sourceData, targetData);
    }
    
    const result = {
      format: sourceExt,
      sourceFile: sourceFile.name,
      targetFile: targetFile.name,
      differences,
      totalDifferences: differences.length
    };
    
    setFileComparisonResult(result);
    setEditedTargetData(JSON.parse(JSON.stringify(targetData))); // Deep copy
    toast.success(`Found ${differences.length} differences`);
  };

  const compareJsonData = (source: any, target: any): any[] => {
    const differences: any[] = [];
    
    // Find added keys (in target but not in source)
    const findDifferences = (sourceObj: any, targetObj: any, path = '') => {
      if (typeof sourceObj !== 'object' || typeof targetObj !== 'object') {
        if (sourceObj !== targetObj) {
          differences.push({
            type: 'different',
            key: path || 'root',
            sourceValue: sourceObj,
            targetValue: targetObj
          });
        }
        return;
      }
      
      // Check for added keys in target
      Object.keys(targetObj).forEach(key => {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in sourceObj)) {
          differences.push({
            type: 'extra',
            key: newPath,
            targetValue: targetObj[key]
          });
        } else {
          findDifferences(sourceObj[key], targetObj[key], newPath);
        }
      });
      
      // Check for removed keys (in source but not in target)
      Object.keys(sourceObj).forEach(key => {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in targetObj)) {
          differences.push({
            type: 'missing',
            key: newPath,
            sourceValue: sourceObj[key]
          });
        }
      });
    };
    
    findDifferences(source, target);
    return differences;
  };

  const compareCsvData = (source: any[], target: any[]): any[] => {
    const differences: any[] = [];
    
    // Compare row counts
    if (source.length !== target.length) {
      differences.push({
        type: 'different',
        field: 'Row Count',
        sourceValue: source.length,
        targetValue: target.length
      });
    }
    
    // Compare each row
    const maxRows = Math.max(source.length, target.length);
    
    for (let i = 0; i < maxRows; i++) {
      const sourceRow = source[i];
      const targetRow = target[i];
      
      if (!sourceRow) {
        differences.push({
          type: 'extra',
          rowIndex: i,
          field: `Row ${i + 1}`,
          targetValue: targetRow
        });
        continue;
      }
      
      if (!targetRow) {
        differences.push({
          type: 'missing',
          rowIndex: i,
          field: `Row ${i + 1}`,
          sourceValue: sourceRow
        });
        continue;
      }
      
      // Compare fields in each row
      const allKeys = new Set([...Object.keys(sourceRow), ...Object.keys(targetRow)]);
      
      allKeys.forEach(key => {
        if (sourceRow[key] !== targetRow[key]) {
          differences.push({
            type: 'different',
            rowIndex: i,
            field: key,
            sourceValue: sourceRow[key],
            targetValue: targetRow[key]
          });
        }
      });
    }
    
    return differences;
  };

  const getDifferenceColor = (type: string) => {
    switch (type) {
      case 'added':
      case 'extra':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'removed':
      case 'missing':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'modified':
      case 'different':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const handleDifferenceClick = (index: number, difference: any) => {
    setSelectedDifference(index);
    
    // Highlight the relevant lines/rows
    if (difference.rowIndex !== undefined) {
      setHighlightedLines(new Set([difference.rowIndex]));
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      // Save changes
      setTargetData(editedTargetData);
      toast.success('Changes saved successfully');
    }
    setEditMode(!editMode);
  };

  const handleEditChange = (rowIndex: number, field: string, value: string) => {
    if (!editedTargetData) return;
    
    const newData = [...editedTargetData];
    newData[rowIndex] = { ...newData[rowIndex], [field]: value };
    setEditedTargetData(newData);
  };

  const exportToCSV = () => {
    if (!fileComparisonResult) return;
    
    const data = editMode ? editedTargetData : targetData;
    
    if (fileComparisonResult.format === 'json') {
      // Convert JSON to CSV format
      const flattenObject = (obj: any, prefix = ''): any => {
        const flattened: any = {};
        Object.keys(obj).forEach(key => {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(flattened, flattenObject(obj[key], newKey));
          } else {
            flattened[newKey] = obj[key];
          }
        });
        return flattened;
      };
      
      const flattened = flattenObject(data);
      const headers = Object.keys(flattened);
      const csvContent = [
        headers.join(','),
        headers.map(header => flattened[header]).join(',')
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileComparisonResult.targetFile.replace(/\.[^/.]+$/, '')}_modified.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Already CSV format
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map((row: any) => headers.map(header => row[header] || '').join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileComparisonResult.targetFile.replace(/\.[^/.]+$/, '')}_modified.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    toast.success('File exported successfully');
  };

  const renderEditableContent = (data: any, isEditable: boolean) => {
    if (!data) return <div className="text-gray-500">No data</div>;
    
    if (Array.isArray(data)) {
      // CSV data (array of objects)
      return (
        <div className="space-y-2">
          {data.map((row, rowIndex) => {
            const isHighlighted = highlightedLines.has(rowIndex);
            return (
              <div 
                key={rowIndex} 
                className={`p-2 border rounded text-xs ${
                  isHighlighted ? getDifferenceColor('different') : 'bg-white border-gray-200'
                }`}
              >
                <div className="font-medium text-gray-600 mb-1">Row {rowIndex + 1}</div>
                {Object.entries(row).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-700 w-20 truncate">{key}:</span>
                    {isEditable ? (
                      <input
                        type="text"
                        value={String(value)}
                        onChange={(e) => handleEditChange(rowIndex, key, e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                      />
                    ) : (
                      <span className="flex-1 text-gray-800">{String(value)}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    } else {
      // JSON data (object)
      return (
        <div className="space-y-1">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 text-xs">
              <span className="font-medium text-gray-700 w-24 truncate">{key}:</span>
              {isEditable && typeof value === 'string' ? (
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => {
                    const newData = { ...editedTargetData, [key]: e.target.value };
                    setEditedTargetData(newData);
                  }}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                />
              ) : (
                <span className="flex-1 text-gray-800">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Golden Rule</h1>
          <p className="text-gray-600 mb-6">
            Compare files side-by-side with detailed difference highlighting and inline editing capabilities
          </p>
        </div>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Source File */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Source File
              </h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleSourceFileUpload}
                  className="hidden"
                  id="source-file-upload"
                />
                <label htmlFor="source-file-upload" className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload source file
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports JSON and CSV formats
                  </p>
                  {sourceFile && (
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800 font-medium">
                        {sourceFile.name}
                      </p>
                      <p className="text-xs text-blue-600">
                        {sourceFile.size} bytes
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Target File */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Target File
              </h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleTargetFileUpload}
                  className="hidden"
                  id="target-file-upload"
                />
                <label htmlFor="target-file-upload" className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload target file
                  </p>
                  <p className="text-xs text-gray-500">
                    Must match source file format
                  </p>
                  {targetFile && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800 font-medium">
                        {targetFile.name}
                      </p>
                      <p className="text-xs text-green-600">
                        {targetFile.size} bytes
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Compare Button */}
          <div className="text-center">
            <button
              onClick={compareFiles}
              disabled={!sourceData || !targetData || loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              <ArrowLeftRight className="w-5 h-5" />
              {loading ? 'Processing...' : 'Compare Files'}
            </button>
          </div>

          {/* Side-by-Side Comparison Results */}
          {fileComparisonResult && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900">File Comparison Results</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">
                    Format: <span className="font-medium uppercase">{fileComparisonResult.format}</span>
                  </span>
                  <span className="text-gray-600">
                    Differences: <span className="font-medium text-red-600">{fileComparisonResult.totalDifferences}</span>
                  </span>
                </div>
              </div>

              {/* Control Panel */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-medium text-gray-900">Comparison Results</h3>
                    <span className="text-sm text-gray-600">
                      {fileComparisonResult.totalDifferences} differences found
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleEditMode}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editMode 
                          ? 'bg-green-600 text-white hover:bg-green-700' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {editMode ? (
                        <><Save className="h-4 w-4" /> Save Changes</>
                      ) : (
                        <><Edit3 className="h-4 w-4" /> Edit Mode</>
                      )}
                    </button>
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Three-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Differences Panel */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Differences ({fileComparisonResult.totalDifferences})
                  </h3>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {fileComparisonResult.differences.map((diff: any, index: number) => (
                      <div
                        key={index}
                        onClick={() => handleDifferenceClick(index, diff)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedDifference === index
                            ? getDifferenceColor(diff.type)
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          {diff.type === 'missing' ? 'Missing' : 
                           diff.type === 'different' ? 'Different' : 
                           diff.type === 'extra' ? 'Extra' : 'Changed'}
                          {diff.rowIndex !== undefined && ` (Row ${diff.rowIndex + 1})`}
                        </div>
                        <div className="text-xs text-gray-800">
                          <div className="font-medium">{diff.field || diff.key}</div>
                          {diff.sourceValue !== undefined && (
                            <div className="text-red-600">Source: {JSON.stringify(diff.sourceValue)}</div>
                          )}
                          {diff.targetValue !== undefined && (
                            <div className="text-green-600">Target: {JSON.stringify(diff.targetValue)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source File Display */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-gray-900">{fileComparisonResult.sourceFile}</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {fileComparisonResult.format.toUpperCase()}
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto border border-gray-100 rounded p-3 bg-gray-50">
                    {renderEditableContent(sourceData, false)}
                  </div>
                </div>

                {/* Target File Display */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-green-600" />
                    <h3 className="font-medium text-gray-900">{fileComparisonResult.targetFile}</h3>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {fileComparisonResult.format.toUpperCase()}
                    </span>
                    {editMode && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        EDITING
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto border border-gray-100 rounded p-3 bg-gray-50">
                    {renderEditableContent(editMode ? editedTargetData : targetData, editMode)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State for File Comparison */}
          {!fileComparisonResult && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <ArrowLeftRight className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Compare Files</h3>
                <p className="text-gray-500 mb-4">
                  Upload both source and target files to see a detailed side-by-side comparison with highlighted differences.
                </p>
                <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-200 rounded"></div>
                    <span>Added</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-200 rounded"></div>
                    <span>Removed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-200 rounded"></div>
                    <span>Modified</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoldenRulePage;

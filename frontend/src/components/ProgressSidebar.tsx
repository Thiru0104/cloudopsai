import React, { useState } from 'react';
import { X, Activity, CheckCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useProgress, ProgressItem } from '../contexts/ProgressContext';

interface ProgressSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProgressSidebar: React.FC<ProgressSidebarProps> = ({ isOpen, onClose }) => {
  const { progressItems } = useProgress();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const getStatusIcon = (status: ProgressItem['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: ProgressItem['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date();
    const duration = Math.floor((endTime.getTime() - start.getTime()) / 1000);
    if (duration < 60) return `${duration}s`;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Progress Monitor</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/70 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      {/* Progress Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {progressItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No operations in progress</p>
          </div>
        ) : (
          progressItems.map((item) => (
            <Card
              key={item.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedItem === item.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(item.status)}
                    <CardTitle className="text-sm">{item.title}</CardTitle>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(item.status)}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-slate-600">{item.description}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {/* Progress Bar */}
                {item.progress !== undefined && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Progress</span>
                      <span>{item.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Details */}
                {item.details && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-2">
                    {item.details.rulesProcessed !== undefined && (
                      <div>Rules: {item.details.rulesProcessed}/{item.details.totalRules}</div>
                    )}
                    {item.details.nsgsCreated !== undefined && (
                      <div>NSGs: {item.details.nsgsCreated}</div>
                    )}
                  </div>
                )}

                {/* Duration */}
                <div className="text-xs text-slate-500">
                  Duration: {formatDuration(item.startTime, item.endTime)}
                </div>

                {/* Expanded Logs */}
                {selectedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Operation Logs</h4>
                    <div className="bg-slate-50 rounded-lg p-2 max-h-40 overflow-y-auto">
                      {item.logs.map((log, index) => (
                        <div key={index} className="text-xs text-slate-600 py-1 font-mono">
                          <span className="text-slate-400 mr-2">{String(index + 1).padStart(2, '0')}:</span>
                          {log}
                        </div>
                      ))}
                    </div>
                    {item.details?.errors && item.details.errors.length > 0 && (
                      <div className="mt-2">
                        <h5 className="text-xs font-semibold text-red-700 mb-1">Errors</h5>
                        <div className="bg-red-50 rounded-lg p-2">
                          {item.details.errors.map((error, index) => (
                            <div key={index} className="text-xs text-red-600 py-1">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ProgressSidebar;
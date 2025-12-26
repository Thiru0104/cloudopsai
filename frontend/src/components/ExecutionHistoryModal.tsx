import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, AlertTriangle, Play, Square, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { apiClient, apiConfig } from '../config/api';

interface AgentExecution {
  id: number;
  execution_id: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  started_at: string;
  completed_at?: string;
  execution_time?: number;
  input_data?: any;
  output_data?: any;
  error_message?: string;
  progress_percentage: number;
  current_step?: string;
  tokens_used: number;
  cost_estimate: number;
}

interface ExecutionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: number | null;
  agentName?: string;
}

const ExecutionHistoryModal: React.FC<ExecutionHistoryModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName
}) => {
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<AgentExecution | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen && agentId) {
      fetchExecutionHistory();
    }
  }, [isOpen, agentId]);

  const fetchExecutionHistory = async () => {
    if (!agentId) return;
    
    try {
      setLoading(true);
      const data = await apiClient.get(`${apiConfig.endpoints.agents}/${agentId}/executions`);
      setExecutions(data);
    } catch (error) {
      console.error('Error fetching execution history:', error);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'stopped':
        return <Square className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'stopped':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleViewDetails = (execution: AgentExecution) => {
    setSelectedExecution(execution);
    setShowDetails(true);
  };

  if (showDetails && selectedExecution) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getStatusIcon(selectedExecution.status)}
              Execution Details - {selectedExecution.execution_id}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 overflow-y-auto">
            {/* Execution Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Status</div>
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedExecution.status)}`}>
                  {selectedExecution.status}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Duration</div>
                <div className="font-medium">{formatDuration(selectedExecution.execution_time)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Tokens Used</div>
                <div className="font-medium">{selectedExecution.tokens_used.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Cost</div>
                <div className="font-medium">${selectedExecution.cost_estimate.toFixed(4)}</div>
              </div>
            </div>

            {/* Progress */}
            {selectedExecution.status === 'running' && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">Progress</span>
                  <span className="text-sm text-blue-600">{selectedExecution.progress_percentage}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${selectedExecution.progress_percentage}%` }}
                  ></div>
                </div>
                {selectedExecution.current_step && (
                  <div className="text-sm text-blue-700 mt-2">
                    Current Step: {selectedExecution.current_step}
                  </div>
                )}
              </div>
            )}

            {/* Input Data */}
            {selectedExecution.input_data && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Input Data</h4>
                <pre className="bg-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(selectedExecution.input_data, null, 2)}
                </pre>
              </div>
            )}

            {/* Output Data */}
            {selectedExecution.output_data && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Output Data</h4>
                <pre className="bg-gray-100 p-3 rounded-lg text-sm overflow-x-auto max-h-64">
                  {JSON.stringify(selectedExecution.output_data, null, 2)}
                </pre>
              </div>
            )}

            {/* Error Message */}
            {selectedExecution.error_message && (
              <div>
                <h4 className="font-medium text-red-900 mb-2">Error Message</h4>
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-800">
                  {selectedExecution.error_message}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => setShowDetails(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back to History
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Execution History - {agentName || `Agent ${agentId}`}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading execution history...</span>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No execution history found for this agent.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Execution ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {executions.map((execution) => (
                    <tr key={execution.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {execution.execution_id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(execution.status)}
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                            {execution.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(execution.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(execution.execution_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {execution.tokens_used.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${execution.cost_estimate.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(execution)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExecutionHistoryModal;
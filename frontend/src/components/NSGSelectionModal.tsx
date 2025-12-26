import React, { useState, useEffect } from 'react';
import { X, Search, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { apiClient, apiConfig } from '../config/api';

interface NSG {
  id: number;
  name: string;
  resource_group: string;
  region: string;
  status: 'active' | 'inactive';
  rules_count: number;
  last_modified: string;
}

interface NSGSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (selectedNSGIds: number[]) => void;
  agentId: number | null;
  preSelectedNSGNames?: string[];
}

const NSGSelectionModal: React.FC<NSGSelectionModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  agentId,
  preSelectedNSGNames = []
}) => {
  const [nsgs, setNsgs] = useState<NSG[]>([]);
  const [selectedNSGs, setSelectedNSGs] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch real NSG data from API
  const fetchNSGs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(apiConfig.endpoints.nsgs);
      
      // Transform backend data to match component interface
      // Handle both direct array and object response with nsgs property
      const nsgsList = Array.isArray(data) ? data : (data.nsgs || []);
      
      const transformedNSGs = nsgsList.map((nsg: any) => ({
        id: nsg.id,
        name: nsg.name,
        resource_group: nsg.resource_group,
        region: nsg.region,
        status: nsg.provisioning_state === 'Succeeded' ? 'active' : 'inactive',
        rules_count: (nsg.inbound_rules?.length || 0) + (nsg.outbound_rules?.length || 0),
        last_modified: nsg.updated_at ? new Date(nsg.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
      
      setNsgs(transformedNSGs);
    } catch (error) {
      console.error('Error fetching NSGs:', error);
      // Fallback to empty array on error
      setNsgs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNSGs();
    }
  }, [isOpen]);

  // Initialize selection from preSelectedNSGNames when NSGs are loaded
  useEffect(() => {
    if (isOpen && nsgs.length > 0 && preSelectedNSGNames.length > 0) {
      const ids = nsgs
        .filter(nsg => preSelectedNSGNames.includes(nsg.name))
        .map(nsg => nsg.id);
      setSelectedNSGs(prev => {
        // Only update if different to avoid loops (though check is simple)
        // Or just merge with existing if any? 
        // For now, let's just set it, assuming this runs once per open/fetch
        return ids;
      });
    } else if (isOpen && nsgs.length > 0 && (!preSelectedNSGNames || preSelectedNSGNames.length === 0)) {
       // Optional: clear selection if no pre-selection passed? 
       // Or keep it? Let's keep it empty if nothing passed.
       // But user might have selected something manually if this runs late?
       // Better to only run this when modal opens.
    }
  }, [nsgs, isOpen]); // removed preSelectedNSGNames from dependency to avoid re-trigger if it changes outside (it shouldn't)

  const filteredNSGs = nsgs.filter(nsg =>
    nsg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nsg.resource_group.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nsg.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNSGToggle = (nsgId: number) => {
    setSelectedNSGs(prev => 
      prev.includes(nsgId)
        ? prev.filter(id => id !== nsgId)
        : [...prev, nsgId]
    );
  };

  const handleSelectAll = () => {
    const activeNSGs = filteredNSGs.filter(nsg => nsg.status === 'active');
    if (selectedNSGs.length === activeNSGs.length) {
      setSelectedNSGs([]);
    } else {
      setSelectedNSGs(activeNSGs.map(nsg => nsg.id));
    }
  };

  const handleExecute = () => {
    onExecute(selectedNSGs);
    setSelectedNSGs([]);
    setSearchTerm('');
  };

  const handleClose = () => {
    setSelectedNSGs([]);
    setSearchTerm('');
    onClose();
  };

  const getStatusIcon = (status: string) => {
    return status === 'active' 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select NSGs for Validation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search and Select All */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search NSGs by name, resource group, or region..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50"
            >
              {selectedNSGs.length === filteredNSGs.filter(nsg => nsg.status === 'active').length ? 'Deselect All' : 'Select All Active'}
            </button>
          </div>

          {/* NSG List */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="col-span-1">Select</div>
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Resource Group</div>
                <div className="col-span-2">Region</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1">Rules</div>
                <div className="col-span-2">Last Modified</div>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading NSGs...</span>
                </div>
              ) : filteredNSGs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No NSGs found matching your search criteria.
                </div>
              ) : (
                filteredNSGs.map((nsg) => (
                  <div
                    key={nsg.id}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 border-b hover:bg-gray-50 ${
                      nsg.status === 'inactive' ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedNSGs.includes(nsg.id)}
                        onChange={() => handleNSGToggle(nsg.id)}
                        disabled={nsg.status === 'inactive'}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-3 flex items-center">
                      <Shield className="w-4 h-4 text-blue-500 mr-2" />
                      <span className="font-medium text-gray-900">{nsg.name}</span>
                    </div>
                    <div className="col-span-2 flex items-center text-sm text-gray-600">
                      {nsg.resource_group}
                    </div>
                    <div className="col-span-2 flex items-center text-sm text-gray-600">
                      {nsg.region}
                    </div>
                    <div className="col-span-1 flex items-center">
                      {getStatusIcon(nsg.status)}
                      <span className={`ml-1 text-xs ${
                        nsg.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {nsg.status}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center text-sm text-gray-600">
                      {nsg.rules_count}
                    </div>
                    <div className="col-span-2 flex items-center text-sm text-gray-600">
                      {new Date(nsg.last_modified).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selection Summary */}
          {selectedNSGs.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-800">
                  {selectedNSGs.length} NSG{selectedNSGs.length !== 1 ? 's' : ''} selected for validation
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={selectedNSGs.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Execute Validation ({selectedNSGs.length})
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NSGSelectionModal;
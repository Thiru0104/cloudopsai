import React, { useState, useEffect } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { apiClient } from '../config/api';

interface Subscription {
  subscription_id: string;
  display_name: string;
  state: string;
}

interface ResourceGroup {
  name: string;
  id: string;
  location: string;
  subscription_id: string;
}

interface Location {
  name: string;
  display_name: string;
  subscription_id: string;
}

interface NSG {
  id: string;
  name: string;
  resource_group: string;
  location: string;
  subscription_id: string;
}

interface FilterComponentProps {
  selectedSubscription: string;
  selectedResourceGroup: string;
  selectedLocation: string;
  selectedNSG: string;
  selectedNSGs?: string[];
  onFilterChange: (filters: {
    selectedSubscription: string;
    selectedResourceGroup: string;
    selectedLocation: string;
    selectedNSG: string;
    selectedNSGs?: string[];
  }) => void;
  showLocationSelector?: boolean;
  showNSGSelector?: boolean;
  className?: string;
  multipleNSGSelection?: boolean;
}

const FilterComponent: React.FC<FilterComponentProps> = ({
  selectedSubscription,
  selectedResourceGroup,
  selectedLocation,
  selectedNSG,
  selectedNSGs = [],
  onFilterChange,
  showLocationSelector = false,
  showNSGSelector = false,
  className = '',
  multipleNSGSelection = false
}) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [nsgs, setNSGs] = useState<NSG[]>([]);
  
  const [subscriptionsLoading, setSubscriptionsLoading] = useState<boolean>(false);
  const [resourceGroupsLoading, setResourceGroupsLoading] = useState<boolean>(false);
  const [locationsLoading, setLocationsLoading] = useState<boolean>(false);
  const [nsgsLoading, setNSGsLoading] = useState<boolean>(false);

  // API functions
  const fetchSubscriptions = async (): Promise<Subscription[]> => {
    try {
      const data = await apiClient.get('/api/v1/subscriptions');
      // Ensure data exists and has subscriptions array
      if (!data || !Array.isArray(data.subscriptions)) {
        console.warn('Invalid subscriptions response:', data);
        return [];
      }
      // Map backend response to frontend interface
      return data.subscriptions.map((sub: any) => ({
        subscription_id: sub.id || '',
        display_name: sub.name || sub.display_name || 'Unknown',
        state: sub.state || 'Unknown'
      }));
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      return [];
    }
  };

  const fetchResourceGroups = async (subscriptionId: string): Promise<ResourceGroup[]> => {
    try {
      const data = await apiClient.get('/api/v1/resource-groups', { subscription_id: subscriptionId });
      if (!data || !Array.isArray(data.resource_groups)) {
        console.warn('Invalid resource groups response:', data);
        return [];
      }
      return data.resource_groups;
    } catch (error) {
      console.error('Error fetching resource groups:', error);
      return [];
    }
  };

  const fetchLocations = async (subscriptionId: string): Promise<Location[]> => {
    try {
      const data = await apiClient.get('/api/v1/locations', { subscription_id: subscriptionId });
      if (!data || !Array.isArray(data.locations)) {
        console.warn('Invalid locations response:', data);
        return [];
      }
      return data.locations;
    } catch (error) {
      console.error('Error fetching locations:', error);
      return [];
    }
  };

  const fetchNSGs = async (subscriptionId: string, resourceGroupName?: string, region?: string): Promise<NSG[]> => {
    try {
      const params: Record<string, string> = { subscription_id: subscriptionId };
      if (resourceGroupName) {
        params.resource_group = resourceGroupName;
      }
      if (region) {
        params.region = region;
      }
      const data = await apiClient.get('/api/v1/nsgs', params);
      if (!data || !Array.isArray(data.nsgs)) {
        console.warn('Invalid NSGs response:', data);
        return [];
      }
      return data.nsgs;
    } catch (error) {
      console.error('Error fetching NSGs:', error);
      return [];
    }
  };

  // Load subscriptions on component mount
  useEffect(() => {
    const loadSubscriptions = async () => {
      setSubscriptionsLoading(true);
      try {
        const subs = await fetchSubscriptions();
        setSubscriptions(subs);
      } catch (error) {
        console.error('Failed to load subscriptions:', error);
        // Set empty array on error to prevent infinite loading
        setSubscriptions([]);
      } finally {
        setSubscriptionsLoading(false);
      }
    };

    loadSubscriptions();
  }, []);

  // Load resource groups and locations when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      const loadData = async () => {
        setResourceGroupsLoading(true);
        setLocationsLoading(true);
        if (showNSGSelector) setNSGsLoading(true);
        
        try {
          const [rgs, locs] = await Promise.all([
            fetchResourceGroups(selectedSubscription),
            showLocationSelector ? fetchLocations(selectedSubscription) : Promise.resolve([])
          ]);
          
          setResourceGroups(rgs);
          if (showLocationSelector) setLocations(locs);

          if (showNSGSelector) {
            // If we're loading NSGs here, we only filter by subscription as other filters are just reset/loading
            const nsgList = await fetchNSGs(selectedSubscription);
            setNSGs(nsgList);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
          // Set empty arrays on error to prevent infinite loading
          setResourceGroups([]);
          if (showLocationSelector) setLocations([]);
          if (showNSGSelector) setNSGs([]);
        } finally {
          setResourceGroupsLoading(false);
          setLocationsLoading(false);
          if (showNSGSelector) setNSGsLoading(false);
        }
      };

      loadData();
    }
  }, [selectedSubscription, showLocationSelector, showNSGSelector]);

  // Load NSGs when resource group or location changes
  useEffect(() => {
    if (selectedSubscription && showNSGSelector) {
      const loadNSGs = async () => {
        setNSGsLoading(true);
        try {
          // We pass undefined if the value is empty string so it doesn't get sent as filter if not selected
          const nsgList = await fetchNSGs(
            selectedSubscription, 
            selectedResourceGroup || undefined,
            selectedLocation || undefined
          );
          setNSGs(nsgList);
        } catch (error) {
          console.error('Error fetching NSGs:', error);
          // Set empty array on error to prevent infinite loading
          setNSGs([]);
        } finally {
          setNSGsLoading(false);
        }
      };

      loadNSGs();
    }
  }, [selectedResourceGroup, selectedLocation, selectedSubscription, showNSGSelector]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-${showNSGSelector ? '4' : showLocationSelector ? '3' : '2'} gap-4 ${className}`}>
      {/* Subscription Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Subscription
        </label>
        <div className="relative">
          <select
            value={selectedSubscription}
            onChange={(e) => onFilterChange({
              selectedSubscription: e.target.value,
              selectedResourceGroup: '',
              selectedLocation: '',
              selectedNSG: ''
            })}
            className="w-full appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={subscriptionsLoading}
          >
            <option value="">Select subscription</option>
            {subscriptions.map((sub) => (
              <option key={sub.subscription_id} value={sub.subscription_id}>
                {sub.display_name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            {subscriptionsLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Resource Group Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Resource Group
        </label>
        <div className="relative">
          <select
            value={selectedResourceGroup}
            onChange={(e) => onFilterChange({
              selectedSubscription,
              selectedResourceGroup: e.target.value,
              selectedLocation,
              selectedNSG: ''
            })}
            className="w-full appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={!selectedSubscription || resourceGroupsLoading}
          >
            <option value="">All resource groups</option>
            {resourceGroups.map((rg) => (
              <option key={rg.name} value={rg.name}>
                {rg.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            {resourceGroupsLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Location Selector */}
      {showLocationSelector && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Region
          </label>
          <div className="relative">
            <select
              value={selectedLocation}
              onChange={(e) => onFilterChange({
                selectedSubscription,
                selectedResourceGroup,
                selectedLocation: e.target.value,
                selectedNSG
              })}
              className="w-full appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!selectedSubscription || locationsLoading}
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.display_name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              {locationsLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* NSG Selector */}
      {showNSGSelector && (
        <div className={multipleNSGSelection ? "col-span-full" : ""}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Network Security Groups {multipleNSGSelection && selectedNSGs.length > 0 && `(${selectedNSGs.length} selected)`}
          </label>
          {multipleNSGSelection ? (
            <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto bg-white">
              {nsgsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                  <span className="text-sm text-gray-500">Loading NSGs...</span>
                </div>
              ) : nsgs.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">No NSGs available</div>
              ) : (
                <div className="space-y-2">
                  {nsgs.map((nsg) => (
                    <label key={nsg.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedNSGs.includes(nsg.name)}
                        onChange={(e) => {
                          const newSelectedNSGs = e.target.checked
                            ? [...selectedNSGs, nsg.name]
                            : selectedNSGs.filter(name => name !== nsg.name);
                          onFilterChange({
                            selectedSubscription,
                            selectedResourceGroup,
                            selectedLocation,
                            selectedNSG: newSelectedNSGs.length === 1 ? newSelectedNSGs[0] : '',
                            selectedNSGs: newSelectedNSGs
                          });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={!selectedSubscription}
                      />
                      <span className="text-sm text-gray-700">{nsg.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedNSG}
                onChange={(e) => onFilterChange({
                  selectedSubscription,
                  selectedResourceGroup,
                  selectedLocation,
                  selectedNSG: e.target.value
                })}
                className="w-full appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!selectedSubscription || nsgsLoading}
              >
                <option value="">Select NSGs</option>
                {nsgs.map((nsg) => (
                  <option key={nsg.id} value={nsg.name}>
                    {nsg.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                {nsgsLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterComponent;
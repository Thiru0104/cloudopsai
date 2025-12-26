// API Configuration
// Prefer relative URLs during local development to leverage Vite proxy and avoid CORS issues
const API_BASE_URL = (import.meta.env.DEV)
  ? ''
  : (import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || '');

export const apiConfig = {
  baseURL: API_BASE_URL,
  endpoints: {
    login: '/api/v1/login/access-token',
    health: '/api/v1/health',
    subscriptions: '/api/v1/subscriptions',
    resourceGroups: '/api/v1/resource-groups',
    locations: '/api/v1/locations',
    nsgs: '/api/v1/nsgs',
    routeTables: '/api/v1/route-tables',
    agents: '/api/v1/agents',
    users: '/api/v1/users/'
  }
}

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string, params?: Record<string, string>) => {
  let url = `${apiConfig.baseURL}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }
  
  return url;
};

// API client with error handling and timeout
export const apiClient = {
  async get(endpoint: string, params?: Record<string, string>) {
    const url = buildApiUrl(endpoint, params);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers: headers
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }

        // For validation errors, try to get the response body
        if (response.status === 422) {
          try {
            const errorData = await response.json();
            console.error('🔍 422 Validation Error Response:', errorData);
            const error = new Error(`HTTP error! status: ${response.status}`);
            (error as any).response = { status: response.status, data: errorData };
            throw error;
          } catch (jsonError) {
            console.error('Failed to parse 422 error response:', jsonError);
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`API request timeout for ${url}`);
        throw new Error('Request timeout - please check your connection');
      }
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  },
  
  async post(endpoint: string, data?: any) {
    const url = buildApiUrl(endpoint);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: headers,
        body: data ? JSON.stringify(data) : undefined,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Try to parse JSON error from server to surface meaningful messages
        if (response.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }

        try {
          const errorData = await response.json();
          const error = new Error(
            (errorData && (errorData.message || errorData.error)) || `HTTP error! status: ${response.status}`
          );
          (error as any).response = { status: response.status, data: errorData };
          throw error;
        } catch (jsonError) {
          // Fallback to generic error when body isn't JSON
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`API request timeout for ${url}`);
        throw new Error('Request timeout - please check your connection');
      }
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  },
  
  async put(endpoint: string, data?: any) {
    const url = buildApiUrl(endpoint);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'PUT',
        signal: controller.signal,
        headers: headers,
        body: data ? JSON.stringify(data) : undefined,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        try {
          const errorData = await response.json();
          const error = new Error(
            (errorData && (errorData.message || errorData.error)) || `HTTP error! status: ${response.status}`
          );
          (error as any).response = { status: response.status, data: errorData };
          throw error;
        } catch (jsonError) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  },

  async delete(endpoint: string) {
    const url = buildApiUrl(endpoint);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'DELETE',
        signal: controller.signal,
        headers: headers
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        try {
          const errorData = await response.json();
          const error = new Error(
            (errorData && (errorData.message || errorData.error)) || `HTTP error! status: ${response.status}`
          );
          (error as any).response = { status: response.status, data: errorData };
          throw error;
        } catch (jsonError) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  },
  
  async postForm(endpoint: string, formData: FormData) {
    const url = buildApiUrl(endpoint);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        body: formData,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        try {
          const errorData = await response.json();
          const error = new Error(
            (errorData && (errorData.message || errorData.detail || errorData.error)) || `HTTP error! status: ${response.status}`
          );
          (error as any).response = { status: response.status, data: errorData };
          throw error;
        } catch (jsonError) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }
};
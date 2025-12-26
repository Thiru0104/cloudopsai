import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  Shield, 
  Network, 
  Globe, 
  Layers, 
  Mail, 
  Calendar, 
  Download, 
  Settings,
  Users,
  Clock,
  Send,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Activity,
  Plus,
  Eye,
  Server,
  TrendingUp,
  PieChart
} from 'lucide-react';
import FilterComponent from '../components/FilterComponent';
import { apiClient } from '../config/api';
import JSZip from 'jszip';

interface EmailSchedule {
  id: string;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  emails: string[];
  enabled: boolean;
  lastSent?: string;
  nextSend?: string;
  monthlyDate?: number;
  timeOfDay?: string;
  status?: 'active' | 'paused' | 'failed';
  successCount?: number;
  failureCount?: number;
  lastError?: string;
}

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('asg-validation');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastGeneratedReport, setLastGeneratedReport] = useState<any>(null);
  
  // Selection filters using FilterComponent pattern
  const [selectedSubscription, setSelectedSubscription] = useState('');
  const [selectedResourceGroup, setSelectedResourceGroup] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedNSG, setSelectedNSG] = useState('');
  const [selectedNSGs, setSelectedNSGs] = useState<string[]>([]);
  
  // Handle filter changes from FilterComponent
  const handleFilterChange = (filters: {
    selectedSubscription: string;
    selectedResourceGroup: string;
    selectedLocation: string;
    selectedNSG: string;
    selectedNSGs?: string[];
  }) => {
    setSelectedSubscription(filters.selectedSubscription);
    setSelectedResourceGroup(filters.selectedResourceGroup);
    setSelectedLocation(filters.selectedLocation);
    setSelectedNSG(filters.selectedNSG);
    setSelectedNSGs(filters.selectedNSGs || []);
  };

  const [emailSchedules, setEmailSchedules] = useState<EmailSchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<EmailSchedule | null>(null);
  const [showScheduleEmailModal, setShowScheduleEmailModal] = useState(false);
  const [scheduleEmailData, setScheduleEmailData] = useState({ 
    reportType: '', 
    emails: [''], 
    frequency: 'daily',
    timeOfDay: '09:00',
    monthlyDate: 1,
    weeklyDay: 'monday'
  });
  const [isSchedulingEmail, setIsSchedulingEmail] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Load email schedules when component mounts
  useEffect(() => {
    fetchEmailSchedules();
  }, []);

  const generateReport = async (reportType: string) => {
    try {
      if (!selectedSubscription) {
        alert('Please select a subscription before generating the report.');
        return;
      }
      
      setIsGenerating(true);
      
      const reportName = reportTabs.find(tab => tab.id === reportType)?.name || reportType;
      
      // Map frontend report types to backend API endpoints
      const apiEndpoints: { [key: string]: string } = {
        'asg-validation': '/api/v1/reports/asg-validation',
        'nsg-rules': '/api/v1/reports/nsg-rules',
        'ip-limitations': '/api/v1/reports/ip-limitations',
        'nsg-ports': '/api/v1/reports/nsg-ports',
        'consolidation': '/api/v1/reports/consolidation'
      };
      
      const endpoint = apiEndpoints[reportType];
      if (!endpoint) {
        throw new Error(`Unknown report type: ${reportType}`);
      }
      
      // Prepare request data
      const requestData = {
        subscription_id: selectedSubscription,
        resource_group: selectedResourceGroup || '',
        nsg_names: selectedNSGs.length > 0 ? selectedNSGs : (selectedNSG ? [selectedNSG] : [])
      };
      
      // Call the backend API
      const result = await apiClient.post(endpoint, requestData);
      
      console.log('=== Report Generation Debug ===');
      console.log('Backend response:', result);
      console.log('Result success:', result.success);
      console.log('Result data:', result.data);
      console.log('Result data has csv_headers:', !!result.data?.csv_headers);
      console.log('Result data has csv_data:', !!result.data?.csv_data);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate report');
      }
      
      const reportToStore = {
        type: reportType,
        data: result.data,
        timestamp: result.generated_at || new Date().toISOString(),
        filters: {
          subscription: selectedSubscription,
          resourceGroup: selectedResourceGroup,
          location: selectedLocation,
          nsg: selectedNSG,
          nsgs: selectedNSGs
        }
      };
      
      console.log('Storing report:', reportToStore);
      setLastGeneratedReport(reportToStore);
      
      alert(`${reportName} report generated successfully!`);
      
    } catch (error) {
      console.error(`Error generating ${reportType} report:`, error);
      alert(`Failed to generate ${reportType} report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchEmailSchedules = async () => {
    try {
      const data = await apiClient.get('/api/v1/email/schedules');
      // Backend returns {success: true, schedules: [...]} format
      const schedules = data.schedules || data;
      // Ensure schedules is always an array
      setEmailSchedules(Array.isArray(schedules) ? schedules : []);
      
    } catch (error) {
      console.error('Error fetching email schedules:', error);
      setEmailSchedules([]); // Set empty array on error
    }
  };

  const editSchedule = (schedule: EmailSchedule) => {
    setScheduleEmailData({
      reportType: schedule.reportType || schedule.report_type,
      emails: schedule.emails || schedule.recipients || [],
      frequency: schedule.frequency,
      timeOfDay: schedule.timeOfDay || schedule.time_of_day || '09:00',
      monthlyDate: schedule.monthlyDate || schedule.monthly_date || 1,
      weeklyDay: schedule.weeklyDay || schedule.weekly_day || 'monday'
    });
    setSelectedSchedule(schedule);
    setShowScheduleEmailModal(true);
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this email schedule?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/v1/email/schedules/${scheduleId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('Email schedule deleted successfully!');
        fetchEmailSchedules();
      } else {
        throw new Error('Failed to delete email schedule');
      }
    } catch (error) {
      console.error('Error deleting email schedule:', error);
      alert('Failed to delete email schedule. Please try again.');
    }
  };

  const runScheduleNow = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to run this scheduled report now? This will generate the report and send it via email.')) {
      return;
    }
    
    try {
      setIsGeneratingReport(true);
      const response = await fetch(`/api/v1/email/schedule/${scheduleId}/run`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Report generated and sent successfully! Email sent to: ${result.recipients?.join(', ') || 'recipients'}`);
        fetchEmailSchedules(); // Refresh to update last sent time
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run scheduled report');
      }
    } catch (error) {
      console.error('Error running scheduled report:', error);
      alert(`Failed to run scheduled report: ${error.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const exportToCSV = async (reportType: string) => {
    try {
      console.log('=== Direct CSV Export Start ===');
      console.log('Export CSV called for:', reportType);
      
      // Validate required filters first
      if (!selectedSubscription) {
        alert('Please select a subscription before exporting CSV.');
        return;
      }
      
      // Allow empty resource group for "All resource groups" selection
      
      if (selectedNSGs.length === 0) {
        alert('Please select at least one NSG before exporting CSV.');
        return;
      }
      
      console.log('Validation passed - Subscription:', selectedSubscription);
      console.log('Resource Group:', selectedResourceGroup);
      console.log('Selected NSGs:', selectedNSGs);
      
      // Show loading state
      setIsExporting(true);
      
      // Prepare request data similar to generateReport
      const requestData = {
        subscription_id: selectedSubscription,
        resource_group: selectedResourceGroup,
        selected_nsgs: selectedNSGs
      };
      
      console.log('Request data for CSV export:', requestData);
      
      // Map report type to backend endpoint
      const endpointMap = {
        'asg-validation': '/api/v1/reports/asg-validation',
        'nsg-rules': '/api/v1/reports/nsg-rules',
        'ip-limitations': '/api/v1/reports/ip-limitations',
        'nsg-ports': '/api/v1/reports/nsg-ports',
        'consolidation': '/api/v1/reports/consolidation'
      };
      
      const endpoint = endpointMap[reportType as keyof typeof endpointMap];
      if (!endpoint) {
        throw new Error(`Unknown report type: ${reportType}`);
      }
      
      console.log('Fetching data from endpoint:', endpoint);
      
      // Fetch data directly from backend
      const result = await apiClient.post(endpoint, requestData);
      console.log('Backend response for CSV export:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Report generation failed');
      }
      
      const reportData = result.data;
      console.log('Report data structure:', reportData);
      console.log('Has csv_headers:', !!reportData?.csv_headers);
      console.log('Has csv_data:', !!reportData?.csv_data);
      
      if (!reportData || !reportData.csv_headers || !reportData.csv_data) {
        console.log('ERROR: Missing CSV data in response');
        alert('No CSV data available for this report.');
        return;
      }
      
      // Generate CSV content from fetched data
      console.log('CSV Headers:', reportData.csv_headers);
      console.log('CSV Data length:', reportData.csv_data.length);
      
      const csvHeaders = reportData.csv_headers.join(',');
      const csvRows = reportData.csv_data.map((row: any[]) => 
        row.map(cell => {
          // Handle cells that might contain commas by wrapping in quotes
          const cellStr = String(cell || '');
          return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
        }).join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      console.log('Generated CSV content length:', csvContent.length);
      
      const hasMultipleNSGs = selectedNSGs.length > 1;
      const reportName = reportTabs.find(tab => tab.id === reportType)?.name || reportType;
      const dateStr = new Date().toISOString().split('T')[0];
      
      if (hasMultipleNSGs) {
        // Create ZIP file for multiple NSGs
        const zip = new JSZip();
        zip.file(`${reportType}-report-${dateStr}.csv`, csvContent);
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${reportType}-reports-${dateStr}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
      } else {
        // Single NSG - create single CSV file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${reportType}-report-${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      console.log('CSV export completed successfully');
      alert('CSV file exported successfully!');

    } catch (error) {
      console.error(`Error exporting ${reportType} report:`, error);
      alert(`Failed to export ${reportType} report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const scheduleReportEmail = (reportType: string) => {
    setScheduleEmailData({ 
      reportType, 
      emails: [''], 
      frequency: 'daily',
      timeOfDay: '09:00',
      monthlyDate: 1,
      weeklyDay: 'monday'
    });
    setShowScheduleEmailModal(true);
  };

  const handleScheduleEmail = async () => {
    try {
      setIsSchedulingEmail(true);
      
      const validEmails = scheduleEmailData.emails.filter(email => email.trim() !== '');
      if (validEmails.length === 0) {
        alert('Please enter at least one email address.');
        return;
      }
      
      // Prepare schedule data
      const scheduleData = {
        report_type: scheduleEmailData.reportType,
        recipients: validEmails,
        frequency: scheduleEmailData.frequency,
        time_of_day: scheduleEmailData.timeOfDay,
        subscription_id: selectedSubscription,
        resource_group: selectedResourceGroup,
        selected_nsgs: selectedNSGs
      };
      
      // Add frequency-specific data
      if (scheduleEmailData.frequency === 'weekly') {
        scheduleData.weekly_day = scheduleEmailData.weeklyDay;
      } else if (scheduleEmailData.frequency === 'monthly') {
        scheduleData.monthly_date = scheduleEmailData.monthlyDate;
      }
      
      const isEditing = selectedSchedule !== null;
      const url = isEditing 
        ? `/api/v1/email/schedules/${selectedSchedule.id}`
        : '/api/v1/email/schedule';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData)
      });
      
      if (response.ok) {
        const result = await response.json();
        const action = selectedSchedule ? 'updated' : 'created';
        alert(`Email schedule ${action} successfully! Next execution: ${result.next_execution}`);
        setShowScheduleEmailModal(false);
        setScheduleEmailData({ 
          reportType: '', 
          emails: [''], 
          frequency: 'daily',
          timeOfDay: '09:00',
          monthlyDate: 1,
          weeklyDay: 'monday'
        });
        setSelectedSchedule(null);
        // Refresh email schedules list
        fetchEmailSchedules();
      } else {
        throw new Error('Failed to create email schedule');
      }
    } catch (error) {
      console.error('Error creating email schedule:', error);
      alert('Failed to create email schedule. Please try again.');
    } finally {
      setIsSchedulingEmail(false);
    }
  };

  const reportTabs = [
    { id: 'asg-validation', name: 'ASG Validation', icon: Shield, color: 'blue' },
    { id: 'nsg-rules', name: 'NSG Rules', icon: Network, color: 'green' },
    { id: 'ip-limitations', name: 'IP Limitations', icon: Globe, color: 'purple' },
    { id: 'nsg-ports', name: 'NSG Ports', icon: Layers, color: 'orange' },
    { id: 'consolidation', name: 'Consolidation', icon: BarChart3, color: 'red' }
  ];

  const ScheduleEmailModal = React.memo(() => {
    const addEmailField = useCallback(() => {
      setScheduleEmailData(prev => ({
        ...prev,
        emails: [...prev.emails, '']
      }));
    }, []);

    const updateEmail = useCallback((index: number, value: string) => {
      setScheduleEmailData(prev => ({
        ...prev,
        emails: prev.emails.map((email, i) => i === index ? value : email)
      }));
    }, []);

    const removeEmail = useCallback((index: number) => {
      setScheduleEmailData(prev => ({
        ...prev,
        emails: prev.emails.filter((_, i) => i !== index)
      }));
    }, []);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              {selectedSchedule ? 'Edit Email Schedule' : 'Schedule Email Report'}
            </h2>
            <button 
              onClick={() => setShowScheduleEmailModal(false)}
              className="text-slate-400 hover:text-slate-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Report Type</label>
              <select
                value={scheduleEmailData.reportType}
                onChange={(e) => setScheduleEmailData(prev => ({ ...prev, reportType: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ip-limitations">IP Limitations Report</option>
                <option value="nsg-validation">NSG Validation Report</option>
                <option value="nsg-rules">NSG Rules Report</option>
                <option value="nsg-flow-logs">NSG Flow Logs Report</option>
                <option value="nsg-security">NSG Security Report</option>
                <option value="nsg-compliance">NSG Compliance Report</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Recipients</label>
              <div className="space-y-3">
                {scheduleEmailData.emails.map((email, index) => (
                  <div key={`email-${index}`} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="Enter email address"
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoComplete="off"
                    />
                    {scheduleEmailData.emails.length > 1 && (
                      <button
                        onClick={() => removeEmail(index)}
                        className="px-3 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        type="button"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addEmailField}
                  className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  + Add Another Email
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Schedule Frequency</label>
              <select
                value={scheduleEmailData.frequency}
                onChange={(e) => setScheduleEmailData(prev => ({ ...prev, frequency: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Time of Day</label>
              <input
                type="time"
                value={scheduleEmailData.timeOfDay}
                onChange={(e) => setScheduleEmailData(prev => ({ ...prev, timeOfDay: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {scheduleEmailData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Day of Week</label>
                <select
                  value={scheduleEmailData.weeklyDay}
                  onChange={(e) => setScheduleEmailData(prev => ({ ...prev, weeklyDay: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            )}

            {scheduleEmailData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={scheduleEmailData.monthlyDate}
                  onChange={(e) => setScheduleEmailData(prev => ({ ...prev, monthlyDate: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowScheduleEmailModal(false)}
                className="flex-1 px-6 py-3 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
                disabled={isSchedulingEmail}
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleEmail}
                disabled={isSchedulingEmail}
                className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSchedulingEmail ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSchedulingEmail ? 'Scheduling...' : 'Schedule Report'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Reports Dashboard
              </h1>
              <p className="text-slate-600 mt-1">
                Comprehensive security and compliance reporting with automated email delivery
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Resource Selection
          </h2>
          <p className="text-slate-600 mb-6">Select your Azure resources</p>
          
          <FilterComponent
             selectedSubscription={selectedSubscription}
             selectedResourceGroup={selectedResourceGroup}
             selectedLocation={selectedLocation}
             selectedNSG={selectedNSG}
             selectedNSGs={selectedNSGs}
             onFilterChange={handleFilterChange}
             showLocationSelector={true}
             showNSGSelector={true}
             multipleNSGSelection={true}
           />
        </div>

        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200">
              <div className="flex overflow-x-auto">
                {reportTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-3 px-6 py-4 font-semibold transition-all whitespace-nowrap ${
                        isActive
                          ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                          : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
               <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
                 <div className="flex items-center justify-between mb-6">
                   <div>
                     <h2 className="text-2xl font-bold text-slate-800 mb-2">Report Content</h2>
                     <p className="text-slate-600">Generate and manage your security reports</p>
                   </div>
                   <div className="flex gap-3">
                     <button 
                       onClick={() => generateReport(activeTab)}
                       disabled={isGenerating}
                       className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {isGenerating ? (
                         <RefreshCw className="h-4 w-4 animate-spin" />
                       ) : (
                         <Activity className="h-4 w-4" />
                       )}
                       {isGenerating ? 'Generating...' : 'Generate Report'}
                     </button>
                     <button 
                       onClick={() => exportToCSV(activeTab)}
                       disabled={isExporting}
                       className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {isExporting ? (
                         <RefreshCw className="h-4 w-4 animate-spin" />
                       ) : (
                         <Download className="h-4 w-4" />
                       )}
                       {isExporting ? 'Exporting...' : 'Export CSV'}
                     </button>
                   </div>
                 </div>
                 
                 <div className="text-center py-8">
                   {lastGeneratedReport ? (
                     <div className="space-y-4">
                       <p className="text-green-600 font-semibold">✓ Report generated successfully!</p>
                       <div className="text-sm text-slate-600">
                         <p>Report Type: {lastGeneratedReport.type}</p>
                         <p>Generated: {new Date(lastGeneratedReport.timestamp).toLocaleString()}</p>
                         {selectedNSGs.length > 1 && (
                           <p className="text-blue-600 font-medium">Multiple NSGs selected - ZIP file will be created for email/export</p>
                         )}
                       </div>
                     </div>
                   ) : (
                     <p className="text-slate-600">Click "Generate Report" to create a new report</p>
                   )}
                 </div>
               </div>
             </div>
           </div>
         </div>
       </div>
        
        {/* Email Schedules Management Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Scheduled Email Reports</h2>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setScheduleEmailData({ 
                    reportType: 'ip-limitations', 
                    emails: [''], 
                    frequency: 'daily',
                    timeOfDay: '09:00',
                    monthlyDate: 1,
                    weeklyDay: 'monday'
                  });
                  setShowScheduleEmailModal(true);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Schedule New Report
              </button>
              <button
                onClick={fetchEmailSchedules}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
          
          {emailSchedules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600">No scheduled email reports found.</p>
              <p className="text-sm text-slate-500 mt-2">Create a schedule by generating a report and clicking "Schedule Email".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Report Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Frequency</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Time</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Recipients</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Next Run</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailSchedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">{schedule.reportType || schedule.report_type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-slate-600">{schedule.frequency}</span>
                        {schedule.frequency === 'weekly' && schedule.weekly_day && (
                          <span className="text-sm text-slate-500 block">on {schedule.weekly_day}</span>
                        )}
                        {schedule.frequency === 'monthly' && schedule.monthly_date && (
                          <span className="text-sm text-slate-500 block">on day {schedule.monthly_date}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{schedule.timeOfDay || schedule.time_of_day}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-600">
                          {(schedule.recipients || schedule.emails || []).slice(0, 2).map((email, idx) => (
                            <div key={idx}>{email}</div>
                          ))}
                          {(schedule.recipients || schedule.emails || []).length > 2 && (
                            <div className="text-slate-500">+{(schedule.recipients || schedule.emails || []).length - 2} more</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {schedule.next_execution ? new Date(schedule.next_execution).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          schedule.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {schedule.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => runScheduleNow(schedule.id)}
                            className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm flex items-center gap-1"
                            title="Run this scheduled report now"
                          >
                            <Send className="h-3 w-3" />
                            Run Now
                          </button>
                          <button
                            onClick={() => editSchedule(schedule)}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteSchedule(schedule.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {showScheduleEmailModal && <ScheduleEmailModal />}
      </div>
    );
 };

export default ReportsPage;


import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  LayoutDashboard, 
  Plus, 
  Search, 
  Filter, 
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Mail,
  User,
  Calendar,
  Tag,
  Globe,
  Database,
  X,
  Briefcase,
  ArrowRightLeft,
  Upload,
  FileSpreadsheet,
  FileText as FileIcon,
  Edit2,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Types
interface MigrationHandover {
  id: string;
  handoverDate: string;
  applicationName: string;
  sector: 'LATAM' | 'AMEA' | 'PGT' | 'North America' | 'Europe' | 'Corporate';
  owner: string;
  criticality: 'BC1' | 'BC2' | 'BC3';
  environments: string[];
  migrationEngineer: string;
  hclOps: string;
  pepOps: string;
  cutoverDate: string;
  accountId: string;
  region: string;
  status: 'Completed' | 'In Progress' | 'Pending' | 'Blocked';
  remarks: string;
  srTicket: string;
  additionalInfo?: string;
}

// Dummy Data
const DUMMY_DATA: MigrationHandover[] = [
  {
    id: '1',
    handoverDate: '2026-06-01',
    applicationName: 'Global Payments Portal',
    sector: 'LATAM',
    owner: 'John Doe',
    criticality: 'BC1',
    environments: ['PROD', 'QA'],
    migrationEngineer: 'Alice Smith',
    hclOps: 'HCL_Team_A',
    pepOps: 'Pep_Ops_North',
    cutoverDate: '2026-06-15',
    accountId: 'ACC-998877',
    region: 'East US',
    status: 'In Progress',
    remarks: 'Pre-migration checks passed',
    srTicket: 'SR-123456',
  },
  {
    id: '2',
    handoverDate: '2026-05-28',
    applicationName: 'HR Management System',
    sector: 'North America',
    owner: 'Sarah Connor',
    criticality: 'BC2',
    environments: ['NON-PROD', 'Dev'],
    migrationEngineer: 'Bob Johnson',
    hclOps: 'HCL_Team_B',
    pepOps: 'Pep_Ops_South',
    cutoverDate: '2026-06-10',
    accountId: 'ACC-112233',
    region: 'West Europe',
    status: 'Completed',
    remarks: 'Handover finished successfully',
    srTicket: 'SR-789012',
  },
  {
    id: '3',
    handoverDate: '2026-06-05',
    applicationName: 'Supply Chain Tracker',
    sector: 'AMEA',
    owner: 'Mike Wazowski',
    criticality: 'BC3',
    environments: ['DR', 'QA'],
    migrationEngineer: 'Alice Smith',
    hclOps: 'HCL_Team_A',
    pepOps: 'Pep_Ops_North',
    cutoverDate: '2026-06-20',
    accountId: 'ACC-445566',
    region: 'Southeast Asia',
    status: 'Pending',
    remarks: 'Waiting for stakeholder approval',
    srTicket: 'SR-345678',
  },
  {
    id: '4',
    handoverDate: '2026-05-20',
    applicationName: 'Customer Insights Dashboard',
    sector: 'PGT',
    owner: 'Emily Blunt',
    criticality: 'BC2',
    environments: ['PROD'],
    migrationEngineer: 'Charlie Brown',
    hclOps: 'HCL_Team_C',
    pepOps: 'Pep_Ops_West',
    cutoverDate: '2026-06-05',
    accountId: 'ACC-778899',
    region: 'Central India',
    status: 'Blocked',
    remarks: 'Firewall ports not open',
    srTicket: 'SR-901234',
    additionalInfo: 'Requires urgent networking team intervention'
  }
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const MigrationHandoverPage: React.FC = () => {
  const [data, setData] = useState<MigrationHandover[]>(DUMMY_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<MigrationHandover>>({
    environments: [],
    criticality: 'BC2',
    status: 'Pending',
    sector: 'North America'
  });

  // Statistics
  const stats = {
    total: data.length,
    completed: data.filter(d => d.status === 'Completed').length,
    inProgress: data.filter(d => d.status === 'In Progress').length,
    pending: data.filter(d => d.status === 'Pending').length,
    blocked: data.filter(d => d.status === 'Blocked').length,
  };

  // Chart Data
  const statusData = [
    { name: 'Completed', value: stats.completed },
    { name: 'In Progress', value: stats.inProgress },
    { name: 'Pending', value: stats.pending },
    { name: 'Blocked', value: stats.blocked },
  ];

  const sectorData = [
    { name: 'LATAM', count: data.filter(d => d.sector === 'LATAM').length },
    { name: 'AMEA', count: data.filter(d => d.sector === 'AMEA').length },
    { name: 'PGT', count: data.filter(d => d.sector === 'PGT').length },
    { name: 'North America', count: data.filter(d => d.sector === 'North America').length },
    { name: 'Europe', count: data.filter(d => d.sector === 'Europe').length },
    { name: 'Corporate', count: data.filter(d => d.sector === 'Corporate').length },
  ];

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.applicationName || !newEntry.owner || !newEntry.srTicket) {
      toast.error('Please fill in required fields');
      return;
    }

    if (editingId) {
      setData(data.map(item => item.id === editingId ? { ...newEntry as MigrationHandover, id: editingId } : item));
      toast.success('Migration entry updated successfully');
    } else {
      const entry: MigrationHandover = {
        ...newEntry as MigrationHandover,
        id: Math.random().toString(36).substr(2, 9),
        handoverDate: newEntry.handoverDate || new Date().toISOString().split('T')[0],
        cutoverDate: newEntry.cutoverDate || new Date().toISOString().split('T')[0],
      };

      setData([entry, ...data]);
      toast.success('Migration entry added successfully');
    }
    
    setIsModalOpen(false);
    setEditingId(null);
    setNewEntry({ environments: [], criticality: 'BC2', status: 'Pending', sector: 'North America' });
  };

  const handleEdit = (app: MigrationHandover) => {
    setEditingId(app.id);
    setNewEntry(app);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this migration entry?')) {
      setData(data.filter(item => item.id !== id));
      toast.success('Migration entry deleted');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        const newEntries: MigrationHandover[] = jsonData.map((row: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          handoverDate: row['Handover Date'] || new Date().toISOString().split('T')[0],
          applicationName: row['Application Name'] || 'Unnamed App',
          sector: (row['Sector'] as any) || 'North America',
          owner: row['Owner'] || 'Unknown',
          criticality: (row['Criticality'] as any) || 'BC2',
          environments: row['Environments'] ? row['Environments'].split(',').map((e: string) => e.trim()) : [],
          migrationEngineer: row['Engineer'] || '',
          hclOps: row['HCL Ops'] || '',
          pepOps: row['Pep Ops'] || '',
          cutoverDate: row['Cutover Date'] || new Date().toISOString().split('T')[0],
          accountId: row['Account ID'] || '',
          region: row['Region'] || '',
          status: (row['Status'] as any) || 'Pending',
          remarks: row['Remarks'] || '',
          srTicket: row['SR Ticket'] || 'SR-000000',
        }));

        setData([...newEntries, ...data]);
        toast.success(`Successfully imported ${newEntries.length} entries`);
      } catch (error) {
        console.error('Excel Import Error:', error);
        toast.error('Failed to parse Excel file. Please use the template.');
      }
    };
    reader.readAsBinaryString(file);
    // Clear input
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const headers = [
      {
        'Handover Date': '2026-06-01',
        'Application Name': 'Sample App',
        'Sector': 'North America',
        'Owner': 'John Smith',
        'Criticality': 'BC1',
        'Environments': 'PROD, QA, Dev',
        'Engineer': 'Jane Doe',
        'HCL Ops': 'Team Alpha',
        'Pep Ops': 'Ops Team 1',
        'Cutover Date': '2026-06-15',
        'Account ID': 'ACC-12345',
        'Region': 'East US',
        'Status': 'Pending',
        'SR Ticket': 'SR-100200',
        'Remarks': 'Initial migration setup'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Migration_Handover_Template.xlsx');
  };

  const toggleEnvironment = (env: string) => {
    const current = newEntry.environments || [];
    if (current.includes(env)) {
      setNewEntry({ ...newEntry, environments: current.filter(e => e !== env) });
    } else {
      setNewEntry({ ...newEntry, environments: [...current, env] });
    }
  };

  const filteredData = data.filter(item => 
    item.applicationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.srTicket.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen">
      {/* Executive Dashboard Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <LayoutDashboard size={20} />
            </div>
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-wider">Total Migrations</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-2xl font-bold text-slate-900">{stats.completed}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-wider">Completed</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <Clock size={20} />
            </div>
            <span className="text-2xl font-bold text-slate-900">{stats.inProgress + stats.pending}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-wider">Active/Pending</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
              <AlertCircle size={20} />
            </div>
            <span className="text-2xl font-bold text-slate-900">{stats.blocked}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-wider">Blocked</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex gap-2 flex-1">
              <button 
                className="flex-1 min-w-0 p-2 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                onClick={downloadTemplate}
                title="Download Excel Template"
              >
                <FileSpreadsheet size={16} className="shrink-0" />
                <span className="text-[11px] font-bold truncate">Template</span>
              </button>
              <label className="flex-1 min-w-0 p-2 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5" title="Upload Excel Bulk">
                <Upload size={16} className="shrink-0" />
                <span className="text-[11px] font-bold truncate">Bulk</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            <button 
              className="p-2 bg-blue-600 rounded-lg text-white cursor-pointer hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 min-w-0"
              onClick={() => setIsModalOpen(true)}
              title="Manual Entry"
            >
              <Plus size={16} className="shrink-0" />
              <span className="text-[11px] font-bold truncate">Manual</span>
            </button>
          </div>
          <p className="mt-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider text-center">Handover Actions</p>
        </div>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Globe size={18} className="text-blue-500" /> Sector-wise Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11}} 
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{fill: '#f8fafc'}}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                  {sectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Tag size={18} className="text-blue-500" /> Handover Status Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Application List & Input Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">Application Migration Handover to Cloud Ops</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search app, owner, SR, sector..." 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">
              <Filter size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Application Details</th>
                <th className="px-6 py-4">Status & Criticality</th>
                <th className="px-6 py-4">Personnel (Eng/Ops)</th>
                <th className="px-6 py-4">Account & Region</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">{app.applicationName}</span>
                      <span className="text-xs text-slate-500 mt-1">{app.sector}</span>
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium border border-blue-100">
                          {app.srTicket}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        app.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        app.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        app.status === 'Blocked' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {app.status}
                      </span>
                      <span className={`text-[10px] font-bold w-fit px-2 py-0.5 rounded border ${
                        app.criticality === 'BC1' ? 'text-rose-600 border-rose-200 bg-rose-50' :
                        app.criticality === 'BC2' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                        'text-blue-600 border-blue-200 bg-blue-50'
                      }`}>
                        {app.criticality}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-600">
                        <User size={12} className="text-slate-400" />
                        <span><span className="font-medium">Owner:</span> {app.owner}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Plus size={12} className="text-slate-400" />
                        <span><span className="font-medium">Eng:</span> {app.migrationEngineer}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail size={12} className="text-slate-400" />
                        <span><span className="font-medium">Ops:</span> {app.hclOps} / {app.pepOps}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1.5 text-slate-600">
                      <div className="flex items-center gap-2">
                        <Globe size={12} className="text-slate-400" />
                        <span>{app.region}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Database size={12} className="text-slate-400" />
                        <span>{app.accountId}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {app.environments.map(env => (
                          <span key={env} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500 font-medium uppercase">
                            {env}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1.5 text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-slate-400" />
                        <span><span className="font-medium">Handover:</span> {app.handoverDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-400" />
                        <span><span className="font-medium">Cutover:</span> {app.cutoverDate}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(app)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit Entry"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(app.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete Entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button className="text-sm text-blue-600 font-semibold hover:underline">
            View All Applications ({data.length})
          </button>
        </div>
      </div>

      {/* Add Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Migration Handover' : 'New Migration Handover'}</h3>
                  <p className="text-xs text-slate-500">{editingId ? 'Correct application details' : 'Add application details for Cloud Ops handover'}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                  setNewEntry({ environments: [], criticality: 'BC2', status: 'Pending', sector: 'North America' });
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="space-y-4 lg:col-span-3 pb-4 border-b border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Briefcase size={14} className="text-blue-500" /> Basic Application Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Application Name *</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="e.g. ERP System"
                        value={newEntry.applicationName || ''}
                        onChange={(e) => setNewEntry({...newEntry, applicationName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Sector *</label>
                      <select 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={newEntry.sector}
                        onChange={(e) => setNewEntry({...newEntry, sector: e.target.value as any})}
                      >
                        <option value="North America">North America</option>
                        <option value="LATAM">LATAM</option>
                        <option value="AMEA">AMEA</option>
                        <option value="PGT">PGT</option>
                        <option value="Europe">Europe</option>
                        <option value="Corporate">Corporate</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Application Owner *</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Name of owner"
                        value={newEntry.owner || ''}
                        onChange={(e) => setNewEntry({...newEntry, owner: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Technical Info */}
                <div className="space-y-4 lg:col-span-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Database size={14} className="text-blue-500" /> Technical Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Account ID</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="ACC-XXXXXX"
                        value={newEntry.accountId || ''}
                        onChange={(e) => setNewEntry({...newEntry, accountId: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Region</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="e.g. East US"
                        value={newEntry.region || ''}
                        onChange={(e) => setNewEntry({...newEntry, region: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Environments</label>
                    <div className="flex flex-wrap gap-3">
                      {['Dev', 'DR', 'PROD', 'NON-PROD', 'QA'].map(env => (
                        <label key={env} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            checked={newEntry.environments?.includes(env)}
                            onChange={() => toggleEnvironment(env)}
                          />
                          <span className="text-xs text-slate-600 group-hover:text-blue-600 transition-colors">{env}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status Info */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <AlertCircle size={14} className="text-blue-500" /> Status & Compliance
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Business Criticality</label>
                      <select 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={newEntry.criticality}
                        onChange={(e) => setNewEntry({...newEntry, criticality: e.target.value as any})}
                      >
                        <option value="BC1">BC1 (Critical)</option>
                        <option value="BC2">BC2 (High)</option>
                        <option value="BC3">BC3 (Medium)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Handover Status</label>
                      <select 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={newEntry.status}
                        onChange={(e) => setNewEntry({...newEntry, status: e.target.value as any})}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Personnel Info */}
                <div className="space-y-4 lg:col-span-3 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <User size={14} className="text-blue-500" /> Personnel & Responsibility
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Migration Engineer</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Engineer name"
                        value={newEntry.migrationEngineer || ''}
                        onChange={(e) => setNewEntry({...newEntry, migrationEngineer: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">HCL Ops Contact</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="HCL Team/Contact"
                        value={newEntry.hclOps || ''}
                        onChange={(e) => setNewEntry({...newEntry, hclOps: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Pep Ops Contact</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Pep Team/Contact"
                        value={newEntry.pepOps || ''}
                        onChange={(e) => setNewEntry({...newEntry, pepOps: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Timeline Info */}
                <div className="space-y-4 lg:col-span-2 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Calendar size={14} className="text-blue-500" /> Timelines & Ops Remarks
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Handover Date</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={newEntry.handoverDate || ''}
                        onChange={(e) => setNewEntry({...newEntry, handoverDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Cutover Date</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={newEntry.cutoverDate || ''}
                        onChange={(e) => setNewEntry({...newEntry, cutoverDate: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">SR Ticket Number *</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="SR-XXXXXX"
                      value={newEntry.srTicket || ''}
                      onChange={(e) => setNewEntry({...newEntry, srTicket: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MoreHorizontal size={14} className="text-blue-500" /> Ops Remarks
                  </h4>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Remarks</label>
                    <textarea 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none h-24 resize-none"
                      placeholder="Ops remarks or additional context..."
                      value={newEntry.remarks || ''}
                      onChange={(e) => setNewEntry({...newEntry, remarks: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    setNewEntry({ environments: [], criticality: 'BC2', status: 'Pending', sector: 'North America' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  {editingId ? 'Update Entry' : 'Create Migration Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MigrationHandoverPage;

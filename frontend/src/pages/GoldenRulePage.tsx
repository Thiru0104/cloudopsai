import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Upload, 
  Info,
  FileDown
} from 'lucide-react';

// Constants and Helpers
const FIELD_ALIASES = {
  ruleName: ['rule name','rulename','name'],
  priority: ['priority'],
  direction: ['direction'],
  protocol: ['protocol'],
  source: ['source','source ip','source ips','sourceaddressprefix','source address prefix','sourceaddressprefixes','source address prefixes'],
  destination: ['destination','destination ip','destination ips','destinationaddressprefix','destination address prefix','destinationaddressprefixes','destination address prefixes'],
  ports: ['ports','destinationportrange','destination port range','destinationportranges','destination port ranges','destinationport','destination port','destination ports','port range','port']
};

const normalizeHeader = (h: string) => String(h || '').trim().toLowerCase().replace(/[_\-]+/g,' ').replace(/\s+/g,' ');
const findField = (row: any, aliases: string[]) => {
  const normalizedRow: Record<string, any> = {};
  for (const [k, v] of Object.entries(row || {})) {
    normalizedRow[normalizeHeader(k)] = v;
  }

  for (const alias of aliases) {
    if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== '') {
      return normalizedRow[alias];
    }
  }

  // Smart fallback heuristic if exact aliases fail
  if (aliases.includes('source')) {
    const key = Object.keys(normalizedRow).find(k => 
      k.includes('source') && 
      !k.includes('port') && 
      !k.includes('rule') &&
      !k.includes('resource') &&
      !k.includes('group')
    );
    if (key) return normalizedRow[key];
  }
  if (aliases.includes('destination')) {
    const key = Object.keys(normalizedRow).find(k => 
      k.includes('destination') && 
      !k.includes('port') && 
      !k.includes('rule') &&
      !k.includes('resource') &&
      !k.includes('group')
    );
    if (key) return normalizedRow[key];
  }
  if (aliases.includes('ports')) {
    let key = Object.keys(normalizedRow).find(k => k.includes('port') && k.includes('destination'));
    if (!key) key = Object.keys(normalizedRow).find(k => k.includes('port') && !k.includes('source'));
    if (!key) key = Object.keys(normalizedRow).find(k => k.includes('port'));
    if (key) return normalizedRow[key];
  }
  if (aliases.includes('protocol')) {
    const key = Object.keys(normalizedRow).find(k => k.includes('protocol'));
    if (key) return normalizedRow[key];
  }

  return '';
};

const splitValues = (v: any): string[] => {
  if (Array.isArray(v)) return v.flatMap(splitValues);
  return String(v ?? '').replace(/[\n\r]+/g, ',').split(/[;,]/).map(x => x.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
};

const uniqueJoin = (arr: string[]) => [...new Set(arr)].join(', ');
const cleanText = (v: any) => String(v ?? '').trim();
const cleanPriority = (v: any) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : null;
};

const normalizeRecord = (row: any, i: number, fileType: string) => {
  const ruleName = cleanText(findField(row, FIELD_ALIASES.ruleName)) || `${fileType}-row-${i + 1}`;
  const priority = cleanPriority(findField(row, FIELD_ALIASES.priority));
  return {
    original: row,
    ruleName,
    priority,
    direction: cleanText(findField(row, FIELD_ALIASES.direction)),
    protocol: cleanText(findField(row, FIELD_ALIASES.protocol)),
    source: uniqueJoin(splitValues(findField(row, FIELD_ALIASES.source))),
    destination: uniqueJoin(splitValues(findField(row, FIELD_ALIASES.destination))),
    ports: uniqueJoin(splitValues(findField(row, FIELD_ALIASES.ports))),
    key: ruleName.toLowerCase()
  };
};

const inScope = (p: number | null, s: number, e: number) => p !== null && p >= s && p <= e;

const diffFields = (a: any, b: any) => {
  const fields = ['priority', 'direction', 'protocol', 'source', 'destination', 'ports'];
  return fields
    .filter(f => String(a?.[f] ?? '') !== String(b?.[f] ?? ''))
    .map(f => ({ field: f, before: a?.[f] ?? '', after: b?.[f] ?? '' }));
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const GoldenRulePage: React.FC = () => {
  // State
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [sourceRows, setSourceRows] = useState<any[]>([]);
  const [targetRows, setTargetRows] = useState<any[]>([]);
  const [comparedRows, setComparedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Ready to compare offline files.');

  // Filters and settings
  const [priorityStart, setPriorityStart] = useState(3500);
  const [priorityEnd, setPriorityEnd] = useState(4096);
  const [deltaFilter, setDeltaFilter] = useState('different');
  const [searchQuery, setSearchQuery] = useState('');
  const [editablePriorityGlobal, setEditablePriorityGlobal] = useState(3500);

  // Parse file
  const parseFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      const text = await file.text();
      const wb = XLSX.read(text, { type: 'string' });
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    }
    if (ext === 'json') {
      return JSON.parse(await file.text());
    }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'source' | 'target') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const rows = await parseFile(file) as any[];
      const normalized = rows.map((r, i) => normalizeRecord(r, i, type));
      
      if (type === 'source') {
        setSourceFile(file);
        setSourceRows(normalized);
      } else {
        setTargetFile(file);
        setTargetRows(normalized);
      }
      toast.success(`${file.name} loaded successfully`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to parse ${file.name}`);
    } finally {
      setLoading(false);
    }
  };

  const compareData = () => {
    if (!sourceRows.length || !targetRows.length) {
      toast.error('Upload both local files first.');
      return;
    }

    const start = priorityStart || 3500;
    const end = priorityEnd || 4096;

    const sourceScoped = sourceRows.filter(r => inScope(r.priority, start, end));
    const targetScoped = targetRows.filter(r => inScope(r.priority, start, end));

    const sm = new Map(sourceScoped.map(r => [r.key, r]));
    const tm = new Map(targetScoped.map(r => [r.key, r]));
    const keys = new Set([...sm.keys(), ...tm.keys()]);
    
    const results: any[] = [];

    keys.forEach(key => {
      const s = sm.get(key);
      const t = tm.get(key);

      if (s && t) {
        const changes = diffFields(s, t);
        results.push({
          status: changes.length ? 'modified' : 'same',
          ruleName: t.ruleName || s.ruleName,
          priority: t.priority ?? s.priority,
          editablePriority: t.priority ?? s.priority,
          direction: t.direction || s.direction,
          protocol: t.protocol || s.protocol,
          source: t.source || s.source,
          destination: t.destination || s.destination,
          ports: t.ports || s.ports,
          changes
        });
      } else if (t) {
        results.push({
          status: 'added',
          ruleName: t.ruleName,
          priority: t.priority,
          editablePriority: t.priority,
          direction: t.direction,
          protocol: t.protocol,
          source: t.source,
          destination: t.destination,
          ports: t.ports,
          changes: [{ field: 'rule', before: '', after: 'Present only in target' }]
        });
      } else if (s) {
        results.push({
          status: 'removed',
          ruleName: s.ruleName,
          priority: s.priority,
          editablePriority: s.priority,
          direction: s.direction,
          protocol: s.protocol,
          source: s.source,
          destination: s.destination,
          ports: s.ports,
          changes: [{ field: 'rule', before: 'Present only in source', after: '' }]
        });
      }
    });

    results.sort((a, b) => (a.priority ?? 99999) - (b.priority ?? 99999) || a.ruleName.localeCompare(b.ruleName));
    setComparedRows(results);
    setStatusText(`Compared offline files in scope ${start}-${end}.`);
  };

  const visibleRows = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return comparedRows.filter(r => {
      let byStatus = false;
      if (deltaFilter === 'all') byStatus = true;
      else if (deltaFilter === 'different') byStatus = r.status !== 'same';
      else if (deltaFilter === 'mismatch-priority') byStatus = r.changes.some((c: any) => c.field === 'priority' || c.field === 'editedPriority');
      else if (deltaFilter === 'mismatch-cidr') byStatus = r.changes.some((c: any) => c.field === 'source' || c.field === 'destination');
      else if (deltaFilter === 'mismatch-port') byStatus = r.changes.some((c: any) => c.field === 'ports');
      else byStatus = r.status === deltaFilter;
      
      const hay = [r.ruleName, r.priority, r.direction, r.protocol, r.source, r.destination, r.ports, r.status].join(' ').toLowerCase();
      return byStatus && (!search || hay.includes(search));
    });
  }, [comparedRows, deltaFilter, searchQuery]);

  const handleRowPriorityChange = (index: number, value: string) => {
    const newRows = [...comparedRows];
    // Find actual index in comparedRows based on visibleRows
    const visibleRow = visibleRows[index];
    const actualIndex = newRows.findIndex(r => r === visibleRow);
    if (actualIndex > -1) {
      newRows[actualIndex].editablePriority = value === '' ? '' : Number(value);
      setComparedRows(newRows);
    }
  };

  const setGlobalPriorityToRow = (index: number) => {
    const newRows = [...comparedRows];
    const visibleRow = visibleRows[index];
    const actualIndex = newRows.findIndex(r => r === visibleRow);
    if (actualIndex > -1) {
      newRows[actualIndex].editablePriority = editablePriorityGlobal;
      setComparedRows(newRows);
    }
  };

  const saveRowPriority = (index: number) => {
    const newRows = [...comparedRows];
    const visibleRow = visibleRows[index];
    const actualIndex = newRows.findIndex(r => r === visibleRow);
    
    if (actualIndex > -1) {
      const row = newRows[actualIndex];
      const val = Number(row.editablePriority);
      if (val < 3500 || val > 4095 || isNaN(val)) {
        toast.error('Priority must be between 3500 and 4095.');
        return;
      }
      
      row.changes = row.changes.filter((c: any) => c.field !== 'editedPriority');
      row.changes.unshift({ field: 'editedPriority', before: row.priority, after: val });
      row.editablePriority = val;
      row.status = 'modified';
      setComparedRows(newRows);
      toast.success(`Saved priority ${val} for ${row.ruleName}.`);
    }
  };

  const exportRows = (type: 'csv' | 'json') => {
    if (!visibleRows.length) {
      toast.error('No visible rows to export.');
      return;
    }
    const payload = visibleRows.map(r => ({
      status: r.status,
      ruleName: r.ruleName,
      priorityOriginal: r.priority,
      priorityEdited: r.editablePriority,
      direction: r.direction,
      protocol: r.protocol,
      source: r.source,
      destination: r.destination,
      ports: r.ports,
      delta: r.changes.map((c: any) => `${c.field}: ${c.before ?? '—'} => ${c.after ?? '—'}`).join(' | ')
    }));
    
    if (type === 'json') {
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `golden-rule-delta-${Date.now()}.json`);
    } else {
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(payload));
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `golden-rule-delta-${Date.now()}.csv`);
    }
  };

  const exportRemediatedTarget = () => {
    if (!visibleRows.length) {
      toast.error('No visible rows to export.');
      return;
    }
    const payload = visibleRows.map(r => ({
      RuleName: r.ruleName,
      Priority: r.editablePriority ?? r.priority,
      Direction: r.direction,
      Protocol: r.protocol,
      SourceAddressPrefix: r.source,
      DestinationAddressPrefix: r.destination,
      DestinationPortRange: r.ports
    }));
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(payload));
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `remediated-target-${Date.now()}.csv`);
  };

  const exportDeltaPDF = () => {
    // Only include rows that are NOT 'same'
    const deltaRows = visibleRows.filter(r => r.status !== 'same');
    
    if (!deltaRows.length) {
      toast.error('No changes to export. All visible rows match exactly.');
      return;
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text('Golden Rule Delta Report', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Priority Range: ${priorityStart} - ${priorityEnd}`, 14, 34);
    
    const tableData = deltaRows.map(r => {
      const getCellText = (fieldName: string, currentVal: any) => {
        if (r.status === 'modified') {
          const change = r.changes?.find((c: any) => c.field === fieldName);
          if (change) {
            return `[Old]: ${change.before || '—'}\n[New]: ${change.after || '—'}`;
          }
        }
        return String(currentVal || '—');
      };

      let priorityText = String(r.editablePriority ?? r.priority);
      if (r.status === 'modified') {
        const pChange = r.changes?.find((c: any) => c.field === 'editedPriority');
        if (pChange) {
          priorityText = `[Old]: ${pChange.before}\n[New]: ${pChange.after}`;
        }
      }

      return [
        r.status.toUpperCase(),
        r.ruleName,
        priorityText,
        getCellText('direction', r.direction),
        getCellText('protocol', r.protocol),
        getCellText('source', r.source),
        getCellText('destination', r.destination),
        getCellText('ports', r.ports)
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Status', 'Rule Name', 'Priority', 'Direction', 'Protocol', 'Source', 'Destination', 'Ports']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 40, fontStyle: 'bold' },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 50 },
        6: { cellWidth: 50 },
        7: { cellWidth: 35 }
      },
      didParseCell: function(data) {
        if (data.section === 'body') {
          const status = data.row.raw[0];
          
          if (status === 'ADDED') {
            data.cell.styles.fillColor = [235, 245, 235]; // Light green
            if (data.column.index === 0) data.cell.styles.textColor = [46, 204, 113];
          } else if (status === 'REMOVED') {
            data.cell.styles.fillColor = [253, 237, 236]; // Light red
            if (data.column.index === 0) data.cell.styles.textColor = [231, 76, 60];
          } else if (status === 'MODIFIED') {
            data.cell.styles.fillColor = [253, 246, 233]; // Light orange
            if (data.column.index === 0) data.cell.styles.textColor = [230, 126, 34];
            
            // Highlight specific changed cells
            if (typeof data.cell.raw === 'string' && data.cell.raw.includes('[Old]:')) {
              data.cell.styles.textColor = [211, 84, 0]; // Darker orange text for changed fields
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    doc.save(`golden-rule-delta-report-${Date.now()}.pdf`);
    toast.success('Delta PDF downloaded successfully.');
  };

  const exportDeltaExcel = () => {
    // Only include rows that are NOT 'same'
    const deltaRows = visibleRows.filter(r => r.status !== 'same');
    
    if (!deltaRows.length) {
      toast.error('No changes to export. All visible rows match exactly.');
      return;
    }

    const payload = deltaRows.map(r => {
      const getCellText = (fieldName: string, currentVal: any) => {
        if (r.status === 'modified') {
          const change = r.changes?.find((c: any) => c.field === fieldName);
          if (change) {
            return `[Old]: ${change.before || '—'} -> [New]: ${change.after || '—'}`;
          }
        }
        return String(currentVal || '—');
      };

      let priorityText = String(r.editablePriority ?? r.priority);
      if (r.status === 'modified') {
        const pChange = r.changes?.find((c: any) => c.field === 'editedPriority');
        if (pChange) {
          priorityText = `[Old]: ${pChange.before} -> [New]: ${pChange.after}`;
        }
      }

      return {
        Status: r.status.toUpperCase(),
        RuleName: r.ruleName,
        Priority: priorityText,
        Direction: getCellText('direction', r.direction),
        Protocol: getCellText('protocol', r.protocol),
        Source: getCellText('source', r.source),
        Destination: getCellText('destination', r.destination),
        Ports: getCellText('ports', r.ports)
      };
    });

    const ws = XLSX.utils.json_to_sheet(payload);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delta Report");
    XLSX.writeFile(wb, `golden-rule-delta-report-${Date.now()}.xlsx`);
    toast.success('Delta Excel downloaded successfully.');
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'added': return 'bg-green-100 text-green-800';
      case 'removed': return 'bg-red-100 text-red-800';
      case 'modified': return 'bg-orange-100 text-orange-800';
      case 'same': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderCellWithDiff = (row: any, fieldName: string) => {
    if (row.status === 'modified') {
      const change = row.changes?.find((c: any) => c.field === fieldName);
      if (change) {
        return (
          <div className="flex flex-col gap-1 text-xs">
            <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded line-through break-all" title="Original Baseline Value">
              {String(change.before || '—')}
            </span>
            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded break-all" title="New Target Value">
              {String(change.after || '—')}
            </span>
          </div>
        );
      }
    }
    return <span className="break-all">{String(row[fieldName] || '—')}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 text-sm text-gray-800">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header section */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Golden Rule</h1>
            <h2 className="text-lg text-gray-600 font-medium mb-2">NSG baseline delta engine for CloudOps foundation rule validation.</h2>
            <p className="text-gray-500 max-w-3xl">
              Upload a Golden Rule baseline and a target NSG rule set, then review only the deltas within the 3500–4096 validation range with edit-ready remediation support.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button onClick={compareData} disabled={loading} className="px-4 py-2 bg-teal-600 text-white font-medium rounded-lg shadow hover:bg-teal-700 transition disabled:opacity-50">
              {loading ? 'Processing...' : 'Compare Files'}
            </button>
            <button onClick={exportDeltaPDF} className="px-4 py-2 bg-white border border-gray-300 text-teal-700 font-medium rounded-lg shadow-sm hover:bg-teal-50 transition flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              Export Delta PDF
            </button>
            <button onClick={exportDeltaExcel} className="px-4 py-2 bg-white border border-gray-300 text-teal-700 font-medium rounded-lg shadow-sm hover:bg-teal-50 transition flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              Export Delta Excel
            </button>
            <button onClick={() => exportRows('csv')} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg shadow-sm hover:bg-gray-50 transition text-xs">
              Raw CSV
            </button>
          </div>
        </div>

        {/* Upload panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-1">Source File</h3>
            <p className="text-gray-500 mb-4">Upload the Golden Rule baseline from your local machine. Supported formats: Excel, CSV, JSON.</p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-500 transition relative">
              <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={(e) => handleFileUpload(e, 'source')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <div className="font-medium text-gray-700 mb-1">Select source baseline file</div>
              <div className="text-gray-500 mb-2">Drag and drop or browse to upload from your offline workstation.</div>
              <div className="text-teal-600 text-xs font-semibold mb-3">Offline local upload enabled</div>
              {sourceFile && (
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">{sourceFile.name}</span>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">{sourceRows.length} rows</span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-1">Target File</h3>
            <p className="text-gray-500 mb-4">Upload the configured NSG rules from your local machine for delta comparison.</p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-500 transition relative">
              <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={(e) => handleFileUpload(e, 'target')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <div className="font-medium text-gray-700 mb-1">Select target NSG file</div>
              <div className="text-gray-500 mb-2">Target review focuses on CloudOps foundation rule priorities 3500–4096.</div>
              <div className="text-teal-600 text-xs font-semibold mb-3">Offline local upload enabled</div>
              {targetFile && (
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">{targetFile.name}</span>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">{targetRows.length} rows</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-wrap items-end gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Priority Start</label>
            <input type="number" value={priorityStart} onChange={e => setPriorityStart(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 w-32 focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Priority End</label>
            <input type="number" value={priorityEnd} onChange={e => setPriorityEnd(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 w-32 focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Delta Filter</label>
            <select value={deltaFilter} onChange={e => setDeltaFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-48 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
              <option value="all">All rows in scope</option>
              <option value="different">Differences only</option>
              <option value="added">Added only</option>
              <option value="removed">Removed only</option>
              <option value="modified">Modified only</option>
              <option value="same">Matched only</option>
              <option value="mismatch-priority">Priority mismatch only</option>
              <option value="mismatch-cidr">CIDR mismatch only</option>
              <option value="mismatch-port">Port mismatch only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Update Edited Priority To</label>
            <input type="number" value={editablePriorityGlobal} onChange={e => setEditablePriorityGlobal(Number(e.target.value))} min="3500" max="4095" className="border border-gray-300 rounded-lg px-3 py-2 w-48 focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Rules in Scope</div>
            <div className="text-3xl font-bold text-gray-900">{comparedRows.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Added</div>
            <div className="text-3xl font-bold text-green-600">{comparedRows.filter(r => r.status === 'added').length}</div>
            <div className="text-xs font-medium text-green-800 bg-green-100 px-2 py-0.5 rounded-full inline-block mt-1">Target only</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Removed</div>
            <div className="text-3xl font-bold text-red-600">{comparedRows.filter(r => r.status === 'removed').length}</div>
            <div className="text-xs font-medium text-red-800 bg-red-100 px-2 py-0.5 rounded-full inline-block mt-1">Source only</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Modified</div>
            <div className="text-3xl font-bold text-orange-600">{comparedRows.filter(r => r.status === 'modified').length}</div>
            <div className="text-xs font-medium text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full inline-block mt-1">Changed fields</div>
          </div>
        </div>

        {/* Main Grid / Workspace */}
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="w-full xl:w-64 shrink-0 flex flex-col gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3">Legend</h3>
              <div className="flex flex-col gap-2">
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded font-semibold text-xs text-center border border-green-200">Added</span>
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded font-semibold text-xs text-center border border-red-200">Removed</span>
                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded font-semibold text-xs text-center border border-orange-200">Modified</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-semibold text-xs text-center border border-blue-200">Matched</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-teal-600" />
                CloudOps Notes
              </h3>
              <p className="text-gray-600 text-xs mb-3">
                Golden Rule baseline and target files are both uploaded locally. No server upload is required, which makes the tool suitable for restricted environments.
              </p>
              <p className="text-gray-500 text-xs italic">
                Priority comparison defaults to 3500–4096, while remediation edits are limited to 3500–4095 for controlled NSG governance.
              </p>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-gray-50">
              <input 
                type="text" 
                placeholder="Search rule name, IP, CIDR, ports, protocol, or status" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <div className="flex items-center gap-3 text-gray-600 font-medium text-sm">
                <span>{statusText}</span>
                <span className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-xs">{visibleRows.length} rows visible</span>
              </div>
            </div>
            
            <div className="overflow-x-auto relative shadow-inner rounded-b-xl border border-gray-200">
              <table className="w-full text-left border-collapse min-w-max">
                <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-600 font-bold">
                    <th className="p-3 whitespace-nowrap sticky left-0 z-20 bg-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Status</th>
                    <th className="p-3 min-w-[150px]">Rule Name</th>
                    <th className="p-3 min-w-[100px]">Priority</th>
                    <th className="p-3 min-w-[100px]">Direction</th>
                    <th className="p-3 min-w-[100px]">Protocol</th>
                    <th className="p-3 min-w-[250px]">Source</th>
                    <th className="p-3 min-w-[250px]">Destination</th>
                    <th className="p-3 min-w-[150px]">Ports</th>
                    <th className="p-3 min-w-[200px]">Delta Detail</th>
                    <th className="p-3 text-center min-w-[100px] sticky right-0 z-20 bg-gray-100 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-500">
                        {comparedRows.length === 0 ? 'Upload both local source and target files to see highlighted deltas.' : 'No rows match the current filter.'}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, idx) => (
                      <tr key={idx} className={`
                        ${row.status === 'added' ? 'bg-green-50/30 hover:bg-green-50' : ''}
                        ${row.status === 'removed' ? 'bg-red-50/30 hover:bg-red-50' : ''}
                        ${row.status === 'modified' ? 'bg-orange-50/30 hover:bg-orange-50' : ''}
                        ${row.status === 'same' ? 'hover:bg-gray-50' : ''}
                        transition-colors group
                      `}>
                        <td className={`p-3 align-top sticky left-0 z-10 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]
                          ${row.status === 'added' ? 'bg-green-50/80 group-hover:bg-green-50' : ''}
                          ${row.status === 'removed' ? 'bg-red-50/80 group-hover:bg-red-50' : ''}
                          ${row.status === 'modified' ? 'bg-orange-50/80 group-hover:bg-orange-50' : ''}
                          ${row.status === 'same' ? 'bg-white group-hover:bg-gray-50' : ''}
                        `}>
                          <span className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3 align-top font-bold text-gray-900 break-words max-w-[200px]">{row.ruleName}</td>
                        <td className="p-3 align-top">
                          <input 
                            type="number" 
                            min="3500" max="4095" 
                            value={row.editablePriority ?? ''} 
                            onChange={(e) => handleRowPriorityChange(idx, e.target.value)}
                            className="w-24 border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                          />
                        </td>
                        <td className="p-3 align-top text-gray-600">{renderCellWithDiff(row, 'direction')}</td>
                        <td className="p-3 align-top text-gray-600 uppercase">{renderCellWithDiff(row, 'protocol')}</td>
                        <td className="p-3 align-top text-gray-600 break-words max-w-[300px]">{renderCellWithDiff(row, 'source')}</td>
                        <td className="p-3 align-top text-gray-600 break-words max-w-[300px]">{renderCellWithDiff(row, 'destination')}</td>
                        <td className="p-3 align-top text-gray-600 break-words max-w-[200px]">{renderCellWithDiff(row, 'ports')}</td>
                        <td className="p-3 align-top">
                          {row.changes.length === 0 ? (
                            <span className="text-gray-400 italic text-xs">No change</span>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {row.changes.map((c: any, i: number) => (
                                <div key={i} className="text-xs">
                                  <div className="font-bold text-gray-500 uppercase mb-1">{c.field}</div>
                                  <div className="flex flex-col gap-1 text-gray-700 font-medium">
                                    {c.field === 'editedPriority' ? (
                                      <span>Updated to: <span className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">{String(c.after || '—')}</span></span>
                                    ) : (
                                      <span className="italic">Values highlighted inline</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className={`p-3 align-top sticky right-0 z-10 transition-colors shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]
                          ${row.status === 'added' ? 'bg-green-50/80 group-hover:bg-green-50' : ''}
                          ${row.status === 'removed' ? 'bg-red-50/80 group-hover:bg-red-50' : ''}
                          ${row.status === 'modified' ? 'bg-orange-50/80 group-hover:bg-orange-50' : ''}
                          ${row.status === 'same' ? 'bg-white group-hover:bg-gray-50' : ''}
                        `}>
                          <div className="flex flex-col gap-2 items-center">
                            <button onClick={() => setGlobalPriorityToRow(idx)} className="w-full px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs font-bold text-gray-700 transition">
                              Set Priority
                            </button>
                            <button onClick={() => saveRowPriority(idx)} className="w-full px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold transition shadow-sm">
                              Save Row
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GoldenRulePage;

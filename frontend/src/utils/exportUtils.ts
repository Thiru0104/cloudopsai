import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF interface to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface ExportData {
  nsgName: string;
  resourceGroup: string;
  subscription: string;
  totalRules: number;
  violations: any[];
  recommendations: any[];
  aiAnalysis?: any;
}

export const exportToCSV = (data: ExportData) => {
  const csvContent = [];
  
  // Header information
  csvContent.push(['NSG Validation Report']);
  csvContent.push(['NSG Name', data.nsgName]);
  csvContent.push(['Resource Group', data.resourceGroup]);
  csvContent.push(['Subscription', data.subscription]);
  csvContent.push(['Total Rules', (data.totalRules !== undefined && data.totalRules !== null) ? data.totalRules.toString() : '0']);
  csvContent.push([]);
  
  // Violations section
  if (data.violations && data.violations.length > 0) {
    csvContent.push(['VIOLATIONS']);
    csvContent.push(['Type', 'Severity', 'Message', 'Current Count', 'Max Allowed']);
    data.violations.forEach(violation => {
      csvContent.push([
        violation.type,
        violation.severity,
        violation.message,
        (violation.currentCount !== undefined && violation.currentCount !== null) ? violation.currentCount.toString() : '',
        (violation.maxAllowed !== undefined && violation.maxAllowed !== null) ? violation.maxAllowed.toString() : ''
      ]);
    });
    csvContent.push([]);
  }
  
  // AI Recommendations section (excluding ready-to-implement rules)
  if (data.recommendations && data.recommendations.length > 0) {
    const filteredRecommendations = data.recommendations.filter(rec => 
      rec.type !== 'READY_TO_IMPLEMENT' && 
      rec.type !== 'OPTIMIZATION' && 
      rec.type !== 'CONSOLIDATION'
    );
    
    if (filteredRecommendations.length > 0) {
      csvContent.push(['AI RECOMMENDATIONS']);
      csvContent.push(['Title', 'Type', 'Priority', 'Description', 'Impact', 'Implementation']);
      filteredRecommendations.forEach(rec => {
        csvContent.push([
          rec.title,
          rec.type,
          rec.priority,
          rec.description,
          rec.impact,
          rec.implementation
        ]);
      });
      csvContent.push([]);
    }
  }
  
  // Duplicate IPs section
  if (data.aiAnalysis?.duplicateIps && data.aiAnalysis.duplicateIps.length > 0) {
    csvContent.push(['DUPLICATE IP ADDRESSES']);
    csvContent.push(['IP Address', 'Usage Count', 'Severity', 'Rules', 'Recommendation']);
    data.aiAnalysis.duplicateIps.forEach((dup: any) => {
      const ruleNames = dup.rules.map((r: any) => r.ruleName).join('; ');
      csvContent.push([
        dup.ipAddress,
        (dup.usageCount !== undefined && dup.usageCount !== null) ? dup.usageCount.toString() : '0',
        dup.severity,
        ruleNames,
        dup.recommendation
      ]);
    });
    csvContent.push([]);
  }
  
  // CIDR Overlaps section
  if (data.aiAnalysis?.cidrOverlaps && data.aiAnalysis.cidrOverlaps.length > 0) {
    csvContent.push(['CIDR OVERLAPS']);
    csvContent.push(['Network 1', 'Network 2', 'Overlap Type', 'Severity', 'Recommendation']);
    data.aiAnalysis.cidrOverlaps.forEach((overlap: any) => {
      csvContent.push([
        `${overlap.network1.cidr} (${overlap.network1.ruleName})`,
        `${overlap.network2.cidr} (${overlap.network2.ruleName})`,
        overlap.overlapType,
        overlap.severity,
        overlap.recommendation
      ]);
    });
    csvContent.push([]);
  }
  
  // Security Risks section
  if (data.aiAnalysis?.securityRisks && data.aiAnalysis.securityRisks.length > 0) {
    csvContent.push(['SECURITY RISKS']);
    csvContent.push(['Rule Name', 'Direction', 'Priority', 'Risk Type', 'Severity', 'Description']);
    data.aiAnalysis.securityRisks.forEach((risk: any) => {
      risk.risks.forEach((r: any) => {
        csvContent.push([
          risk.ruleName,
          risk.direction,
          (risk.priority !== undefined && risk.priority !== null) ? risk.priority.toString() : 'N/A',
          r.type,
          r.severity,
          r.description
        ]);
      });
    });
  }
  
  // Convert to CSV string
  const csvString = csvContent.map(row => 
    row.map(cell => `"${(cell !== undefined && cell !== null) ? cell.toString().replace(/"/g, '""') : ''}"`).join(',')
  ).join('\n');
  
  // Download CSV
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `nsg-validation-${data.nsgName}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (data: ExportData) => {
  const doc = new jsPDF('landscape', 'mm', 'a4'); // Use landscape orientation for better content coverage
  
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  
  // Helper function to add page break if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };
  
  // Helper function to add section header
  const addSectionHeader = (title: string, color: [number, number, number] = [41, 128, 185]) => {
    checkPageBreak(30);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 25, yPosition + 8);
    doc.setTextColor(0, 0, 0);
    yPosition += 25;
  };
  
  // Title Page
  doc.setFillColor(52, 73, 94);
  doc.rect(0, 0, pageWidth, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('NSG Validation Report', pageWidth / 2, 40, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 55, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPosition = 100;
  
  // Executive Summary Box
  doc.setFillColor(236, 240, 241);
  doc.rect(20, yPosition, pageWidth - 40, 60, 'F');
  doc.setDrawColor(189, 195, 199);
  doc.rect(20, yPosition, pageWidth - 40, 60, 'S');
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 25, yPosition + 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`NSG Name: ${data.nsgName}`, 25, yPosition + 30);
  doc.text(`Resource Group: ${data.resourceGroup}`, 25, yPosition + 40);
  doc.text(`Subscription: ${data.subscription}`, 25, yPosition + 50);
  doc.text(`Total Rules: ${data.totalRules}`, pageWidth / 2 + 10, yPosition + 30);
  
  const violationCount = data.violations?.length || 0;
  const recommendationCount = data.recommendations?.length || 0;
  doc.text(`Violations Found: ${violationCount}`, pageWidth / 2 + 10, yPosition + 40);
  doc.text(`Recommendations: ${recommendationCount}`, pageWidth / 2 + 10, yPosition + 50);
  
  yPosition += 80;
  
  // Violations section
  if (data.violations && data.violations.length > 0) {
    addSectionHeader('Security Violations', [231, 76, 60]);
    
    const violationData = data.violations.map(v => [
      v.type || 'N/A',
      v.severity || 'Medium',
      v.message ? (v.message.length > 60 ? v.message.substring(0, 60) + '...' : v.message) : 'No description',
      (v.currentCount !== undefined && v.currentCount !== null) ? v.currentCount.toString() : '0',
      (v.maxAllowed !== undefined && v.maxAllowed !== null) ? v.maxAllowed.toString() : 'N/A'
    ]);
    
    autoTable(doc, {
      head: [['Violation Type', 'Severity', 'Description', 'Current Count', 'Max Allowed']],
      body: violationData,
      startY: yPosition,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [231, 76, 60],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252]
      },
      columnStyles: {
        0: { cellWidth: 40 }, // Violation Type - wider
        1: { cellWidth: 25 }, // Severity
        2: { cellWidth: 120 }, // Description - much wider for full text
        3: { cellWidth: 30 }, // Current Count
        4: { cellWidth: 35 }  // Max Allowed
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  
  // AI Recommendations section (excluding ready-to-implement rules)
  if (data.recommendations && data.recommendations.length > 0) {
    const filteredRecommendations = data.recommendations.filter(rec => 
      rec.type !== 'READY_TO_IMPLEMENT' && 
      rec.type !== 'OPTIMIZATION' && 
      rec.type !== 'CONSOLIDATION'
    );
    
    if (filteredRecommendations.length > 0) {
      addSectionHeader('AI-Powered Recommendations', [46, 204, 113]);
      
      const recData = filteredRecommendations.map(rec => {
        const priorityColor = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        return [
          rec.title ? (rec.title.length > 35 ? rec.title.substring(0, 35) + '...' : rec.title) : 'No title',
          rec.type || 'General',
          `${priorityColor} ${rec.priority || 'Medium'}`,
          rec.description ? (rec.description.length > 50 ? rec.description.substring(0, 50) + '...' : rec.description) : 'No description',
          rec.impact || 'Not specified'
        ];
      });
      
      autoTable(doc, {
        head: [['Recommendation', 'Category', 'Priority', 'Description', 'Impact']],
        body: recData,
        startY: yPosition,
        styles: { 
          fontSize: 9,
          cellPadding: 3,
          lineColor: [189, 195, 199],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [46, 204, 113],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 60 },
          4: { cellWidth: 25 }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 15;
    }
  }
  
  // 1. Rule Optimization Recommendations section (FIRST)
  if (data.aiAnalysis?.ruleOptimization) {
    addSectionHeader('Rule Optimization Recommendations', [155, 89, 182]);
    
    const ruleOpt = data.aiAnalysis.ruleOptimization;
    
    // Summary metrics
    const summaryData = [
      ['Rules to Remove', ((ruleOpt.rulesToRemove || []).length !== undefined) ? (ruleOpt.rulesToRemove || []).length.toString() : '0'],
      ['Rules to Modify', ((ruleOpt.rulesToModify || []).length !== undefined) ? (ruleOpt.rulesToModify || []).length.toString() : '0'],
      ['Rules to Consolidate', ((ruleOpt.rulesToConsolidate || []).length !== undefined) ? (ruleOpt.rulesToConsolidate || []).length.toString() : '0'],
      ['Complexity Reduction', ruleOpt.complexityReduction || '0%']
    ];
    
    autoTable(doc, {
      head: [['Optimization Type', 'Count/Value']],
      body: summaryData,
      startY: yPosition,
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [155, 89, 182],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 245, 250]
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 80 }
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 10;
    
    // Detailed recommendations with IP addresses and ports
    if (ruleOpt.rulesToRemove && ruleOpt.rulesToRemove.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(155, 89, 182);
      doc.text('Rules Recommended for Removal:', margin, yPosition);
      yPosition += 8;
      
      const removeData = ruleOpt.rulesToRemove.slice(0, 10).map((rule: any) => [
        rule.name || 'Unknown',
        rule.sourceIp || 'Any',
        rule.destinationIp || 'Any',
        rule.ports || 'Any',
        rule.protocol || 'Any',
        rule.reason || 'Optimization'
      ]);
      
      autoTable(doc, {
        head: [['Rule Name', 'Source IP', 'Dest IP', 'Ports', 'Protocol', 'Reason']],
        body: removeData,
        startY: yPosition,
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          lineColor: [189, 195, 199],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [231, 76, 60],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [253, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { cellWidth: 15 },
          5: { cellWidth: 60 }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;
    }
    
    // Rules to modify with detailed information
    if (ruleOpt.rulesToModify && ruleOpt.rulesToModify.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(155, 89, 182);
      doc.text('Rules Recommended for Modification:', margin, yPosition);
      yPosition += 8;
      
      const modifyData = ruleOpt.rulesToModify.slice(0, 10).map((rule: any) => [
        rule.name || 'Unknown',
        rule.currentConfig || 'Current',
        rule.recommendedConfig || 'Recommended',
        rule.impact || 'Security Enhancement'
      ]);
      
      autoTable(doc, {
        head: [['Rule Name', 'Current Config', 'Recommended Config', 'Impact']],
        body: modifyData,
        startY: yPosition,
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          lineColor: [189, 195, 199],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [243, 156, 18],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [254, 249, 231]
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 40 }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 15;
    }
  }
  
  // 2. Service Tags Inventory section (SECOND)
  if (data.aiAnalysis?.serviceTagAnalysis?.serviceTags) {
    addSectionHeader('Service Tags Inventory', [52, 152, 219]);
    
    const serviceTagsData = data.aiAnalysis.serviceTagAnalysis.serviceTags.slice(0, 15).map((tag: any) => [
      tag.serviceTag || 'Unknown',
      (tag.usageCount !== undefined && tag.usageCount !== null) ? tag.usageCount.toString() : '0',
      tag.direction || 'Both',
      Array.isArray(tag.protocols) ? tag.protocols.join(', ') : (tag.protocols || 'Any'),
      Array.isArray(tag.ports) ? tag.ports.join(', ') : (tag.ports || 'Any'),
      tag.securityImpact || 'Medium'
    ]);
    
    autoTable(doc, {
      head: [['Service Tag', 'Usage Count', 'Direction', 'Protocols', 'Ports', 'Security Impact']],
      body: serviceTagsData,
      startY: yPosition,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [52, 152, 219],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 248, 250]
      },
      columnStyles: {
        0: { cellWidth: 45 }, // Service Tag - wider
        1: { cellWidth: 25 }, // Usage Count
        2: { cellWidth: 25 }, // Direction
        3: { cellWidth: 35 }, // Protocols - wider
        4: { cellWidth: 40 }, // Ports - wider
        5: { cellWidth: 80 }  // Security Impact - much wider
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  
  // 3. Service Tag Analysis & Optimization section (THIRD)
  if (data.aiAnalysis?.serviceTagAnalysis?.recommendations && data.aiAnalysis.serviceTagAnalysis.recommendations.length > 0) {
    addSectionHeader('Service Tag Analysis & Optimization', [142, 68, 173]);
    
    const serviceTagOptData = data.aiAnalysis.serviceTagAnalysis.recommendations.map((rec: any) => [
      rec.type || 'Optimization',
      rec.title || 'Service Tag Recommendation',
      Array.isArray(rec.currentServiceTags) ? rec.currentServiceTags.join(', ') : (rec.currentServiceTags || 'None'),
      Array.isArray(rec.recommendedServiceTags) ? rec.recommendedServiceTags.join(', ') : (rec.recommendedServiceTags || 'Not specified'),
      rec.estimatedSavings || 'Not calculated',
      rec.priority || 'Medium'
    ]);
    
    autoTable(doc, {
      head: [['Type', 'Recommendation', 'Current Tags', 'Recommended Tags', 'Est. Savings', 'Priority']],
      body: serviceTagOptData,
      startY: yPosition,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [142, 68, 173],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [250, 248, 252]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25 },
        5: { cellWidth: 30 }
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  
  // 4. IP Address Inventory Analysis section (FOURTH)
  if (data.aiAnalysis?.ipInventory) {
    addSectionHeader('IP Address Inventory Analysis', [46, 204, 113]);
    
    const ipStats = data.aiAnalysis.ipInventory;
    const statsData = [
      ['Total Unique IPs', (ipStats.totalUniqueIps !== undefined && ipStats.totalUniqueIps !== null) ? ipStats.totalUniqueIps.toString() : '0'],
      ['Duplicate IP Count', (ipStats.duplicateIpCount !== undefined && ipStats.duplicateIpCount !== null) ? ipStats.duplicateIpCount.toString() : '0'],
      ['Consolidation Potential', ipStats.consolidationPotential || 'Low'],
      ['Public IPs', (ipStats.categorizedIps?.public?.length !== undefined) ? ipStats.categorizedIps.public.length.toString() : '0'],
      ['Private IPs', (ipStats.categorizedIps?.private?.length !== undefined) ? ipStats.categorizedIps.private.length.toString() : '0'],
      ['Service Tags', (ipStats.categorizedIps?.serviceTags?.length !== undefined) ? ipStats.categorizedIps.serviceTags.length.toString() : '0']
    ];
    
    autoTable(doc, {
      head: [['Metric', 'Value']],
      body: statsData,
      startY: yPosition,
      styles: { 
        fontSize: 10,
        cellPadding: 4
      },
      headStyles: { 
        fillColor: [46, 204, 113],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 40 }
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 10;
    
    // Detailed IP inventory with ports and protocols
    if (ipStats.ipDetails && ipStats.ipDetails.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 204, 113);
      doc.text('Detailed IP Address Inventory:', margin, yPosition);
      yPosition += 8;
      
      const ipDetailData = ipStats.ipDetails.slice(0, 15).map((detail: any) => [
        detail.ipAddress || 'Unknown',
        detail.type || 'Unknown',
        detail.direction || 'Both',
        Array.isArray(detail.ports) ? detail.ports.join(', ') : (detail.ports || 'Any'),
        detail.protocol || 'Any',
        detail.ruleName || 'Unknown',
        (detail.usageCount !== undefined && detail.usageCount !== null) ? detail.usageCount.toString() : '1'
      ]);
      
      autoTable(doc, {
        head: [['IP Address', 'Type', 'Direction', 'Ports', 'Protocol', 'Rule Name', 'Usage']],
        body: ipDetailData,
        startY: yPosition,
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          lineColor: [189, 195, 199],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [46, 204, 113],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 253, 248]
        },
        columnStyles: {
        0: { cellWidth: 40 }, // IP Address - wider
        1: { cellWidth: 25 }, // Type
        2: { cellWidth: 25 }, // Direction
        3: { cellWidth: 35 }, // Ports - wider
        4: { cellWidth: 25 }, // Protocol
        5: { cellWidth: 60 }, // Rule Name - wider
        6: { cellWidth: 35 }  // Usage - wider
      }
      });
      
      yPosition = doc.lastAutoTable.finalY + 15;
    }
  }
  
  // Duplicate IPs section (part of IP inventory)
  if (data.aiAnalysis?.duplicateIps && data.aiAnalysis.duplicateIps.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(230, 126, 34);
    doc.text('Duplicate IP Address Analysis:', margin, yPosition);
    yPosition += 8;
    
    const dupData = data.aiAnalysis.duplicateIps.map((dup: any) => [
      dup.ipAddress || 'N/A',
      (dup.usageCount !== undefined && dup.usageCount !== null) ? dup.usageCount.toString() : '0',
      dup.severity || 'Medium',
      (dup.rules && Array.isArray(dup.rules)) ? dup.rules.map((r: any) => `${r.ruleName}:${r.priority || 'N/A'}`).join(', ').substring(0, 50) : 'No rules',
      dup.recommendation ? dup.recommendation.substring(0, 40) + '...' : 'Consolidate rules'
    ]);
    
    autoTable(doc, {
      head: [['IP Address', 'Usage Count', 'Severity', 'Affected Rules (Name:Priority)', 'Remediation']],
      body: dupData,
      startY: yPosition,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [230, 126, 34],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [253, 248, 243]
      },
      columnStyles: {
        0: { cellWidth: 40 }, // IP Address - wider
        1: { cellWidth: 25 }, // Usage Count
        2: { cellWidth: 25 }, // Severity
        3: { cellWidth: 90 }, // Affected Rules - much wider
        4: { cellWidth: 70 }  // Remediation - wider
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  
  // 5. Redundant Rule Identification section (FIFTH)
  if (data.aiAnalysis?.redundantRules && data.aiAnalysis.redundantRules.length > 0) {
    addSectionHeader('Redundant Rule Identification', [231, 76, 60]);
    
    const redundantData = data.aiAnalysis.redundantRules.map((redundant: any) => [
      redundant.rule1?.name || 'Unknown',
      redundant.rule2?.name || 'Unknown', 
      redundant.similarityScore ? `${(redundant.similarityScore * 100).toFixed(0)}%` : 'N/A',
      'Any', // Source IP - not available in current data structure
      'Any', // Dest IP - not available in current data structure  
      'Any', // Ports - not available in current data structure
      redundant.recommendation || 'Remove or consolidate'
    ]);
    
    autoTable(doc, {
      head: [['Rule 1', 'Rule 2', 'Similarity', 'Recommendation']],
      body: redundantData.map(row => [row[0], row[1], row[2], row[6]]), // Only show relevant columns
      startY: yPosition,
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [231, 76, 60],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [253, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 70 }, // Rule 1 - wider for full rule names
        1: { cellWidth: 70 }, // Rule 2 - wider for full rule names
        2: { cellWidth: 30 }, // Similarity
        3: { cellWidth: 100 } // Recommendation - much wider
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  
  // Consolidation Opportunities section (part of optimization)
  if (data.aiAnalysis?.consolidationOpportunities && data.aiAnalysis.consolidationOpportunities.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(52, 152, 219);
    doc.text('Rule Consolidation Opportunities:', 20, yPosition);
    yPosition += 8;
    
    const consolidationData = data.aiAnalysis.consolidationOpportunities.map((opp: any) => [
      opp.type || 'General',
      opp.priority || 'Medium',
      opp.description ? (opp.description.length > 60 ? opp.description.substring(0, 60) + '...' : opp.description) : 'No description',
      (opp.rules && Array.isArray(opp.rules)) ? opp.rules.map((r: any) => r.name).join(', ').substring(0, 40) : 'N/A',
      (opp.potentialSavings?.ruleReduction !== undefined && opp.potentialSavings?.ruleReduction !== null) ? opp.potentialSavings.ruleReduction.toString() : '0'
    ]);
    
    autoTable(doc, {
      head: [['Type', 'Priority', 'Description', 'Affected Rules', 'Rule Reduction']],
      body: consolidationData,
      startY: yPosition,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [52, 152, 219],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 248, 250]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 70 },
        3: { cellWidth: 25 },
        4: { cellWidth: 40 }
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  

  

  
  // 6. ASG (Application Security Group) Analysis section (SIXTH)
  if (data.aiAnalysis?.ipAsgAnalysis) {
    addSectionHeader('Application Security Group (ASG) Analysis', [155, 89, 182]);
    
    const asgAnalysis = data.aiAnalysis.ipAsgAnalysis;
    
    // ASG Summary Statistics
    const asgSummaryData = [
      ['Total Unique ASGs', (asgAnalysis.summary?.totalUniqueAsgs !== undefined && asgAnalysis.summary?.totalUniqueAsgs !== null) ? asgAnalysis.summary.totalUniqueAsgs.toString() : '0'],
      ['Inbound Source ASGs', (asgAnalysis.inboundAnalysis?.sourceAsgs?.count !== undefined && asgAnalysis.inboundAnalysis?.sourceAsgs?.count !== null) ? asgAnalysis.inboundAnalysis.sourceAsgs.count.toString() : '0'],
      ['Inbound Destination ASGs', (asgAnalysis.inboundAnalysis?.destinationAsgs?.count !== undefined && asgAnalysis.inboundAnalysis?.destinationAsgs?.count !== null) ? asgAnalysis.inboundAnalysis.destinationAsgs.count.toString() : '0'],
      ['Outbound Source ASGs', (asgAnalysis.outboundAnalysis?.sourceAsgs?.count !== undefined && asgAnalysis.outboundAnalysis?.sourceAsgs?.count !== null) ? asgAnalysis.outboundAnalysis.sourceAsgs.count.toString() : '0'],
      ['Outbound Destination ASGs', (asgAnalysis.outboundAnalysis?.destinationAsgs?.count !== undefined && asgAnalysis.outboundAnalysis?.destinationAsgs?.count !== null) ? asgAnalysis.outboundAnalysis.destinationAsgs.count.toString() : '0'],
      ['Total ASG Usage', (((asgAnalysis.summary?.inboundTotal || 0) + (asgAnalysis.summary?.outboundTotal || 0)) !== undefined) ? ((asgAnalysis.summary?.inboundTotal || 0) + (asgAnalysis.summary?.outboundTotal || 0)).toString() : '0']
    ];
    
    autoTable(doc, {
      head: [['ASG Metric', 'Count']],
      body: asgSummaryData,
      startY: yPosition,
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [155, 89, 182],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 245, 250]
      },
      columnStyles: {
        0: { cellWidth: 100, fontStyle: 'bold' },
        1: { cellWidth: 80 }
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 10;
    
    // Detailed ASG Inventory
    const allAsgs = [
      ...(asgAnalysis.inboundAnalysis?.sourceAsgs?.asgs || []).map((asg: string) => ({ name: asg, direction: 'Inbound', type: 'Source' })),
      ...(asgAnalysis.inboundAnalysis?.destinationAsgs?.asgs || []).map((asg: string) => ({ name: asg, direction: 'Inbound', type: 'Destination' })),
      ...(asgAnalysis.outboundAnalysis?.sourceAsgs?.asgs || []).map((asg: string) => ({ name: asg, direction: 'Outbound', type: 'Source' })),
      ...(asgAnalysis.outboundAnalysis?.destinationAsgs?.asgs || []).map((asg: string) => ({ name: asg, direction: 'Outbound', type: 'Destination' }))
    ];
    
    if (allAsgs.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(155, 89, 182);
      doc.text('Detailed ASG Inventory:', margin, yPosition);
      yPosition += 8;
      
      const asgDetailData = allAsgs.slice(0, 20).map((asg: any) => [
        asg.name || 'Unknown',
        asg.direction || 'Unknown',
        asg.type || 'Unknown',
        'Active', // Status - could be enhanced with actual status
        'Security Segmentation' // Purpose - could be enhanced with actual purpose
      ]);
      
      autoTable(doc, {
        head: [['ASG Name', 'Direction', 'Type', 'Status', 'Purpose']],
        body: asgDetailData,
        startY: yPosition,
        styles: { 
          fontSize: 9,
          cellPadding: 3,
          lineColor: [189, 195, 199],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [155, 89, 182],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 245, 250]
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 35 }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 15;
    }
  }
  
  // CIDR Overlaps section
  if (data.aiAnalysis?.cidrOverlaps && data.aiAnalysis.cidrOverlaps.length > 0) {
    addSectionHeader('Network Overlap Analysis', [241, 196, 15]);
    
    const overlapData = data.aiAnalysis.cidrOverlaps.map((overlap: any) => [
      overlap.network1?.cidr || 'N/A',
      overlap.network2?.cidr || 'N/A',
      overlap.overlapType || 'Unknown',
      overlap.severity || 'Medium',
      overlap.recommendation ? (overlap.recommendation.length > 40 ? overlap.recommendation.substring(0, 40) + '...' : overlap.recommendation) : 'No recommendation'
    ]);
    
    autoTable(doc, {
      head: [['Network 1', 'Network 2', 'Overlap Type', 'Severity', 'Recommendation']],
      body: overlapData,
      startY: yPosition,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [189, 195, 199],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [241, 196, 15],
        textColor: [0, 0, 0],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [254, 252, 235]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 65 }
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  
  // Security Risks section (legacy support)
  if (data.aiAnalysis?.securityRisks && data.aiAnalysis.securityRisks.length > 0) {
    addSectionHeader('Additional Security Risks', [231, 76, 60]);
    
    const riskData: any[] = [];
    data.aiAnalysis.securityRisks.forEach((riskItem: any) => {
      if (riskItem.risks && Array.isArray(riskItem.risks)) {
        riskItem.risks.forEach((risk: any) => {
          riskData.push([
            riskItem.ruleName || 'Unknown Rule',
            riskItem.direction || 'N/A',
            (riskItem.priority !== undefined && riskItem.priority !== null) ? riskItem.priority.toString() : 'N/A',
            risk.type || 'Unknown',
            risk.severity || 'Medium',
            risk.description ? (risk.description.length > 50 ? risk.description.substring(0, 50) + '...' : risk.description) : 'No description'
          ]);
        });
      }
    });
    
    if (riskData.length > 0) {
      autoTable(doc, {
        head: [['Rule Name', 'Direction', 'Priority', 'Risk Type', 'Severity', 'Description']],
        body: riskData,
        startY: yPosition,
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          lineColor: [189, 195, 199],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [231, 76, 60],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [253, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 20 },
          2: { cellWidth: 15 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 70 }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 15;
    }
  }
  
  // Add footer with generation info
  checkPageBreak(40);
  doc.setFillColor(248, 249, 250);
  doc.rect(20, yPosition, pageWidth - 40, 30, 'F');
  doc.setDrawColor(189, 195, 199);
  doc.rect(20, yPosition, pageWidth - 40, 30, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 117, 125);
  doc.text('Report generated by NSG Validation Tool', 25, yPosition + 12);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 25, yPosition + 22);
  doc.text(`Total pages: ${doc.getNumberOfPages()}`, pageWidth - 25, yPosition + 12, { align: 'right' });
  doc.text('© 2025 Azure NSG Management', pageWidth - 25, yPosition + 22, { align: 'right' });
  
  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
  }
  
  // Save PDF
  doc.save(`nsg-validation-report-${data.nsgName}-${new Date().toISOString().split('T')[0]}.pdf`);
};
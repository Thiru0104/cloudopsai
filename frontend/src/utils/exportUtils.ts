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
  
  // AI Recommendations section
  if (data.recommendations && data.recommendations.length > 0) {
    const filteredRecommendations = data.recommendations.filter(rec => 
      rec.type !== 'READY_TO_IMPLEMENT' &&
      rec.type !== 'REDUNDANT_RULE' &&
      !String(rec.title || '').toLowerCase().includes('redundant')
    );
    
    if (filteredRecommendations.length > 0) {
      csvContent.push(['AI PROPOSED ACTIONABLE RECOMMENDATION']);
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
    csvContent.push(['IP Address', 'Usage Count', 'Severity', 'Rules (Name - Priority)', 'Recommendation']);
    data.aiAnalysis.duplicateIps.forEach((dup: any) => {
      const ruleNames = dup.rules.map((r: any) => `${r.ruleName} (P${r.priority})`).join('; ');
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
        `${overlap.network1.cidr} (${overlap.network1.ruleName} - P${overlap.network1.priority})`,
        `${overlap.network2.cidr} (${overlap.network2.ruleName} - P${overlap.network2.priority})`,
        overlap.overlapType,
        overlap.severity,
        overlap.recommendation
      ]);
    });
    csvContent.push([]);
  }

  // Redundant rules are intentionally excluded from report output

  // Consolidation Opportunities section
  if (data.aiAnalysis?.consolidationOpportunities && data.aiAnalysis.consolidationOpportunities.length > 0) {
    csvContent.push(['CONSOLIDATION OPPORTUNITIES']);
    csvContent.push(['Type', 'Priority', 'Description', 'Affected Rules', 'Rule Reduction', 'Recommendation']);
    data.aiAnalysis.consolidationOpportunities.forEach((opp: any) => {
      csvContent.push([
        opp.type || 'General',
        opp.priority || 'Medium',
        opp.description || 'No description',
        (opp.rules && Array.isArray(opp.rules)) ? opp.rules.map((r: any) => `${r.name} (P${r.priority})`).join('; ') : 'N/A',
        (opp.potentialSavings?.ruleReduction !== undefined) ? opp.potentialSavings.ruleReduction.toString() : '0',
        opp.recommendation || ''
      ]);
    });
    csvContent.push([]);
  }

  // Rule Optimization section
  if (data.aiAnalysis?.ruleOptimization) {
    const ruleOpt = data.aiAnalysis.ruleOptimization;
    
    if (ruleOpt.rulesToRemove && ruleOpt.rulesToRemove.length > 0) {
      csvContent.push(['RULES TO REMOVE']);
      csvContent.push(['Rule Name', 'Source IP', 'Dest IP', 'Ports', 'Protocol', 'Reason']);
      ruleOpt.rulesToRemove.forEach((rule: any) => {
        csvContent.push([
          rule.name || 'Unknown',
          rule.sourceIp || 'Any',
          rule.destinationIp || 'Any',
          rule.ports || 'Any',
          rule.protocol || 'Any',
          rule.reason || 'Optimization'
        ]);
      });
      csvContent.push([]);
    }
    
    if (ruleOpt.rulesToModify && ruleOpt.rulesToModify.length > 0) {
      csvContent.push(['RULES TO MODIFY']);
      csvContent.push(['Rule Name', 'Current Config', 'Recommended Config', 'Impact']);
      ruleOpt.rulesToModify.forEach((rule: any) => {
        csvContent.push([
          rule.name || 'Unknown',
          rule.currentConfig || 'Current',
          rule.recommendedConfig || 'Recommended',
          rule.impact || 'Security Enhancement'
        ]);
      });
      csvContent.push([]);
    }
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

export const exportToPDF = (data: ExportData, limit: number = 15) => {
  const doc = new jsPDF('landscape', 'mm', 'a4'); // Use landscape orientation for better content coverage
  
  let yPosition = 20;
  let recCounter = 1;
  const getNextRecId = () => `[REC-${String(recCounter++).padStart(2, '0')}] `;
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

  // IP & ASG Usage Analysis
  if (data.aiAnalysis) {
    addSectionHeader('IP & ASG Usage Analysis', [52, 152, 219]);
    
    // Inbound Rules Box
    doc.setFillColor(248, 249, 250);
    doc.rect(20, yPosition, pageWidth - 40, 35, 'F');
    doc.setDrawColor(189, 195, 199);
    doc.rect(20, yPosition, pageWidth - 40, 35, 'S');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 204, 113); // Green for Inbound
    doc.text(`↗ Inbound Rules (${data.inboundRules || 0})`, 25, yPosition + 8);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const colWidth = (pageWidth - 50) / 4;
    const inStats = data.aiAnalysis.inboundStats || { sourceIpsAsgs: data.aiAnalysis.sourceIpsCount || 0, destIpsAsgs: data.aiAnalysis.destinationIpsCount || 0, sourceAsgs: 0, destAsgs: 0 };
    
    doc.text('Source IPs + ASGs', 25, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${inStats.sourceIpsAsgs}`, 25, yPosition + 25);
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Dest IPs + ASGs', 25 + colWidth, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${inStats.destIpsAsgs}`, 25 + colWidth, yPosition + 25);
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Source ASGs', 25 + colWidth * 2, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${inStats.sourceAsgs}`, 25 + colWidth * 2, yPosition + 25);
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Dest ASGs', 25 + colWidth * 3, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${inStats.destAsgs}`, 25 + colWidth * 3, yPosition + 25);

    yPosition += 45;

    // Outbound Rules Box
    doc.setFillColor(248, 249, 250);
    doc.rect(20, yPosition, pageWidth - 40, 35, 'F');
    doc.setDrawColor(189, 195, 199);
    doc.rect(20, yPosition, pageWidth - 40, 35, 'S');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(231, 76, 60); // Red for Outbound
    doc.text(`↙ Outbound Rules (${data.outboundRules || 0})`, 25, yPosition + 8);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const outStats = data.aiAnalysis.outboundStats || { sourceIpsAsgs: 0, destIpsAsgs: 0, sourceAsgs: 0, destAsgs: 0 };
    
    doc.text('Source IPs + ASGs', 25, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${outStats.sourceIpsAsgs}`, 25, yPosition + 25);
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Dest IPs + ASGs', 25 + colWidth, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${outStats.destIpsAsgs}`, 25 + colWidth, yPosition + 25);
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Source ASGs', 25 + colWidth * 2, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${outStats.sourceAsgs}`, 25 + colWidth * 2, yPosition + 25);
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Dest ASGs', 25 + colWidth * 3, yPosition + 18);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${outStats.destAsgs}`, 25 + colWidth * 3, yPosition + 25);
    
    yPosition += 45;
  }

  // IP Address Consolidation Section
  if (data.aiAnalysis?.consolidationOpportunities && data.aiAnalysis.consolidationOpportunities.length > 0) {
    addSectionHeader('IP Address Consolidation', [22, 160, 133]);
    
    // Slice to top N groups to avoid massive PDFs
    const topConsolidations = data.aiAnalysis.consolidationOpportunities.slice(0, limit);
    if (data.aiAnalysis.consolidationOpportunities.length > limit) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`Note: Displaying top ${limit} out of ${data.aiAnalysis.consolidationOpportunities.length} consolidation groups. See CSV for full list.`, 25, yPosition);
      yPosition += 12;
    }
    
    let totalConsolidationRuleSlotsSaved = 0;
    
    topConsolidations.forEach((opp: any) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Consolidation Group: ${opp.recommendedCidr || opp.type || 'Suggested Merge'}`, 25, yPosition);
      yPosition += 8;

      let firstDirection = 'Inbound';
      let firstPorts = '*';
      let firstPriority = 100;

      let totalGroupIpSavings = 0;

      const oppData = (opp.rules || []).map((rInfo: any, index: number) => {
        const rName = typeof rInfo === 'string' ? rInfo : (rInfo.ruleName || rInfo.name || '[Unknown Rule]');
        // Fallback: Check original rule data to guarantee we don't have empty cells
        const fullRuleData = data.rules?.find((r: any) => r.name === rName);
        const ruleDetails = data.aiAnalysis.ipInventory?.ipDetails?.find((d: any) => d.ruleName === rName);
        
        const priority = typeof rInfo !== 'string' && rInfo.priority ? rInfo.priority : (ruleDetails?.priority || fullRuleData?.priority || '-');
        
        let sourceIp = '-';
        if (typeof rInfo !== 'string' && rInfo.sourceIp) sourceIp = rInfo.sourceIp;
        else if (ruleDetails?.type === 'source') sourceIp = ruleDetails.ipAddress;
        else if (fullRuleData?.sourceAddressPrefix) sourceIp = fullRuleData.sourceAddressPrefix;
        
        let destIp = '-';
        if (typeof rInfo !== 'string' && rInfo.destinationIp) destIp = rInfo.destinationIp;
        else if (ruleDetails?.type === 'destination') destIp = ruleDetails.ipAddress;
        else if (fullRuleData?.destinationAddressPrefix) destIp = fullRuleData.destinationAddressPrefix;
        
        const ports = typeof rInfo !== 'string' && rInfo.port ? rInfo.port : (ruleDetails?.ports?.destinationPorts || ruleDetails?.ports?.sourcePorts || fullRuleData?.destinationPortRange || '-');
        const direction = typeof rInfo !== 'string' && rInfo.direction ? rInfo.direction : (ruleDetails?.direction || fullRuleData?.direction || '-');
        
        if (priority !== '-' && parseInt(priority.toString()) < 3501) firstPriority = Math.min(firstPriority, parseInt(priority.toString()) - 1);
        if (direction !== '-') firstDirection = direction;
        if (ports !== '-') firstPorts = ports;

        const directionLabel = direction === 'Inbound' ? 'IN' : 'OUT';
        const locationLabel = (sourceIp !== '-' && sourceIp !== '*') ? 'Src' : 'Dest';
        
        // IPs Saved logic: If we keep 1 rule and delete others, we save the IPs in the deleted rules
        const ipsSaved = index === 0 ? 0 : 1; 
        totalGroupIpSavings += ipsSaved;

        return [ 
          rName, 
          priority, 
          sourceIp, 
          destIp, 
          ports, 
          `${directionLabel} / ${locationLabel}`,
          ipsSaved.toString()
        ];
      });

      autoTable(doc, {
        head: [['Rule Name', 'Priority', 'Src IP', 'Dest IP', 'Ports', 'Direction / Location', 'IPs Saved']],
        body: oppData,
        startY: yPosition,
        styles: { fontSize: 7, cellPadding: 3, lineColor: [189, 195, 199], lineWidth: 0.1, overflow: 'linebreak' },
        headStyles: { fillColor: [22, 160, 133], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [232, 246, 243] },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 15 },
          2: { cellWidth: 45 }, 
          3: { cellWidth: 45 }, 
          4: { cellWidth: 30 },
          5: { cellWidth: 25 },
          6: { cellWidth: 15 }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 5) {
            data.cell.styles.fontStyle = 'bold';
            const val = String(data.cell.raw || '').toLowerCase();
            if (val.includes('in') || val.includes('src')) {
              data.cell.styles.textColor = [46, 204, 113];
            } else if (val.includes('out') || val.includes('dest')) {
              data.cell.styles.textColor = [231, 76, 60];
            }
          }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;
      
      // Check proposed rules from AI, or construct one manually
      const proposed = opp.proposedRules?.[0] || {};
      const recId = getNextRecId();
      const newName = String(proposed.ruleName ? `${recId}${proposed.ruleName}` : `${recId}Consolidated-IPs-${firstPriority}`);
      let newSrc = String(proposed.sourceAddress || (firstDirection === 'Inbound' ? (opp.recommendedCidr || opp.type || '*') : '*'));
      let newDest = String(proposed.destinationAddress || (firstDirection === 'Outbound' ? (opp.recommendedCidr || opp.type || '*') : '*'));
      const newPorts = String(proposed.destinationPort || firstPorts || '*');
      const newPriority = String(proposed.priority || Math.max(100, firstPriority));
      const newDirection = String(proposed.direction || firstDirection || 'Inbound');

      // Reconstruct IPs if the LLM truncated them with "..."
      if (newSrc.includes('...')) {
        const allSrcs = Array.from(new Set(oppData.map(d => d[2]).filter(ip => ip && ip !== '*' && ip !== '-')));
        if (allSrcs.length > 0) newSrc = allSrcs.join(', ');
      }
      if (newDest.includes('...')) {
        const allDests = Array.from(new Set(oppData.map(d => d[3]).filter(ip => ip && ip !== '*' && ip !== '-')));
        if (allDests.length > 0) newDest = allDests.join(', ');
      }

      // Use autoTable for the recommendation block to prevent text squishing/overlapping
      autoTable(doc, {
        head: [[`${recId}Recommendation - Implement the following rule and delete the above:`]],
        body: [
          [`Rule Name: ${newName}\nPriority: ${newPriority}    Direction: ${newDirection}    Ports: ${newPorts}\nSource: ${newSrc}\nDestination: ${newDest}`]
        ],
        startY: yPosition,
        styles: { 
          fontSize: 9, 
          cellPadding: 4, 
          lineColor: [22, 160, 133], 
          lineWidth: 0.5,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: { 
          fillColor: [248, 249, 250], 
          textColor: [22, 160, 133], 
          fontStyle: 'bold' 
        },
        bodyStyles: {
          fillColor: [248, 249, 250],
          textColor: [0, 0, 0]
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;
      
      totalConsolidationRuleSlotsSaved += Math.max(0, (opp.rules?.length || 0) - 1);
      
      checkPageBreak(50);
    });
    
    // Print summary at the end of the section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 160, 133);
    doc.text(`Consolidation Summary: Saved ${totalConsolidationRuleSlotsSaved} Rule Slots`, 25, yPosition);
    yPosition += 15;
  }
  
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
  
  // AI Recommendations section
  if (data.recommendations) {
    const filteredRecommendations = (data.recommendations || []).filter(rec => 
      rec.type !== 'READY_TO_IMPLEMENT' &&
      rec.type !== 'REDUNDANT_RULE' &&
      !String(rec.title || '').toLowerCase().includes('redundant')
    );
    
    addSectionHeader('AI proposed actionable recommendation', [46, 204, 113]);
    
    const recData = filteredRecommendations.length > 0 
      ? filteredRecommendations.map(rec => {
          const priorityColor = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
          return [
            `${getNextRecId()}${rec.title || 'No title'}`,
            rec.type || 'General',
            `${priorityColor} ${rec.priority || 'Medium'}`,
            rec.description || 'No description',
            rec.impact || 'Not specified'
          ];
        })
      : [['No actionable recommendations identified', '-', '-', '-', '-']];
      
      autoTable(doc, {
        head: [['Recommendation', 'Category', 'Priority', 'Actionable Guidance', 'Impact']],
        body: recData,
        startY: yPosition,
        styles: { 
          fontSize: 9,
          cellPadding: 4,
          lineColor: [189, 195, 199],
          lineWidth: 0.1,
          overflow: 'linebreak'
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
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 140 }, // Expand description column
          4: { cellWidth: 35 }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 15;

      // Add proposed rules tables if available
      filteredRecommendations.forEach(rec => {
        if (rec.proposedRules && rec.proposedRules.length > 0) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(41, 128, 185);
          doc.text(`Recommended Rules for: ${rec.title}`, 20, yPosition);
          yPosition += 5;

          const rulesData = rec.proposedRules.map((rule: any) => [
            rule.nsgName || '-',
            rule.ruleName || '-',
            rule.direction || '-',
            rule.priority || '-',
            rule.access || '-',
            rule.protocol || '-',
            rule.sourcePort || '-',
            rule.destinationPort || '-',
            rule.sourceAddress || '-',
            rule.destinationAddress || '-',
            rule.sourceAsg || '-',
            rule.destinationAsg || '-'
          ]);

          autoTable(doc, {
          head: [['NSG Name', 'Rule Name', 'Direction', 'Priority', 'Access', 'Protocol', 'Source Port', 'Dest Port', 'Source Addr', 'Dest Addr', 'Source ASG', 'Dest ASG']],
          body: rulesData,
          startY: yPosition,
          styles: { fontSize: 7, cellPadding: 2, lineColor: [189, 195, 199], lineWidth: 0.1, overflow: 'linebreak' },
          headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [240, 248, 255] },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 20 },
            2: { cellWidth: 12 },
            3: { cellWidth: 10 },
            4: { cellWidth: 10 },
            5: { cellWidth: 12 },
            6: { cellWidth: 12 },
            7: { cellWidth: 12 },
            8: { cellWidth: 25 },
            9: { cellWidth: 25 },
            10: { cellWidth: 10 },
            11: { cellWidth: 10 }
          }
        });
          yPosition = doc.lastAutoTable.finalY + 15;
        }
      });
  }

  // 1.5 Duplicate IP Addresses Section - ENABLED
  if (data.aiAnalysis?.duplicateIps && data.aiAnalysis.duplicateIps.length > 0) {
    addSectionHeader('Duplicate IP Addresses', [230, 126, 34]); // Carrot Orange
    
    const topDuplicates = data.aiAnalysis.duplicateIps.slice(0, limit);
    if (data.aiAnalysis.duplicateIps.length > limit) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`Note: Displaying top ${limit} out of ${data.aiAnalysis.duplicateIps.length} duplicate IP groups. See CSV for full list.`, 25, yPosition);
      yPosition += 12;
    }
    
    let totalIpSlotsSaved = 0;
    let totalRuleSlotsSaved = 0;

    topDuplicates.forEach((dup: any) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Duplicate IP Group: ${dup.ipAddress || 'Unknown'} (Used in ${dup.usageCount || 0} rules)`, 25, yPosition);
      yPosition += 8;

      let firstDirection = 'Inbound';
      let firstPorts = '*';
      let firstPriority = 100;

      const rulesInfo = (dup.rules || []).map((rInfo: any, index: number) => {
        const rName = typeof rInfo === 'string' ? rInfo : (rInfo.ruleName || rInfo.name || '[Unknown Rule]');
        const ruleDetails = data.aiAnalysis.ipInventory?.ipDetails?.find((d: any) => d.ruleName === rName && d.ipAddress === dup.ipAddress);
        const fullRuleData = data.rules?.find((r: any) => r.name === rName);
        
        const priority = rInfo.priority || ruleDetails?.priority || fullRuleData?.priority || '-';
        const ports = ruleDetails?.ports?.destinationPorts || ruleDetails?.ports?.sourcePorts || fullRuleData?.destinationPortRange || '-';
        const location = rInfo.location || rInfo.type || ruleDetails?.type || (fullRuleData?.direction === 'Inbound' ? 'source' : 'destination') || '-';
        const direction = rInfo.direction || fullRuleData?.direction || 'Inbound';

        if (priority !== '-' && parseInt(priority.toString()) < 3501) firstPriority = Math.min(firstPriority, parseInt(priority.toString()) - 1);
        if (direction !== '-') firstDirection = direction;
        if (ports !== '-') firstPorts = ports;

        const directionLabel = direction === 'Inbound' ? 'IN' : 'OUT';
        const locationLabel = location === 'source' ? 'Src' : 'Dest';
        const ipsSaved = index === 0 ? 0 : 1;

        return [
          rName,
          priority,
          dup.ipAddress || '-',
          ports,
          `${directionLabel} / ${locationLabel}`,
          ipsSaved.toString()
        ];
      });

      const affectedData = rulesInfo.length > 0 ? rulesInfo : [[ '-', '-', dup.ipAddress || '-', '-', '-', '0' ]];

      autoTable(doc, {
        head: [['Rule Name', 'Priority', 'IP Config to Change', 'Ports', 'Direction / Location', 'IPs Saved']],
        body: affectedData,
        startY: yPosition,
        styles: { fontSize: 8, cellPadding: 3, lineColor: [189, 195, 199], lineWidth: 0.1, overflow: 'linebreak' },
        headStyles: { fillColor: [230, 126, 34], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [253, 246, 233] },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 15 },
          2: { cellWidth: 45 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30 },
          5: { cellWidth: 15 }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 4) {
            data.cell.styles.fontStyle = 'bold';
            const val = String(data.cell.raw || '').toLowerCase();
            if (val.includes('in') || val.includes('src')) {
              data.cell.styles.textColor = [46, 204, 113];
            } else if (val.includes('out') || val.includes('dest')) {
              data.cell.styles.textColor = [231, 76, 60];
            }
          }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;
      
      const proposed = dup.proposedRules?.[0] || {};
      const recId = getNextRecId();
      const newName = String(proposed.ruleName ? `${recId}${proposed.ruleName}` : `${recId}Consolidated-${String(dup.ipAddress || '').replace(/\./g, '-')}`);
      let newSrc = String(proposed.sourceAddress || (firstDirection === 'Inbound' ? dup.ipAddress : '*'));
      let newDest = String(proposed.destinationAddress || (firstDirection === 'Outbound' ? dup.ipAddress : '*'));
      const newPorts = String(proposed.destinationPort || firstPorts || '*');
      const newPriority = String(proposed.priority || Math.max(100, firstPriority));
      const newDirection = String(proposed.direction || firstDirection || 'Inbound');

      // Reconstruct IPs if the LLM truncated them with "..."
      if (newSrc.includes('...')) {
        const allSrcs = Array.from(new Set(rulesInfo.map((d: any) => d[2]).filter((ip: any) => ip && ip !== '*' && ip !== '-')));
        if (allSrcs.length > 0) newSrc = allSrcs.join(', ');
      }
      if (newDest.includes('...')) {
        const allDests = Array.from(new Set(rulesInfo.map((d: any) => d[2]).filter((ip: any) => ip && ip !== '*' && ip !== '-')));
        if (allDests.length > 0) newDest = allDests.join(', ');
      }

      const recommendationText = dup.recommendation ? dup.recommendation : `Consolidate rules using ${dup.ipAddress}`;

      autoTable(doc, {
        head: [[`${recId}Recommendation - ${recommendationText}`]],
        body: [
          [`Rule Name: ${newName}\nPriority: ${newPriority}    Direction: ${newDirection}    Ports: ${newPorts}\nSource: ${newSrc}\nDestination: ${newDest}`]
        ],
        startY: yPosition,
        styles: { 
          fontSize: 9, 
          cellPadding: 4, 
          lineColor: [230, 126, 34], 
          lineWidth: 0.5,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: { 
          fillColor: [253, 246, 233], 
          textColor: [230, 126, 34], 
          fontStyle: 'bold' 
        },
        bodyStyles: {
          fillColor: [253, 246, 233],
          textColor: [0, 0, 0]
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;

      // Calculate savings for this group
      const rulesSaved = Math.max(0, (dup.usageCount || 0) - 1);
      totalRuleSlotsSaved += rulesSaved;
      totalIpSlotsSaved += rulesSaved; // Roughly 1 IP slot saved per removed duplicate rule

      checkPageBreak(50);
    });

    // Print summary at the end of the section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(230, 126, 34);
    doc.text(`Duplicate IPs Summary: Saved ${totalIpSlotsSaved} IP Address Slots, ${totalRuleSlotsSaved} Rule Slots`, 25, yPosition);
    yPosition += 15;
  }

  // 1.6 CIDR Overlaps Section - ENABLED
  if (data.aiAnalysis?.cidrOverlaps) {
    const uniqueCidrOverlaps = Array.from(
      new Map(
        (data.aiAnalysis.cidrOverlaps || []).map((overlap: any) => {
          const key = [
            overlap?.network1?.ruleId,
            overlap?.network1?.cidr,
            overlap?.network2?.ruleId,
            overlap?.network2?.cidr
          ].join('|');
          return [key, overlap];
        })
      ).values()
    );

    addSectionHeader('CIDR Overlap Analysis', [155, 89, 182]); // Amethyst
    
    const topOverlaps = uniqueCidrOverlaps.slice(0, limit);
    if (uniqueCidrOverlaps.length > limit) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`Note: Displaying top ${limit} out of ${uniqueCidrOverlaps.length} CIDR overlaps. See CSV for full list.`, 25, yPosition);
      yPosition += 12;
    }
    
    let totalCidrRuleSlotsSaved = 0;
    
    topOverlaps.forEach((overlap: any) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`CIDR Overlap: ${overlap.network1?.cidr || 'N/A'} ↔ ${overlap.network2?.cidr || 'N/A'} (${overlap.overlapType || 'Partial'})`, 25, yPosition);
      yPosition += 8;

      const rName1 = overlap.network1?.ruleName;
      const rName2 = overlap.network2?.ruleName;
      const ruleDetails1 = data.aiAnalysis.ipInventory?.ipDetails?.find((d: any) => d.ruleName === rName1);
      const ruleDetails2 = data.aiAnalysis.ipInventory?.ipDetails?.find((d: any) => d.ruleName === rName2);
      const fullRule1 = data.rules?.find((r: any) => r.name === rName1);
      const fullRule2 = data.rules?.find((r: any) => r.name === rName2);
      
      const port1 = ruleDetails1?.ports?.destinationPorts || fullRule1?.destinationPortRange || '-';
      const port2 = ruleDetails2?.ports?.destinationPorts || fullRule2?.destinationPortRange || '-';
      const priority1 = overlap.network1?.priority || ruleDetails1?.priority || fullRule1?.priority || '-';
      const priority2 = overlap.network2?.priority || ruleDetails2?.priority || fullRule2?.priority || '-';
      
      const loc1 = overlap.network1?.location === 'source' ? 'IN / Src' : 'OUT / Dest';
      const loc2 = overlap.network2?.location === 'source' ? 'IN / Src' : 'OUT / Dest';

      const affectedData = [
        [rName1 || '-', priority1, overlap.network1?.cidr || '-', port1, loc1, '0'],
        [rName2 || '-', priority2, overlap.network2?.cidr || '-', port2, loc2, '1']
      ];

      autoTable(doc, {
        head: [['Rule Name', 'Priority', 'CIDR', 'Ports', 'Direction / Location', 'IPs Saved']],
        body: affectedData,
        startY: yPosition,
        styles: { fontSize: 8, cellPadding: 3, lineColor: [189, 195, 199], lineWidth: 0.1, overflow: 'linebreak' },
        headStyles: { fillColor: [155, 89, 182], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 245, 252] },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 15 },
          2: { cellWidth: 45 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30 },
          5: { cellWidth: 15 }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 4) {
            data.cell.styles.fontStyle = 'bold';
            const val = String(data.cell.raw || '').toLowerCase();
            if (val.includes('in') || val.includes('src')) {
              data.cell.styles.textColor = [46, 204, 113];
            } else if (val.includes('out') || val.includes('dest')) {
              data.cell.styles.textColor = [231, 76, 60];
            }
          }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;
      
      const proposed = overlap.proposedRules?.[0] || {};
      const recId = getNextRecId();
      const newName = String(proposed.ruleName ? `${recId} ${proposed.ruleName}` : `${recId} Consolidated-CIDR-Overlap`);
      let newSrc = String(proposed.sourceAddress || '*');
      let newDest = String(proposed.destinationAddress || '*');
      const newPorts = String(proposed.destinationPort || '*');
      const newPriority = String(proposed.priority || Math.min(Number(priority1) || 9999, Number(priority2) || 9999));
      const newDirection = String(proposed.direction || 'Inbound');

      // Reconstruct IPs if the LLM truncated them with "..."
      if (newSrc.includes('...')) {
        const allSrcs = Array.from(new Set(affectedData.map(d => d[2]).filter(ip => ip && ip !== '*' && ip !== '-')));
        if (allSrcs.length > 0) newSrc = allSrcs.join(', ');
      }
      if (newDest.includes('...')) {
        const allDests = Array.from(new Set(affectedData.map(d => d[2]).filter(ip => ip && ip !== '*' && ip !== '-')));
        if (allDests.length > 0) newDest = allDests.join(', ');
      }

      const recommendationText = overlap.recommendation ? overlap.recommendation : `Review and consolidate overlapping CIDRs`;

      autoTable(doc, {
        head: [[`${recId}Recommendation - ${recommendationText}`]],
        body: [
          [`Rule Name: ${newName}\nPriority: ${newPriority}    Direction: ${newDirection}    Ports: ${newPorts}\nSource: ${newSrc}\nDestination: ${newDest}`]
        ],
        startY: yPosition,
        styles: { 
          fontSize: 9, 
          cellPadding: 4, 
          lineColor: [155, 89, 182], 
          lineWidth: 0.5,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: { 
          fillColor: [250, 245, 252], 
          textColor: [155, 89, 182], 
          fontStyle: 'bold' 
        },
        bodyStyles: {
          fillColor: [250, 245, 252],
          textColor: [0, 0, 0]
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 10;
      
      totalCidrRuleSlotsSaved += 1; // Assuming merging 2 rules into 1 saves 1 rule slot
      
      checkPageBreak(50);
    });
    
    // Print summary at the end of the section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(155, 89, 182);
    doc.text(`CIDR Overlaps Summary: Saved ${totalCidrRuleSlotsSaved} IP Address Slots, ${totalCidrRuleSlotsSaved} Rule Slots`, 25, yPosition);
    yPosition += 15;
  }

  // 1.8 Consolidation Opportunities Section
  if (data.aiAnalysis?.consolidationOpportunities) {
    addSectionHeader('Rule Consolidation Opportunities', [46, 204, 113]); // Emerald
    
    const consolidationData = data.aiAnalysis.consolidationOpportunities.length > 0
      ? data.aiAnalysis.consolidationOpportunities.slice(0, limit).map((opp: any) => {
          // Extract the first proposed rule to display as the recommendation
          let proposedRuleStr = '-';
          const recId = getNextRecId();
          if (opp.proposedRules && opp.proposedRules.length > 0) {
            const rule = opp.proposedRules[0];
            proposedRuleStr = `${recId}Rule Name: ${rule.ruleName || 'Consolidated-Rule'}\n` +
                              `Priority: ${rule.priority || 'Next Available'}\n` +
                              `Source: ${rule.sourceAddress || '*'}\n` +
                              `Dest: ${rule.destinationAddress || '*'}\n` +
                              `Ports: ${rule.destinationPort || '*'}\n` +
                              `Direction: ${rule.direction || 'Inbound'}`;
          } else if (opp.recommendedCidr) {
             proposedRuleStr = `${recId}Merge into CIDR: ${opp.recommendedCidr}`;
          }

          return [
            opp.type || 'General',
            opp.priority || 'Medium',
            opp.description || 'No description',
            (opp.rules && Array.isArray(opp.rules)) ? opp.rules.map((r: any) => `${typeof r === 'string' ? r : r.name}`).join(', ') : '0',
            (opp.potentialSavings?.ruleReduction !== undefined) ? opp.potentialSavings.ruleReduction.toString() : '0',
            proposedRuleStr
          ];
        })
      : [['No consolidation opportunities identified', '-', '-', '-', '-', '-']];
    
    autoTable(doc, {
      head: [['Type', 'Priority', 'Description', 'Affected Rules (to remove)', 'Savings', 'Proposed Rule (to include)']],
      body: consolidationData,
      startY: yPosition,
      styles: { 
        fontSize: 8, 
        cellPadding: 3, 
        lineColor: [189, 195, 199], 
        lineWidth: 0.1,
        overflow: 'linebreak'
      },
      headStyles: { fillColor: [46, 204, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [242, 252, 245] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 15 },
        2: { cellWidth: 40 },
        3: { cellWidth: 60 }, // Affected Rules
        4: { cellWidth: 15 },
        5: { cellWidth: 70 }  // Proposed Rule
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;

    // Add proposed rules tables if available
    data.aiAnalysis.consolidationOpportunities.slice(0, limit).forEach((opp: any) => {
      if (opp.proposedRules && opp.proposedRules.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(46, 204, 113);
        doc.text(`Recommended Rules for Consolidation: ${opp.type}`, 20, yPosition);
        yPosition += 5;

        const rulesData = opp.proposedRules.map((rule: any) => [
          rule.nsgName || '-',
          rule.ruleName || '-',
          rule.direction || '-',
          rule.priority || '-',
          rule.access || '-',
          rule.protocol || '-',
          rule.sourcePort || '-',
          rule.destinationPort || '-',
          rule.sourceAddress || '-',
          rule.destinationAddress || '-',
          rule.sourceAsg || '-',
          rule.destinationAsg || '-'
        ]);

        autoTable(doc, {
          head: [['NSG Name', 'Rule Name', 'Direction', 'Priority', 'Access', 'Protocol', 'Source Port', 'Dest Port', 'Source Addr', 'Dest Addr', 'Source ASG', 'Dest ASG']],
          body: rulesData,
          startY: yPosition,
          styles: { fontSize: 7, cellPadding: 2, lineColor: [189, 195, 199], lineWidth: 0.1, overflow: 'linebreak' },
          headStyles: { fillColor: [46, 204, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [242, 252, 245] },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 20 },
            2: { cellWidth: 12 },
            3: { cellWidth: 10 },
            4: { cellWidth: 10 },
            5: { cellWidth: 12 },
            6: { cellWidth: 12 },
            7: { cellWidth: 12 },
            8: { cellWidth: 25 },
            9: { cellWidth: 25 },
            10: { cellWidth: 10 },
            11: { cellWidth: 10 }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;
      }
    });
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
  if (false && data.aiAnalysis?.serviceTagAnalysis?.serviceTags) {
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
  
  // 4. IP Address Inventory Analysis section - DISABLED
  if (false && data.aiAnalysis?.ipInventory) {
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
    
    // Detailed IP inventory section removed
  if (false && ipStats.ipDetails && ipStats.ipDetails.length > 0) {
    // Code removed as per user request
  }
  }
  
  // Duplicate IPs section (part of IP inventory)
  if (false && data.aiAnalysis?.duplicateIps && data.aiAnalysis.duplicateIps.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(230, 126, 34);
    doc.text('Duplicate IP Address Analysis:', margin, yPosition);
    yPosition += 8;
    
    const dupData = data.aiAnalysis.duplicateIps.map((dup: any) => [
      dup.ipAddress || 'N/A',
      (dup.usageCount !== undefined && dup.usageCount !== null) ? dup.usageCount.toString() : '0',
      dup.severity || 'Medium',
      (dup.rules && Array.isArray(dup.rules)) ? dup.rules.map((r: any) => `${r.ruleName}:${r.priority || 'N/A'}`).join(', ') : 'No rules',
      dup.recommendation ? `${getNextRecId()}${dup.recommendation}` : 'Consolidate rules'
    ]);
    
    autoTable(doc, {
      head: [['IP Address', 'Usage Count', 'Severity', 'Affected Rules (Name:Priority)', 'Remediation']],
      body: dupData,
      startY: yPosition,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [189, 195, 199],
        lineWidth: 0.1,
        overflow: 'linebreak'
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
        0: { cellWidth: 35 }, // IP Address
        1: { cellWidth: 20 }, // Usage Count
        2: { cellWidth: 25 }, // Severity
        3: { cellWidth: 95 }, // Affected Rules - wider to show more
        4: { cellWidth: 80 }  // Remediation - wider to show more
      }
    });
    
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  
  // 1.7 Redundant Rules Section
  if (data.aiAnalysis?.redundantRules) {
    addSectionHeader('Redundant Rule identification', [231, 76, 60]);
    
    const redundantData = data.aiAnalysis.redundantRules.length > 0
      ? data.aiAnalysis.redundantRules.map((redundant: any) => [
          redundant.rule1?.name || 'Unknown',
          redundant.rule2?.name || 'Unknown', 
          redundant.similarityScore ? `${(redundant.similarityScore * 100).toFixed(0)}%` : 'N/A',
          'Any', // Source IP - not available in current data structure
          'Any', // Dest IP - not available in current data structure  
          'Any', // Ports - not available in current data structure
          redundant.recommendation || 'Remove or consolidate'
        ])
      : [['No redundant rules detected', '-', '-', '-', '-', '-', '-']];
    
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
  
  // Consolidation Opportunities section (part of optimization) - DISABLED (Duplicate of 1.8)
  if (false && data.aiAnalysis?.consolidationOpportunities && data.aiAnalysis.consolidationOpportunities.length > 0) {
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
  if (false && data.aiAnalysis?.ipAsgAnalysis) {
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
  
  // Network Overlap Analysis section removed as per user request
  if (false && data.aiAnalysis?.cidrOverlaps && data.aiAnalysis.cidrOverlaps.length > 0) {
    // Code removed
  }
  
  // Security Risks section (legacy support)
  if (data.aiAnalysis?.securityRisks) {
    addSectionHeader('Additional security risks and recommendation and proposed rules', [231, 76, 60]);
    
    const riskData: any[] = [];
    if (data.aiAnalysis.securityRisks.length > 0) {
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
    }
    
    if (riskData.length === 0) {
      riskData.push(['No additional security risks identified', '-', '-', '-', '-', '-']);
    }
    
    autoTable(doc, {
        head: [['Rule Name', 'Direction', 'Priority', 'Risk Type', 'Severity', 'Description']],
        body: riskData,
        startY: yPosition,
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          lineColor: [189, 195, 199],
          lineWidth: 0.1,
          overflow: 'linebreak'
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

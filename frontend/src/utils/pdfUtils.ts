import jsPDF from 'jspdf';

interface NSGRule {
  name: string;
  priority: number;
  direction: string;
  access: string;
  protocol: string;
  sourcePortRange: string;
  destinationPortRange: string;
  sourceAddressPrefix: string;
  destinationAddressPrefix: string;
  description?: string;
}

interface NSGData {
  name: string;
  resourceGroup: string;
  subscriptionId: string;
  location: string;
  rules: NSGRule[];
  totalRules: number;
  inboundRules: number;
  outboundRules: number;
}

interface AIAnalysis {
  ipInventoryExists: boolean;
  sourceIpsCount: number;
  destinationIpsCount: number;
  sourceIps: string[];
  destinationIps: string[];
  securityRisks: Array<{
    risk: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;
  portAnalysis: Array<{
    port: string;
    protocol: string;
    risk: string;
    recommendation: string;
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    priority: string;
    remediation: string;
  }>;
}

export const generateNSGPDFReport = (nsgData: NSGData, aiAnalysis: AIAnalysis) => {
  const doc = new jsPDF('landscape', 'mm', 'a4'); // Use landscape orientation
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let yPosition = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.35); // Return height used
  };

  // Title Page
  doc.setFillColor(41, 128, 185); // Blue background
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('NSG Validation Report', pageWidth / 2, 35, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 50, { align: 'center' });
  
  yPosition = 80;
  doc.setTextColor(0, 0, 0); // Black text

  // NSG Overview Section
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('NSG Overview', margin, yPosition);
  yPosition += 15;

  // NSG Details Box
  doc.setFillColor(248, 249, 250); // Light gray background
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 50, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 50, 'S');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('NSG Name:', margin + 10, yPosition + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(nsgData.name, margin + 60, yPosition + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Resource Group:', margin + 10, yPosition + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(nsgData.resourceGroup, margin + 80, yPosition + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Location:', margin + 10, yPosition + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(nsgData.location, margin + 50, yPosition + 28);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Rules:', margin + 10, yPosition + 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nsgData.totalRules} (${nsgData.inboundRules} Inbound, ${nsgData.outboundRules} Outbound)`, margin + 70, yPosition + 38);

  yPosition += 65;

  // AI Analysis Summary
  checkPageBreak(40);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('AI Analysis Summary', margin, yPosition);
  yPosition += 15;

  // IP Inventory Section
  doc.setFillColor(232, 245, 233); // Light green background
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 35, 'F');
  doc.setDrawColor(76, 175, 80);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 35, 'S');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('IP Inventory Status:', margin + 10, yPosition + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(aiAnalysis.ipInventoryExists ? 'Available' : 'Not Available', margin + 90, yPosition + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Source IPs:', margin + 10, yPosition + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${aiAnalysis.sourceIpsCount} unique addresses`, margin + 60, yPosition + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Destination IPs:', margin + 10, yPosition + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(`${aiAnalysis.destinationIpsCount} unique addresses`, margin + 80, yPosition + 28);

  yPosition += 50;

  // Source IP Addresses
  if (aiAnalysis.sourceIps && aiAnalysis.sourceIps.length > 0) {
    checkPageBreak(30 + aiAnalysis.sourceIps.length * 8);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Source IP Addresses & Service Tags', margin, yPosition);
    yPosition += 15;

    aiAnalysis.sourceIps.forEach((ip) => {
      checkPageBreak(12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`• ${ip}`, margin + 10, yPosition);
      yPosition += 8;
    });
    yPosition += 10;
  }

  // Destination IP Addresses
  if (aiAnalysis.destinationIps && aiAnalysis.destinationIps.length > 0) {
    checkPageBreak(30 + aiAnalysis.destinationIps.length * 8);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Destination IP Addresses & Service Tags', margin, yPosition);
    yPosition += 15;

    aiAnalysis.destinationIps.forEach((ip) => {
      checkPageBreak(12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`• ${ip}`, margin + 10, yPosition);
      yPosition += 8;
    });
    yPosition += 10;
  }

  // Security Risks Section
  if (aiAnalysis.securityRisks && aiAnalysis.securityRisks.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 53, 69); // Red color for risks
    doc.text('Security Risks Identified', margin, yPosition);
    doc.setTextColor(0, 0, 0); // Back to black
    yPosition += 20;

    aiAnalysis.securityRisks.forEach((risk) => {
      checkPageBreak(60);
      
      // Risk box
      const severityColor = risk.severity === 'High' ? [220, 53, 69] : 
                           risk.severity === 'Medium' ? [255, 193, 7] : [40, 167, 69];
      
      doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      doc.rect(margin, yPosition - 5, 15, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(risk.severity.toUpperCase(), margin + 7.5, yPosition, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(risk.risk, margin + 20, yPosition);
      yPosition += 12;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const descHeight = addWrappedText(risk.description, margin + 10, yPosition, pageWidth - 2 * margin - 20, 10);
      yPosition += descHeight + 5;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Recommendation:', margin + 10, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      const recHeight = addWrappedText(risk.recommendation, margin + 10, yPosition, pageWidth - 2 * margin - 20, 10);
      yPosition += recHeight + 15;
    });
  }

  // Port Analysis Section
  if (aiAnalysis.portAnalysis && aiAnalysis.portAnalysis.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Port Analysis', margin, yPosition);
    yPosition += 20;

    aiAnalysis.portAnalysis.forEach((port) => {
      checkPageBreak(50);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Port ${port.port} (${port.protocol})`, margin + 10, yPosition);
      yPosition += 12;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Risk: ${port.risk}`, margin + 15, yPosition);
      yPosition += 8;
      
      const recHeight = addWrappedText(`Recommendation: ${port.recommendation}`, margin + 15, yPosition, pageWidth - 2 * margin - 30, 10);
      yPosition += recHeight + 10;
    });
  }

  // Recommendations Section
  if (aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 167, 69); // Green color
    doc.text('AI Recommendations', margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 20;

    aiAnalysis.recommendations.forEach((rec) => {
      checkPageBreak(70);
      
      // Priority indicator
      const priorityColor = rec.priority === 'High' ? [220, 53, 69] : 
                           rec.priority === 'Medium' ? [255, 193, 7] : [40, 167, 69];
      
      doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
      doc.rect(margin, yPosition - 5, 15, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(rec.priority.toUpperCase(), margin + 7.5, yPosition, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(rec.title, margin + 20, yPosition);
      yPosition += 12;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const descHeight = addWrappedText(rec.description, margin + 10, yPosition, pageWidth - 2 * margin - 20, 10);
      yPosition += descHeight + 5;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Remediation Steps:', margin + 10, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      const remHeight = addWrappedText(rec.remediation, margin + 10, yPosition, pageWidth - 2 * margin - 20, 10);
      yPosition += remHeight + 15;
    });
  }

  // NSG Rules Details (New Page)
  doc.addPage();
  yPosition = margin;
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('NSG Rules Details', margin, yPosition);
  yPosition += 20;

  // Rules table header - optimized for landscape
  const tableHeaders = ['Name', 'Priority', 'Direction', 'Access', 'Protocol', 'Source', 'Destination', 'Source Ports', 'Dest Ports'];
  const colWidths = [35, 18, 22, 18, 20, 45, 45, 25, 25]; // Adjusted for landscape
  let xPos = margin;
  
  doc.setFillColor(52, 73, 94); // Dark blue header
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  tableHeaders.forEach((header, index) => {
    doc.text(header, xPos + 2, yPosition + 3);
    xPos += colWidths[index];
  });
  
  yPosition += 15;
  doc.setTextColor(0, 0, 0);
  
  // Rules data
  nsgData.rules.forEach((rule, index) => {
    checkPageBreak(15);
    
    // Alternate row colors
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 12, 'F');
    }
    
    xPos = margin;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    
    const rowData = [
      rule.name.length > 30 ? rule.name.substring(0, 27) + '...' : rule.name,
      (rule.priority !== undefined && rule.priority !== null) ? rule.priority.toString() : 'N/A',
      rule.direction,
      rule.access,
      rule.protocol,
      rule.sourceAddressPrefix.length > 35 ? rule.sourceAddressPrefix.substring(0, 32) + '...' : rule.sourceAddressPrefix,
      rule.destinationAddressPrefix.length > 35 ? rule.destinationAddressPrefix.substring(0, 32) + '...' : rule.destinationAddressPrefix,
      rule.sourcePortRange || '*',
      rule.destinationPortRange || '*'
    ];
    
    rowData.forEach((data, colIndex) => {
      doc.text(data, xPos + 2, yPosition + 3);
      xPos += colWidths[colIndex];
    });
    
    yPosition += 12;
  });

  // Footer on last page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    doc.text('Generated by NSG Validation Tool', margin, pageHeight - 10);
  }

  // Save the PDF
  const fileName = `NSG_Validation_Report_${nsgData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export default generateNSGPDFReport;
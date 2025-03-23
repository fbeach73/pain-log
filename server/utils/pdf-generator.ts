import PDFDocument from 'pdfkit';
import { PainEntry } from '@shared/schema';
import { format } from 'date-fns';

export const generatePainLogPDF = (
  painEntries: PainEntry[],
  userName: string,
  periodStart: string,
  periodEnd: string
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({ 
        size: 'A4',
        margin: 50,
        info: {
          Title: `Pain Log Report - ${userName}`,
          Author: 'PainTracker by PainClinics.com',
          Subject: `Pain Log Report for period ${periodStart} to ${periodEnd}`,
        }
      });
      
      // Store PDF content in a buffer
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      
      // Header
      doc.fontSize(24)
        .fillColor('#0047AB')
        .text('Pain Log Report', { align: 'center' });
      
      doc.moveDown()
        .fontSize(14)
        .fillColor('#444444')
        .text(`Generated for: ${userName}`, { align: 'center' });
      
      doc.moveDown(0.5)
        .fontSize(12)
        .text(`Period: ${periodStart} to ${periodEnd}`, { align: 'center' });
      
      doc.moveDown(0.5)
        .text(`Generated on: ${format(new Date(), 'MMMM d, yyyy')}`, { align: 'center' });
      
      // Divider
      doc.moveDown()
        .strokeColor('#0047AB')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();
      
      // Summary Statistics
      doc.moveDown(1.5)
        .fontSize(16)
        .fillColor('#0047AB')
        .text('Summary Statistics', { underline: true });
      
      doc.moveDown()
        .fontSize(12)
        .fillColor('#444444');
      
      // Calculate statistics
      const entriesCount = painEntries.length;
      const avgIntensity = entriesCount > 0
        ? parseFloat((painEntries.reduce((sum, entry) => sum + entry.intensity, 0) / entriesCount).toFixed(1))
        : 0;
      
      // Count locations and triggers
      const locationCounts = new Map<string, number>();
      const triggerCounts = new Map<string, number>();
      
      painEntries.forEach(entry => {
        // Count locations
        if (entry.locations) {
          entry.locations.forEach(location => {
            locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
          });
        }
        
        // Count triggers
        if (entry.triggers) {
          entry.triggers.forEach(trigger => {
            triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
          });
        }
      });
      
      // Get most common location and trigger
      const mostCommonLocation = entriesCount > 0
        ? [...locationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None recorded'
        : 'None recorded';
      
      const mostCommonTrigger = entriesCount > 0
        ? [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None recorded'
        : 'None recorded';
      
      // Add summary stats to PDF
      doc.text(`Total Pain Entries: ${entriesCount}`);
      doc.moveDown(0.5).text(`Average Pain Intensity: ${avgIntensity} / 10`);
      doc.moveDown(0.5).text(`Most Common Pain Location: ${mostCommonLocation}`);
      doc.moveDown(0.5).text(`Most Common Trigger: ${mostCommonTrigger}`);
      
      // Pain entries detail section
      doc.moveDown(1.5)
        .fontSize(16)
        .fillColor('#0047AB')
        .text('Detailed Pain Entries', { underline: true });
      
      // Sort entries by date, most recent first
      const sortedEntries = [...painEntries].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      // Add each entry
      sortedEntries.forEach((entry, index) => {
        // New page if needed
        if (doc.y > doc.page.height - 200 && index < sortedEntries.length - 1) {
          doc.addPage();
        }
        
        doc.moveDown(1)
          .fontSize(14)
          .fillColor('#0047AB')
          .text(`Entry ${index + 1}: ${format(new Date(entry.date), 'MMMM d, yyyy')}`);
        
        doc.moveDown(0.5)
          .fontSize(12)
          .fillColor('#444444')
          .text(`Pain Level: ${entry.intensity} / 10`);
        
        if (entry.locations && entry.locations.length > 0) {
          doc.moveDown(0.5)
            .text(`Locations: ${entry.locations.join(', ')}`);
        }
        
        if (entry.characteristics && entry.characteristics.length > 0) {
          doc.moveDown(0.5)
            .text(`Characteristics: ${entry.characteristics.join(', ')}`);
        }
        
        if (entry.triggers && entry.triggers.length > 0) {
          doc.moveDown(0.5)
            .text(`Triggers: ${entry.triggers.join(', ')}`);
        }
        
        if (entry.medicationTaken) {
          doc.moveDown(0.5)
            .text(`Medication Taken: Yes${entry.medications ? ` (${entry.medications.join(', ')})` : ''}`);
        }
        
        if (entry.notes) {
          doc.moveDown(0.5)
            .text(`Notes: ${entry.notes}`);
        }
        
        // Add a divider between entries
        if (index < sortedEntries.length - 1) {
          doc.moveDown(0.5)
            .strokeColor('#CCCCCC')
            .lineWidth(0.5)
            .moveTo(50, doc.y)
            .lineTo(doc.page.width - 50, doc.y)
            .stroke();
        }
      });
      
      // Add footer
      doc.fontSize(10)
        .fillColor('#888888')
        .text(
          'Generated by PainTracker by PainClinics.com',
          50,
          doc.page.height - 50,
          { align: 'center' }
        );
      
      // Finalize the PDF
      doc.end();
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
};
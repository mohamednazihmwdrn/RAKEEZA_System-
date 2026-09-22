import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'a5' | 'letter';
  margin?: number; // in mm
  scale?: number;
}

/**
 * High-definition PDF exporter using html2canvas & jsPDF
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string = 'document.pdf',
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    orientation = 'portrait',
    format = 'a4',
    margin = 5,
    scale = 2,
  } = options;

  try {
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format,
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    // First page
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= usableHeight;

    // Subsequent pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= usableHeight;
    }

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
}

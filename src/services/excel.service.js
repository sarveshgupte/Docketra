const ExcelJS = require('exceljs');

const generateCasesExcelWorkbook = (cases) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Docketra Cases Report');

  // Define columns
  worksheet.columns = [
    { header: 'Case ID', key: 'caseId', width: 12 },
    { header: 'Case Name', key: 'caseName', width: 20 },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Client ID', key: 'clientId', width: 12 },
    { header: 'Client Name', key: 'clientName', width: 25 },
    { header: 'Assigned To', key: 'assignedTo', width: 25 },
    { header: 'Created At', key: 'createdAt', width: 20 },
    { header: 'Created By', key: 'createdBy', width: 25 },
  ];

  // Add rows
  cases.forEach(caseItem => {
    worksheet.addRow({
      caseId: caseItem.caseId,
      caseName: caseItem.caseName,
      title: caseItem.title,
      status: caseItem.status,
      category: caseItem.category,
      clientId: caseItem.clientId,
      clientName: caseItem.clientName,
      assignedTo: caseItem.assignedTo,
      createdAt: caseItem.createdAt ? caseItem.createdAt.toISOString().replace('T', ' ').substring(0, 19) : '',
      createdBy: caseItem.createdBy,
    });
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E5EC' },
  };

  return workbook;
};

module.exports = {
  generateCasesExcelWorkbook,
};

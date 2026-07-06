import { serializeToCSV } from '../../utils/csv.js';

export const RCA_CSV_HEADERS = [
  'RCA ID',
  'Title',
  'Description',
  'Severity',
  'Status',
  'Review Round',
  'Created By Name',
  'Created By Email',
  'Created At',
  'Updated At'
];

export function mapRcaToCsvRow(rca) {
  return [
    rca.id,
    rca.title,
    rca.description || '',
    rca.severity,
    rca.status,
    rca.reviewRound,
    rca.createdBy ? rca.createdBy.name : 'Unknown',
    rca.createdBy ? rca.createdBy.email : '',
    new Date(rca.createdAt).toISOString(),
    new Date(rca.updatedAt).toISOString()
  ];
}

export function rcasToCSV(rcas) {
  const rows = rcas.map(mapRcaToCsvRow);
  return serializeToCSV(RCA_CSV_HEADERS, rows);
}

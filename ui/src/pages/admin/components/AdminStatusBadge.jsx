import { Badge } from '../../../components/common/Badge';

const statusToTone = {
  ACTIVE: 'Approved',
  INVITED: 'Pending',
  INACTIVE: 'Rejected',
  DISABLED: 'Rejected',
};

export const AdminStatusBadge = ({ status, fallback = 'ACTIVE' }) => {
  const normalizedStatus = String(status || fallback).toUpperCase();
  return <Badge status={statusToTone[normalizedStatus] || 'Pending'}>{normalizedStatus}</Badge>;
};

export default AdminStatusBadge;

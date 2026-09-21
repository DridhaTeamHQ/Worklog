import React from 'react';
import { Badge } from './Badge';
import { Priority, TicketSeverity } from '../types';

export function PriorityBadge({ priority }: { priority: Priority | TicketSeverity }) {
  switch (priority) {
    case 'urgent':
    case 'critical':
      return <Badge label={priority.toUpperCase()} variant="danger" />;
    case 'high':
      return <Badge label="HIGH" variant="warning" />;
    case 'medium':
      return <Badge label="MEDIUM" variant="info" />;
    case 'low':
      return <Badge label="LOW" variant="success" />;
    default:
      return <Badge label={String(priority).toUpperCase()} variant="neutral" />;
  }
}

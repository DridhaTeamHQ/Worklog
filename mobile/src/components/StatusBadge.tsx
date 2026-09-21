import React from 'react';
import { Badge } from './Badge';
import { EffectiveStatus, TaskStatus, TicketStatus } from '../types';

export function StatusBadge({ status }: { status: EffectiveStatus | TaskStatus | TicketStatus | 'idle' }) {
  switch (status) {
    case 'completed':
    case 'resolved':
    case 'closed':
      return <Badge label={status.replace('_', ' ').toUpperCase()} variant="success" />;
    case 'in_progress':
      return <Badge label="IN PROGRESS" variant="info" />;
    case 'pending':
    case 'open':
      return <Badge label={status.toUpperCase()} variant="warning" />;
    case 'overdue':
      return <Badge label="OVERDUE" variant="danger" />;
    case 'idle':
      return <Badge label="IDLE" variant="neutral" />;
    default:
      return <Badge label={String(status).toUpperCase()} variant="neutral" />;
  }
}

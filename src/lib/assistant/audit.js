import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export async function logAssistantAudit({ command, action, entity, success, source = 'text', details = '' }) {
  const id = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await setDoc(doc(db, 'assistantAuditLogs', id), {
    id,
    timestamp: new Date().toISOString(),
    user: 'local-session',
    command,
    action,
    entity,
    success,
    source,
    details,
  });
}

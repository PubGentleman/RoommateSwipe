import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  runResponseStatusCheck,
  sendResponsePendingNotification,
  calculateResponseRate,
  ResponseAlert,
} from '../services/responseTrackingService';

const CHECK_INTERVAL = 60 * 60 * 1000;
const NOTIFIED_KEY = 'response_notified_conversations';

export function useResponseTracking() {
  const { user } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCheck = useCallback(async () => {
    if (!user) return;

    try {
      const alerts = await runResponseStatusCheck();

      for (const alert of alerts) {
        const notifKey = `${alert.conversationId}_${alert.status}`;
        if (alert.status === 'delayed' && !notifiedRef.current.has(notifKey)) {
          const targetUserId = alert.renterId || user.id;
          if (targetUserId) {
            await sendResponsePendingNotification(
              targetUserId,
              alert.agentName,
              alert.conversationId
            );
            notifiedRef.current.add(notifKey);
          }
        }

        if (alert.status === 'critical' || alert.status === 'unresponsive') {
          await calculateResponseRate(alert.agentId);
        }
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;

    runCheck();

    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, runCheck]);

  return { runCheck };
}

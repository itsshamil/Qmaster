
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export type NotificationSentiment = 'relax' | 'close' | 'urgent' | 'next' | 'completed';

interface UseQueueNotificationsProps {
    tokenId?: string;
    queuePosition?: number;
    estimatedWaitMins?: number;
    status?: string;
}

export function useQueueNotifications({ tokenId, queuePosition, estimatedWaitMins, status }: UseQueueNotificationsProps) {
    const lastNotifiedState = useRef<NotificationSentiment | null>(null);
    const storageKey = tokenId ? `notified_state_${tokenId}` : null;

    useEffect(() => {
        // Request permission on mount if supported
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Initialize state from storage for this specific token
        if (storageKey) {
            const saved = sessionStorage.getItem(storageKey);
            if (saved) {
                lastNotifiedState.current = saved as NotificationSentiment;
            }
        }
    }, [storageKey]);

    useEffect(() => {
        if (!status || status === 'cancelled' || status === 'completed') return;

        // Only notify for waiting/serving status
        if (status !== 'waiting' && status !== 'serving') return;

        // Calculate current state
        let currentState: NotificationSentiment = 'relax';

        if (queuePosition === 1) {
            currentState = 'next';
        } else if ((queuePosition !== undefined && queuePosition <= 3) || (estimatedWaitMins !== undefined && estimatedWaitMins < 10)) {
            currentState = 'urgent';
        } else if ((estimatedWaitMins !== undefined && estimatedWaitMins <= 20)) {
            currentState = 'close';
        } else {
            currentState = 'relax';
        }

        // Debounce: verify we haven't already notified for this state (or a more urgent one)
        if (currentState === lastNotifiedState.current) return;

        // Trigger Notifications
        const sendNotification = (title: string, body: string, icon = '/favicon.ico') => {
            // Browser Notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body, icon });
            }
            // App Toast
            toast(title, { description: body, duration: 5000 });

            // Persist state
            lastNotifiedState.current = currentState;
            if (storageKey) {
                sessionStorage.setItem(storageKey, currentState);
            }
        };

        if (currentState === 'next' && lastNotifiedState.current !== 'next') {
            sendNotification("You are NEXT! 🏃", "Please head to the counter immediately.");
        } else if (currentState === 'urgent' && lastNotifiedState.current !== 'urgent' && lastNotifiedState.current !== 'next') {
            sendNotification("Get Ready! ⚡", "You are almost up (less than 10 mins). Head to the waiting area.");
        } else if (currentState === 'close' && (lastNotifiedState.current === 'relax' || !lastNotifiedState.current)) {
            sendNotification("Getting close... 🚶", "Your turn is coming up in about 20 minutes.");
        }

        // Update state even if we didn't send a notification (to track progression)
        if (!['next', 'urgent', 'close'].includes(currentState)) {
            lastNotifiedState.current = currentState;
            if (storageKey) {
                sessionStorage.setItem(storageKey, currentState);
            }
        }

    }, [queuePosition, estimatedWaitMins, status, storageKey]);

    return {
        sentiment: lastNotifiedState.current || 'relax'
    };
}

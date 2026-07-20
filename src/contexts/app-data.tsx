import React, {
    createContext,
    PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { signOut as authSignOut, bootstrapAuth } from '@/services/auth';
import { setAnalyticsUserId, trackEvent } from '@/services/analytics';
import { getMissingFirebaseKeys } from '@/services/firebase';
import { cancelScheduledNotifications, syncRenewalNotifications } from '@/services/notifications';
import {
    createSubscription,
    deleteSubscription,
    listenToSubscriptions,
    updateSubscription,
} from '@/services/subscriptions';
import { listenToExpenses } from '@/services/expenseService';
import { listenToSplitFriends } from '@/services/splitFriendService';
import { listenToInvoices } from '@/services/invoiceService';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSplitFriendStore } from '@/store/useSplitFriendStore';
import { useInvoiceStore } from '@/store/useInvoiceStore';
import { AppUser } from '@/types/settings';
import { Subscription, SubscriptionInput } from '@/types/subscription';
import { generateSmartAlerts } from '@/utils/ai-engine';
import {
    getCategoryBreakdown,
    getTotalMonthlySpending,
    getUpcomingRenewals,
} from '@/utils/calculations';

type AppStatus = 'booting' | 'missing-config' | 'ready' | 'error';

type AppDataContextValue = {
  status: AppStatus;
  user: AppUser | null;
  subscriptions: Subscription[];
  loadingSubscriptions: boolean;
  error: string | null;
  missingFirebaseKeys: string[];
  notificationsEnabled: boolean;
  totalMonthlySpending: number;
  upcomingRenewals: ReturnType<typeof getUpcomingRenewals>;
  categoryBreakdown: ReturnType<typeof getCategoryBreakdown>;
  smartAlerts: ReturnType<typeof generateSmartAlerts>;
  addSubscription: (input: SubscriptionInput) => Promise<string>;
  saveSubscription: (id: string, input: SubscriptionInput) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => void;
  refreshNotifications: () => Promise<void>;
  retryBootstrap: () => void;
  signOut: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

const AUTH_BOOT_TIMEOUT_MS = 12000;
const SUBSCRIPTIONS_BOOT_TIMEOUT_MS = 12000;

// react-doctor-disable-next-line react-doctor/prefer-useReducer, react-doctor/no-giant-component
export function AppDataProvider({ children }: PropsWithChildren) {
  "use no memo";

  const [status, setStatus] = useState<AppStatus>('booting');
  const bootStartTime = useRef(Date.now());
  const setStatusDelayed = useCallback((nextStatus: AppStatus) => {
    if (nextStatus === 'ready') {
      const elapsed = Date.now() - bootStartTime.current;
      const minDuration = 1800; // 1.8 seconds minimum display time
      if (elapsed < minDuration) {
        setTimeout(() => {
          setStatus('ready');
        }, minDuration - elapsed);
        return;
      }
    }
    setStatus(nextStatus);
  }, []);
  const [user, setUser] = useState<AppUser | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [bootAttempt, setBootAttempt] = useState(0);
  const activeUserIdRef = useRef<string | null>(null);
  const [prevUserId, setPrevUserId] = useState<string | null>(null);

  const currentUserId = user?.uid ?? null;
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    if (user) {
      setLoadingSubscriptions(true);
      setSubscriptions([]);
    }
  }

  useEffect(() => {
    let isActive = true;
    if (bootAttempt > 0) {
      Promise.resolve().then(() => {
        if (!isActive) return;
      setStatus('booting');
    setError(null);
    setUser(null);
    setSubscriptions([]);
    setLoadingSubscriptions(true);
    useExpenseStore.getState().setExpenses([]);
    useExpenseStore.getState().setLoading(true);
    useInvoiceStore.getState().setInvoices([]);
    useInvoiceStore.getState().setLoading(true);
    useSplitFriendStore.getState().setFriends([]);
    useSplitFriendStore.getState().setLoading(true);
      });
    }

    const timeout = setTimeout(() => {
      if (!isActive) return;
      setError(
        'Startup is taking longer than expected. Check your internet connection and confirm Anonymous Auth is enabled in Firebase.'
      );
      setLoadingSubscriptions(false);
      setStatus('error');
    }, AUTH_BOOT_TIMEOUT_MS);

    const result = bootstrapAuth(
      (nextUser) => {
        if (!isActive) return;
        clearTimeout(timeout);
        setError(null);
        activeUserIdRef.current = nextUser?.uid ?? null;
        setUser(nextUser);
        setStatusDelayed('ready');
        if (nextUser) {
          void setAnalyticsUserId(nextUser.uid);
        } else {
          void setAnalyticsUserId(null);
          useExpenseStore.getState().setExpenses([]);
          useExpenseStore.getState().setLoading(true);
          useInvoiceStore.getState().setInvoices([]);
          useInvoiceStore.getState().setLoading(true);
          useSplitFriendStore.getState().setFriends([]);
          useSplitFriendStore.getState().setLoading(true);
        }
      },
      (nextError) => {
        if (!isActive) return;
        clearTimeout(timeout);
        setError(nextError.message);
        setLoadingSubscriptions(false);
        setStatus('error');
      }
    );

    const unsubscribe = result.status === 'missing-config' ? undefined : result.unsubscribe;

    if (result.status === 'missing-config') {
      clearTimeout(timeout);
      setLoadingSubscriptions(false);
      setStatus('missing-config');
    }

    return () => {
      isActive = false;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [bootAttempt]);



  useEffect(() => {
    if (!user) return;

    let isActive = true;
    let receivedInitialSnapshot = false;
    const activeUserId = user.uid;
    activeUserIdRef.current = activeUserId;



    useExpenseStore.getState().setExpenses([]);
    useExpenseStore.getState().setLoading(true);
    useInvoiceStore.getState().setInvoices([]);
    useInvoiceStore.getState().setLoading(true);
    useSplitFriendStore.getState().setFriends([]);
    useSplitFriendStore.getState().setLoading(true);

    const timeout = setTimeout(() => {
      if (!isActive || receivedInitialSnapshot || activeUserIdRef.current !== activeUserId) return;
      setError(
        'We could not finish loading your subscriptions. Check Firestore access, then try again.'
      );
      setLoadingSubscriptions(false);
      setStatus('error');
    }, SUBSCRIPTIONS_BOOT_TIMEOUT_MS);

    const unsubscribe = listenToSubscriptions(
      activeUserId,
      async (nextSubscriptions) => {
        if (!isActive || activeUserIdRef.current !== activeUserId) return;
        receivedInitialSnapshot = true;
        clearTimeout(timeout);
        setSubscriptions(nextSubscriptions);
        setError(null);
        setStatusDelayed('ready');

        setLoadingSubscriptions(false);
      },
      (nextError) => {
        if (!isActive) return;
        clearTimeout(timeout);
        setError(nextError.message);
        setLoadingSubscriptions(false);
        if (!receivedInitialSnapshot) {
          setStatus('error');
        }
      }
    );

    const unsubscribeExpenses = listenToExpenses(
      activeUserId,
      (nextExpenses) => {
        if (!isActive || activeUserIdRef.current !== activeUserId) return;
        useExpenseStore.getState().setExpenses(nextExpenses);
        useExpenseStore.getState().setLoading(false);
      },
      (e) => {
        if (!isActive || activeUserIdRef.current !== activeUserId) return;
        useExpenseStore.getState().setLoading(false);
        console.error("Expense sync error", e);
      }
    );

    const unsubscribeInvoices = listenToInvoices(
      activeUserId,
      (nextInvoices) => {
        if (!isActive || activeUserIdRef.current !== activeUserId) return;
        useInvoiceStore.getState().setInvoices(nextInvoices);
        useInvoiceStore.getState().setLoading(false);
      },
      (e) => {
        if (!isActive || activeUserIdRef.current !== activeUserId) return;
        useInvoiceStore.getState().setLoading(false);
        console.error("Invoice sync error", e);
      }
    );

    const unsubscribeSplitFriends = listenToSplitFriends(
      activeUserId,
      (nextFriends) => {
        if (!isActive || activeUserIdRef.current !== activeUserId) return;
        useSplitFriendStore.getState().setFriends(nextFriends);
        useSplitFriendStore.getState().setLoading(false);
      },
      (e) => {
        if (!isActive || activeUserIdRef.current !== activeUserId) return;
        useSplitFriendStore.getState().setLoading(false);
        console.error('Split friends sync error', e);
      }
    );

    return () => {
      isActive = false;
      clearTimeout(timeout);
      unsubscribe();
      unsubscribeExpenses();
      unsubscribeInvoices();
      unsubscribeSplitFriends();
    };
  }, [user]);

  useEffect(() => {
    if (!notificationsEnabled || subscriptions.length === 0) return;

    syncRenewalNotifications(subscriptions).catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    });
  }, [notificationsEnabled, subscriptions]);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const addSubscription = useCallback(
    async (input: SubscriptionInput) => {
      if (!user) throw new Error('User is not ready');
      const id = await createSubscription(user.uid, input);
      void trackEvent('subscription_created', {
        billing_cycle: input.billingCycle,
        price: input.price,
        category: input.category,
      });
      return id;
    },
    [user]
  );

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const saveSubscription = useCallback(
    async (id: string, input: SubscriptionInput) => {
      if (!user) throw new Error('User is not ready');
      await updateSubscription(user.uid, id, input);
      void trackEvent('subscription_updated', {
        billing_cycle: input.billingCycle,
        price: input.price,
        category: input.category,
      });
    },
    [user]
  );

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const removeSubscription = useCallback(async (id: string) => {
    if (!user) throw new Error('User is not ready');
    await deleteSubscription(user.uid, id);
    void trackEvent('subscription_deleted');
  }, [user]);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const refreshNotifications = useCallback(async () => {
    await syncRenewalNotifications(subscriptions);
  }, [subscriptions]);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const handleSignOut = useCallback(async () => {
    await authSignOut();
    activeUserIdRef.current = null;
    setUser(null);
    setSubscriptions([]);
    setError(null);
    setStatus('booting');
    useExpenseStore.getState().setExpenses([]);
    useExpenseStore.getState().setLoading(true);
    useInvoiceStore.getState().setInvoices([]);
    useInvoiceStore.getState().setLoading(true);
    useSplitFriendStore.getState().setFriends([]);
    useSplitFriendStore.getState().setLoading(true);
    setBootAttempt((c) => c + 1);
  }, []);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const retryBootstrap = useCallback(() => {
    activeUserIdRef.current = null;
    setError(null);
    setStatus('booting');
    setUser(null);
    setSubscriptions([]);
    setLoadingSubscriptions(true);
    useExpenseStore.getState().setExpenses([]);
    useExpenseStore.getState().setLoading(true);
    useInvoiceStore.getState().setInvoices([]);
    useInvoiceStore.getState().setLoading(true);
    useSplitFriendStore.getState().setFriends([]);
    useSplitFriendStore.getState().setLoading(true);
    setBootAttempt((current) => current + 1);
  }, []);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const setNotificationsEnabled = useCallback(
    (enabled: boolean) => {
      setNotificationsEnabledState(enabled);
      void trackEvent('notifications_toggled', { enabled });
      const action = enabled
        ? syncRenewalNotifications(subscriptions)
        : cancelScheduledNotifications();

      action.catch((nextError) => {
        setError(
          nextError instanceof Error ? nextError.message : String(nextError)
        );
      });
    },
    [subscriptions]
  );

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const value = useMemo<AppDataContextValue>(() => {
    const upcomingRenewals = getUpcomingRenewals(subscriptions);
    const totalMonthlySpending = getTotalMonthlySpending(subscriptions);
    return {
      status,
      user,
      subscriptions,
      loadingSubscriptions,
      error,
      missingFirebaseKeys: getMissingFirebaseKeys(),
      notificationsEnabled,
      totalMonthlySpending,
      upcomingRenewals,
      categoryBreakdown: getCategoryBreakdown(subscriptions),
      smartAlerts: generateSmartAlerts(subscriptions),
      addSubscription,
      saveSubscription,
      removeSubscription,
      setNotificationsEnabled,
      refreshNotifications,
      retryBootstrap,
      signOut: handleSignOut,
    };
  }, [
    addSubscription,
    error,
    loadingSubscriptions,
    notificationsEnabled,
    refreshNotifications,
    removeSubscription,
    retryBootstrap,
    handleSignOut,
    saveSubscription,
    setNotificationsEnabled,
    status,
    subscriptions,
    user,
  ]);

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

// react-doctor-disable-next-line react-doctor/only-export-components
export function useAppData() {
  const value = React.use(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}

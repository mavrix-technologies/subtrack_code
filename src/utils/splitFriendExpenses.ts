import type { Expense } from '@/store/useExpenseStore';
import type { SplitFriend } from '@/types/splitFriend';

export function participantMatchesFriend(
  p: NonNullable<Expense['participants']>[number],
  friend: SplitFriend
): boolean {
  if (p.friendId && p.friendId === friend.id) return true;
  const fe = (friend.email || '').trim().toLowerCase();
  const pe = (p.email || '').trim().toLowerCase();
  if (fe.length > 3 && pe === fe) return true;
  return false;
}

/** Expenses where this friend appears on the split (not as organizer row 0 unless matched by id — we match any row). */
export function getSplitExpensesForFriend(expenses: Expense[], friend: SplitFriend): Expense[] {
  return expenses.filter(
    (e) =>
      e.isSplit &&
      e.participants &&
      e.participants.some((p) => participantMatchesFriend(p, friend))
  );
}

export function sumFriendShareInExpense(expense: Expense, friend: SplitFriend): number {
  if (!expense.participants) return 0;
  let sum = 0;
  for (const p of expense.participants) {
    if (participantMatchesFriend(p, friend)) {
      sum += Number(p.amount) || 0;
    }
  }
  return sum;
}

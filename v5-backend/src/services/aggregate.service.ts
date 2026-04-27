import { DebtModel } from "../models/debt.model.js";
import { UserModel } from "../models/user.model.js";

/**
 * Cross-user, aggregate-only summary for the staff dashboard.
 *
 * Privacy invariant: nothing individually identifying leaves this
 * function. No userId, no email, no debt name, no individual balance
 * or rate. Counts, sums, averages, and the bracket of signup
 * timestamps. The companion test in app.test.ts seeds users and
 * debts with canary tokens in their emails and names, then asserts
 * those tokens never appear in the response — that's the
 * load-bearing check on this design.
 *
 * Earliest/latest signup are aggregate dates that, in a small user
 * base, identify a specific account by timestamp. For the v8 staff
 * dashboard with the developer as the only staff user, this is
 * fine. At larger scale, it becomes unidentifying; at intermediate
 * scale (5-50 users) the bracket dates are technically a low-grade
 * fingerprint. Documented as a known design tradeoff in NOTES.
 */

export interface StaffSummary {
  users: {
    total: number;
    earliestSignup: string | null;
    latestSignup: string | null;
  };
  debts: {
    totalCount: number;
    totalBalance: number;
    averageRate: number | null;
  };
  debtCountDistribution: {
    zero: number;
    oneToTwo: number;
    threeToFive: number;
    sixPlus: number;
  };
}

interface UserDateAgg {
  _id: null;
  earliest: Date | null;
  latest: Date | null;
}

interface DebtAgg {
  _id: null;
  totalCount: number;
  totalBalance: number;
  averageRate: number | null;
}

interface UserDebtCount {
  _id: string;
  count: number;
}

export async function getStaffSummary(): Promise<StaffSummary> {
  const userCount = await UserModel.countDocuments();

  const [userDateAgg] = await UserModel.aggregate<UserDateAgg>([
    {
      $group: {
        _id: null,
        earliest: { $min: "$createdAt" },
        latest: { $max: "$createdAt" },
      },
    },
  ]);

  const [debtAgg] = await DebtModel.aggregate<DebtAgg>([
    {
      $group: {
        _id: null,
        totalCount: { $sum: 1 },
        totalBalance: { $sum: "$balance" },
        averageRate: { $avg: "$rate" },
      },
    },
  ]);

  // Per-user debt counts. Users with zero debts don't appear here
  // (they have no DebtModel docs to group on); the zero bucket is
  // computed as `userCount - usersWithAnyDebts.length` afterward.
  const userDebtCounts = await DebtModel.aggregate<UserDebtCount>([
    {
      $group: {
        _id: "$userId",
        count: { $sum: 1 },
      },
    },
  ]);

  const distribution = {
    zero: userCount - userDebtCounts.length,
    oneToTwo: 0,
    threeToFive: 0,
    sixPlus: 0,
  };
  for (const { count } of userDebtCounts) {
    if (count >= 1 && count <= 2) distribution.oneToTwo += 1;
    else if (count >= 3 && count <= 5) distribution.threeToFive += 1;
    else if (count >= 6) distribution.sixPlus += 1;
  }

  return {
    users: {
      total: userCount,
      earliestSignup: userDateAgg?.earliest?.toISOString() ?? null,
      latestSignup: userDateAgg?.latest?.toISOString() ?? null,
    },
    debts: {
      totalCount: debtAgg?.totalCount ?? 0,
      totalBalance: debtAgg?.totalBalance ?? 0,
      averageRate: debtAgg?.averageRate ?? null,
    },
    debtCountDistribution: distribution,
  };
}

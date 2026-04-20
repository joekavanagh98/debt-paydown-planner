# v1-vanilla Notes

## Design decisions for v1

These are the calls I made up front so future-me (or a code reviewer)
doesn't have to reconstruct the reasoning.

### Minimum payment fallback formula

`max(25, interest + balance * 0.01)`

Interest-only would loop forever since principal never drops. 1% of
principal is the industry standard for credit card minimums and
guarantees the debt pays off eventually. $25 floor keeps payments from
going absurdly small on tiny balances.

### Infeasible budget handling

Return a structured result, not a throw.

```
{ feasible: false, reason: 'budgetBelowMinimums', requiredMinimum, shortfall }
{ feasible: true, schedule: [...] }
```

Throwing forces try/catch on every caller. Returning `null` loses
information. A structured result lets the UI show "Budget too low,
increase by $X" without extra work.

### Balance in month entry

End-of-month balance.

Matches how people read statements. Final-month payoff is unambiguous
because end-of-month balance of 0 means the debt is done.

### Cascade semantics

Extra payment cascades to the next avalanche target within the same
month, not next month. Unused minimum (paid-off debts, or tiny
balances smaller than the minimum) also cascades.

Approximation: all debts accrue full interest on their start-of-month
balance before any payment. In reality the cascade target gets a
couple fewer days of interest, but modeling that is not worth the
complexity.

### Money representation

All math happens in integer cents. Inputs are multiplied by 100 with
`Math.round` on entry, results divided by 100 on the way out.

Floating-point drift over 600 months of compounding is a real bug, not
theoretical. Integer cents eliminates it.

### Max months guard

600 months (50 years). If the loop runs longer than that, either the
inputs are bad or the budget is unrealistic. Return
`{ feasible: false, reason: 'exceeds50Years' }`.

## What could be better

### Test coverage gaps

- The "deterministic ordering" test only asserts two consecutive runs agree.
  Both could be deterministically wrong. A stronger version would assert
  *which* debt wins ties (input order, since `Array.prototype.sort` is
  stable in modern engines). The current test still catches the common
  bug (random tiebreaking), which is what matters for v1.
- The "budget exactly matching minimums" test only checks month 1. It
  doesn't verify steady state after some debts pay off and their
  minimums start cascading. Not wrong, just narrower than it looks.
- No test for cascade behavior when a debt pays off mid-schedule (the
  rollover of unused minimum to the next target).
- No test that the 600-month ceiling actually fires on a degenerate
  input (e.g. user-supplied minimum below the interest accrual).
- No test for negative or NaN inputs. Current code might crash rather
  than fail gracefully. Validation at the UI boundary catches most of
  this in practice, but the math function itself has no guard.

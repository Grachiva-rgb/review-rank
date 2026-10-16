export class GoogleApiBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleApiBudgetError';
  }
}

/** Preserve Next ISR's stale page/retry behavior for budget-related failures. */
export function rethrowIfGoogleApiBudgetError(error: unknown): void {
  if (error instanceof GoogleApiBudgetError) throw error;
}

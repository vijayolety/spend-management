export interface IntegrationProvider {
  /** Fetch the current-period spend in USD. */
  fetchSpendUSD(config: Record<string, any>): Promise<number>;
}

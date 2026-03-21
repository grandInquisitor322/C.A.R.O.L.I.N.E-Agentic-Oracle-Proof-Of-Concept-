interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

interface StorageHistoryItem {
  txid: string;
  dismissed?: boolean;
  score?: number;
  impact?: number;
}

interface StorageAdapter {
  querySimilarTransactions(tx: any, limit: number): Promise<StorageHistoryItem[]>;
  queryTransactionHistory(address: string, chainId: number, days: number): Promise<StorageHistoryItem[]>;
  insertLearningFeedback(txid: string, feedbacks: any[]): Promise<void>;
}

import { ChainId, ChainConfig } from './ChainConfig20';
import { EnrichedTransaction } from './TransactionEnricher'; // Direct import from provided file (assume available)
// import { StorageAdapter } from './storage'; // Commented out; using inline interface for compilation

export interface AlertAction {
  type: 'LOG' | 'WARN' | 'QUARANTINE' | 'NOTIFY' | 'ESCALATE';
  txid: string;
  chainId: ChainId;
  reason: string;
  priority: number; // 1-10, higher = urgent
  simulatedImpact?: string; // e.g., "Potential 5% balance risk"
  timestamp: Date;
}

export interface PrioritizedTx {
  tx: EnrichedTransaction;
  validation: ValidationResult;
  historicalContext: {
    similarPatterns: number;
    userDismissals: number;
    avgScore: number;
  };
  priorityScore: number; // 0-100, frontal "foresight" metric
}

export interface LearningFeedback {
  action: AlertAction;
  userResponse?: 'ACK' | 'DISMISS' | 'SNOOZE'; // From user interactions
  outcome?: 'RESOLVED' | 'ESCALATED' | 'FALSE_POSITIVE';
}

export interface OrchestrationOptions {
  simulationDepth?: number; // How many "what-if" steps (default: 1)
  minPriorityThreshold?: number; // Alerts below this score = LOG only (default: 50)
  enableLearning?: boolean; // Toggle feedback loops to StorageAdapter
  userPrefs?: Map<ChainId, { ignoreDust?: boolean; maxNotifications?: number }>; // Chain-specific tuning
}

export class AlertOrchestrator {
  private storage: StorageAdapter; // For hippocampus-like memory
  private learningBuffer: Map<string, LearningFeedback[]> = new Map(); // In-mem cache for quick loops
  private chainConfigs: Map<ChainId, ChainConfig> = new Map(); // Quick lookup

  constructor(
    private enricher: any, // TransactionEnricher instance (can type as import { TransactionEnricher } from './TransactionEnricher')
    config: Record<ChainId, ChainConfig>, // Fixed: Treat as map/object for multiple chains
    storageAdapter: StorageAdapter
  ) {
    this.storage = storageAdapter;
    // Init chain configs (mirror from Validator)
    Object.entries(config).forEach(([chainIdStr, cfg]) => {
      const chainId = Number(chainIdStr) as unknown as ChainId;
      this.chainConfigs.set(chainId, cfg);
    });
  }

  /**
   * Core orchestration: Takes batch of enriched txs + validations, outputs sequenced actions
   * Frontal lobe magic: Prioritize, simulate, decide, learn
   */
  async orchestrate(
    txBatch: EnrichedTransaction[],
    validationResults: Map<string, ValidationResult>,
    options: OrchestrationOptions = {}
  ): Promise<AlertAction[]> {
    const opts: Required<OrchestrationOptions> = {
      simulationDepth: options.simulationDepth ?? 1,
      minPriorityThreshold: options.minPriorityThreshold ?? 50,
      enableLearning: options.enableLearning ?? true,
      userPrefs: options.userPrefs ?? new Map(),
    };

    // Step 1: Prioritize (frontal planning: weigh validations + enrichment + history)
    const prioritized = await this.prioritize(txBatch, validationResults, opts);

    // Step 2: Simulate outcomes (what-if branching for foresight)
    const simulated = await this.simulateOutcomes(prioritized, opts.simulationDepth);

    // Step 3: Map to actions (executive control: inhibit low-threats, escalate highs)
    const actions: AlertAction[] = [];
    for (const prioTx of simulated) {
      const action = this.decideAction(prioTx, opts);
      actions.push(action);

      // Step 4: Learn loop (plasticity: etch feedback for future)
      if (opts.enableLearning) {
        await this.bufferLearning(action);
      }
    }

    // Flush learning to storage periodically (e.g., batch every 100 actions)
    if (this.learningBuffer.size > 50) {
      await this.persistLearning();
    }

    return actions.sort((a, b) => b.priority - a.priority); // Urgent first
  }

  /**
   * Prioritize: Calculate frontal "foresight score" blending validation, enrichment, history
   */
  private async prioritize(
    txBatch: EnrichedTransaction[],
    validationResults: Map<string, ValidationResult>,
    opts: Required<OrchestrationOptions>
  ): Promise<PrioritizedTx[]> {
    const prioritized: PrioritizedTx[] = [];

    for (const tx of txBatch) {
      const validation = validationResults.get(tx.txId || tx.hash || '') || { isValid: false, errors: [], warnings: [], score: 0 };
      const chainId = tx.chainId;

      // Historical context from storage (hippocampus query)
      const historical = await this.fetchHistoricalContext(tx.txId || tx.hash || '', chainId, tx.from || '');

      // Frontal weighting: Validation score (40%) + Enrichment riskScore/tags (30%) + History similarity (30%)
      const anomalyScore = this.extractAnomalyScore(tx); // From Enricher: riskScore + tag complexity
      const historyPenalty = historical.userDismissals > 3 ? -20 : 0;
      const priorityScore = Math.min(100, Math.max(0,
        (validation.score * 0.4) +
        (anomalyScore * 0.3) +
        ((historical.similarPatterns * 10) * 0.3) +
        historyPenalty
      ));

      prioritized.push({
        tx,
        validation,
        historicalContext: historical,
        priorityScore,
      });
    }

    return prioritized.filter(p => p.priorityScore >= opts.minPriorityThreshold);
  }

  /**
   * Simulate: Lightweight "what-if" trees (e.g., project risk if unacted)
   */
  private async simulateOutcomes(
    prioritized: PrioritizedTx[],
    depth: number
  ): Promise<PrioritizedTx[]> {
    for (const prioTx of prioritized) {
      let impact = '';
      if (depth >= 1) {
        // Simple sim: Query storage for similar past txs' outcomes
        const simData: StorageHistoryItem[] = await this.storage.querySimilarTransactions(prioTx.tx, 5); // Top 5 matches
        const avgLoss = simData.reduce((sum: number, s: StorageHistoryItem) => sum + (s.impact || 0), 0) / (simData.length || 1);
        impact = avgLoss > 0.05 ? `Potential ${ (avgLoss * 100).toFixed(1) }% balance risk` : 'Low projected impact';
      }
      (prioTx as any).simulatedImpact = impact; // Temp prop for decision; cast to any to avoid strict typing
    }
    return prioritized;
  }

  /**
   * Decide: Map priority to action type (inhibitory control)
   */
  private decideAction(prioTx: PrioritizedTx & { simulatedImpact?: string }, opts: Required<OrchestrationOptions>): AlertAction {
    const { tx, validation, priorityScore, simulatedImpact } = prioTx;
    const chainId = tx.chainId;
    let type: AlertAction['type'] = 'LOG';
    let reason = '';
    let priority = Math.floor(priorityScore / 10);

    // Branching logic (if-then trees)
    if (!validation.isValid) {
      type = 'QUARANTINE';
      reason = `Invalid tx: ${validation.errors[0] || 'Critical failure'}`;
      priority = Math.max(8, priority);
    } else if (priorityScore < 60) {
      type = 'WARN';
      reason = `Anomaly detected: ${simulatedImpact || 'Moderate risk'}`;
    } else if (priorityScore < 80) {
      type = 'NOTIFY';
      reason = `Elevated pattern: ${tx.tags?.join(', ') || 'Unspecified'}`;
      // User pref check: e.g., ignore dust on Beerscoin
      const prefs = opts.userPrefs.get(chainId);
      if (prefs?.ignoreDust && this.isDustAlert(tx)) {
        type = 'LOG';
        reason += ' (User pref: ignored)';
      }
    } else {
      type = 'ESCALATE';
      reason = `High-threat escalation: ${simulatedImpact || 'Immediate action needed'}`;
      priority = 10;
    }

    return {
      type,
      txid: tx.txId || tx.hash || '',
      chainId,
      reason,
      priority,
      simulatedImpact,
      timestamp: new Date(),
    };
  }

  /**
   * Learning: Buffer feedback for adaptive tuning
   */
  private async bufferLearning(action: AlertAction): Promise<void> {
    const key = action.txid;
    if (!this.learningBuffer.has(key)) {
      this.learningBuffer.set(key, []);
    }
    // Placeholder: In prod, await user response via webhook/queue
    const feedback: LearningFeedback = { action }; // Will update on user input
    this.learningBuffer.get(key)!.push(feedback);
  }

  private async persistLearning(): Promise<void> {
    for (const [txid, feedbacks] of this.learningBuffer) {
      await this.storage.insertLearningFeedback(txid, feedbacks);
      // Bayesian update: e.g., adjust anomaly weights based on outcomes
      const falsePositives = feedbacks.filter(f => f.outcome === 'FALSE_POSITIVE').length;
      if (falsePositives > feedbacks.length * 0.3) {
        // Tune down sensitivity for this pattern
        console.log(`Tuning sensitivity for ${txid}: ${falsePositives} false positives`);
      }
    }
    this.learningBuffer.clear();
  }

  // Helpers (updated for EnrichedTransaction fields)
  private extractAnomalyScore(tx: EnrichedTransaction): number {
    // Pull from Enricher: riskScore as primary, boosted by tag count (e.g., 'large-transaction', 'high-fee')
    return tx.riskScore || ((tx.tags?.length || 0) * 5) || 0;
  }

  private isDustAlert(tx: EnrichedTransaction): boolean {
    // Approx dust check: Use amount < chain-specific threshold (e.g., 546 sats for BTC-like)
    // Note: No vout array; assume single-output tx for simplicity, or fetch via storage if needed
    const dustThreshold = 546; // Default sat/atoms; make chain-aware via ChainConfig
    return parseFloat(tx.amount || '0') < dustThreshold;
  }

  private async fetchHistoricalContext(txid: string, chainId: ChainId, address: string): Promise<{
    similarPatterns: number;
    userDismissals: number;
    avgScore: number;
  }> {
    // Query storage for matches (e.g., last 30 days, same address/chain)
    const history: StorageHistoryItem[] = await this.storage.queryTransactionHistory(address, chainId as unknown as number, 30);
    const similar = history.filter((h: StorageHistoryItem) => this.patternMatch(txid, h.txid)).length;
    return {
      similarPatterns: similar,
      userDismissals: history.filter((h: StorageHistoryItem) => h.dismissed).length,
      avgScore: history.reduce((sum: number, h: StorageHistoryItem) => sum + (h.score || 0), 0) / (history.length || 1) || 0,
    };
  }

  private patternMatch(tx1: string, tx2: string): boolean {
    // Simple hash-based or metadata match; expand with fuzzy logic (e.g., shared tags/category)
    return tx1 === tx2; // Placeholder; could compare tx.tags or category
  }

  /**
   * Batch orchestrate for high-volume (e.g., from PollingManager)
   */
  async orchestrateBatch(
    batches: Array<{ txs: EnrichedTransaction[]; validations: Map<string, ValidationResult> }>,
    options: OrchestrationOptions = {}
  ): Promise<Map<string, AlertAction[]>> {
    const results = new Map<string, AlertAction[]>();
    for (const batch of batches) {
      const actions = await this.orchestrate(batch.txs, batch.validations, options);
      results.set(batch.txs[0]?.txId || 'batch', actions); // Key by first txid or batch ID
    }
    return results;
  }

  /**
   * Flush learning on demand (e.g., shutdown hook)
   */
  async flushLearning(): Promise<void> {
    await this.persistLearning();
  }
}


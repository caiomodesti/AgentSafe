import type {
  AgentContext,
  AllowanceContext,
  EvaluationInput,
  HistoricalContext,
  PaymentIntent,
  Policy,
  PolicyDecision,
  TaskContext,
} from "./domain.js";
import { hashPaymentIntent } from "./intent-hash.js";
import { evaluatePayment } from "./policy-engine.js";

export interface EvaluationCommand {
  readonly idempotencyKey: string;
  readonly now: string;
  readonly intent: PaymentIntent;
}

export interface StoredEvaluation {
  readonly requestHash: string;
  readonly decision: PolicyDecision;
}

export interface EvaluationTransaction {
  findByIdempotencyKey(agentId: string, idempotencyKey: string): StoredEvaluation | undefined;
  loadInput(intent: PaymentIntent, now: string): EvaluationInput;
  saveDecisionAndEffects(command: EvaluationCommand, requestHash: string, decision: PolicyDecision): void;
}

export interface EvaluationRepository {
  withFinancialLock<T>(
    workspaceId: string,
    agentId: string,
    taskId: string,
    operation: (transaction: EvaluationTransaction) => Promise<T> | T,
  ): Promise<T>;
}

export class IdempotencyConflictError extends Error {
  override readonly name = "IdempotencyConflictError";

  constructor() {
    super("idempotency key was already used with a different payment intent");
  }
}

export class EvaluationService {
  constructor(private readonly repository: EvaluationRepository) {}

  async evaluate(command: EvaluationCommand): Promise<PolicyDecision> {
    if (command.idempotencyKey.length < 16 || command.idempotencyKey.length > 128) {
      throw new RangeError("idempotencyKey must contain between 16 and 128 characters");
    }
    const requestHash = hashPaymentIntent(command.intent);
    return this.repository.withFinancialLock(
      command.intent.workspaceId,
      command.intent.agentId,
      command.intent.taskId,
      async (transaction) => {
        const existing = transaction.findByIdempotencyKey(command.intent.agentId, command.idempotencyKey);
        if (existing) {
          if (existing.requestHash !== requestHash) throw new IdempotencyConflictError();
          return existing.decision;
        }

        const input = transaction.loadInput(command.intent, command.now);
        const decision = evaluatePayment(input);
        transaction.saveDecisionAndEffects(command, requestHash, decision);
        return decision;
      },
    );
  }
}

export interface InMemoryFinancialState {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly taskId: string;
  readonly agent: AgentContext;
  readonly task: TaskContext;
  readonly history: HistoricalContext;
  readonly allowance: AllowanceContext;
  readonly policy: Policy;
}

interface MutableFinancialState {
  workspaceId: string;
  agentId: string;
  taskId: string;
  agent: AgentContext;
  task: {
    approvedBudgetBaseUnits: bigint;
    spentBaseUnits: bigint;
    reservedBaseUnits: bigint;
    expiresAt?: string;
  };
  history: {
    hourlySpentBaseUnits: bigint;
    hourlyReservedBaseUnits: bigint;
    dailySpentBaseUnits: bigint;
    dailyReservedBaseUnits: bigint;
    weeklySpentBaseUnits: bigint;
    weeklyReservedBaseUnits: bigint;
    lifetimeSpentBaseUnits: bigint;
    lifetimeReservedBaseUnits: bigint;
    merchantSeen: boolean;
    medianPriceBaseUnits?: bigint;
    paidCallsForTask: number;
  };
  allowance: {
    remainingBaseUnits: bigint;
    expiresAt?: string;
  };
  policy: Policy;
}

function mutableState(input: InMemoryFinancialState): MutableFinancialState {
  return {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    taskId: input.taskId,
    agent: { ...input.agent },
    task: { ...input.task },
    history: { ...input.history },
    allowance: { ...input.allowance },
    policy: input.policy,
  };
}

/**
 * Deterministic test/demo adapter. Production must implement the same contract
 * with a PostgreSQL transaction and row locks; this class is never a durable
 * or distributed enforcement store.
 */
export class InMemoryEvaluationRepository implements EvaluationRepository, EvaluationTransaction {
  private readonly states = new Map<string, MutableFinancialState>();
  private readonly evaluations = new Map<string, StoredEvaluation>();
  private lockTail: Promise<void> = Promise.resolve();

  constructor(states: readonly InMemoryFinancialState[]) {
    for (const state of states) {
      this.states.set(this.stateKey(state.workspaceId, state.agentId, state.taskId), mutableState(state));
    }
  }

  async withFinancialLock<T>(
    _workspaceId: string,
    _agentId: string,
    _taskId: string,
    operation: (transaction: EvaluationTransaction) => Promise<T> | T,
  ): Promise<T> {
    const previous = this.lockTail;
    let release!: () => void;
    this.lockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation(this);
    } finally {
      release();
    }
  }

  findByIdempotencyKey(agentId: string, idempotencyKey: string): StoredEvaluation | undefined {
    return this.evaluations.get(`${agentId}:${idempotencyKey}`);
  }

  loadInput(intent: PaymentIntent, now: string): EvaluationInput {
    const state = this.states.get(this.stateKey(intent.workspaceId, intent.agentId, intent.taskId));
    if (!state) throw new Error("financial state not found");
    return {
      now,
      intent,
      agent: { ...state.agent },
      task: { ...state.task },
      history: { ...state.history },
      allowance: { ...state.allowance },
      policy: state.policy,
    };
  }

  saveDecisionAndEffects(command: EvaluationCommand, requestHash: string, decision: PolicyDecision): void {
    const key = this.stateKey(
      command.intent.workspaceId,
      command.intent.agentId,
      command.intent.taskId,
    );
    const state = this.states.get(key);
    if (!state) throw new Error("financial state not found");

    this.evaluations.set(`${command.intent.agentId}:${command.idempotencyKey}`, { requestHash, decision });
    if (decision.decision !== "ALLOW" || decision.reservationAmountBaseUnits === undefined) return;

    const amount = decision.reservationAmountBaseUnits;
    state.task.reservedBaseUnits += amount;
    state.history.hourlyReservedBaseUnits += amount;
    state.history.dailyReservedBaseUnits += amount;
    state.history.weeklyReservedBaseUnits += amount;
    state.history.lifetimeReservedBaseUnits += amount;
    state.allowance.remainingBaseUnits -= amount;
  }

  snapshot(workspaceId: string, agentId: string, taskId: string): InMemoryFinancialState {
    const state = this.states.get(this.stateKey(workspaceId, agentId, taskId));
    if (!state) throw new Error("financial state not found");
    return {
      workspaceId,
      agentId,
      taskId,
      agent: { ...state.agent },
      task: { ...state.task },
      history: { ...state.history },
      allowance: { ...state.allowance },
      policy: state.policy,
    };
  }

  private stateKey(workspaceId: string, agentId: string, taskId: string): string {
    return `${workspaceId}:${agentId}:${taskId}`;
  }
}


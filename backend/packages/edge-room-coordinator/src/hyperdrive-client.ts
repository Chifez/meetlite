/**
 * Cloudflare Hyperdrive Edge Database Accelerator & Dual-Mode Consistency Router
 *
 * Implements S5-01 / Phase 5:
 * Accelerates edge database queries while strictly enforcing MeetLite's consistency invariants:
 * - Cached / Stale-Tolerant: Used ONLY for public, stale-tolerant reads (e.g., room existence check, public org profiles).
 * - Direct / Cache-Disabled: MANDATORY for room admission, user permissions, billing entitlements, and writes.
 */

export type QueryIntent = 'stale_tolerant' | 'strongly_consistent';

export interface HyperdriveBinding {
  readonly connectionString: string;
}

export interface HyperdriveQueryResult<T = any> {
  readonly rows: T[];
  readonly rowCount: number;
  readonly latencyMs: number;
  readonly cacheBypassed: boolean;
  readonly routedMode: 'cached_edge' | 'direct_origin';
}

export interface HyperdriveClientConfig {
  readonly hyperdrive?: HyperdriveBinding;
  readonly hyperdriveCached?: HyperdriveBinding;
  readonly hyperdriveUncached?: HyperdriveBinding;
  readonly fallbackDatabaseUrl?: string;
  readonly queryExecutor?: (connectionString: string, sql: string, params: any[]) => Promise<any[]>;
}

export class HyperdriveClient {
  private readonly hyperdrive?: HyperdriveBinding;
  private readonly hyperdriveCached?: HyperdriveBinding;
  private readonly hyperdriveUncached?: HyperdriveBinding;
  private readonly fallbackDatabaseUrl?: string;
  private readonly queryExecutor: (connectionString: string, sql: string, params: any[]) => Promise<any[]>;

  constructor(config: HyperdriveClientConfig) {
    this.hyperdrive = config.hyperdrive;
    this.hyperdriveCached = config.hyperdriveCached;
    this.hyperdriveUncached = config.hyperdriveUncached;
    this.fallbackDatabaseUrl = config.fallbackDatabaseUrl;
    this.queryExecutor = config.queryExecutor ?? (async () => []);
  }

  /**
   * Resolves connection string based on query intent and consistency rule.
   * Strongly-consistent queries use a separately configured cache-disabled
   * Hyperdrive binding, or an explicit direct-origin database URL.
   */
  public resolveConnectionString(intent: QueryIntent): { connectionString: string; cacheBypassed: boolean } {
    if (intent === 'strongly_consistent') {
      if (this.hyperdriveUncached?.connectionString) {
        return {
          connectionString: this.hyperdriveUncached.connectionString,
          cacheBypassed: true,
        };
      }
      if (this.fallbackDatabaseUrl) {
        return {
          connectionString: this.fallbackDatabaseUrl,
          cacheBypassed: true,
        };
      }
      throw new Error(
        'Strongly consistent queries require a cache-disabled Hyperdrive binding or direct-origin database URL'
      );
    }

    const baseConn =
      this.hyperdriveCached?.connectionString ||
      this.hyperdrive?.connectionString ||
      this.fallbackDatabaseUrl ||
      undefined;

    if (!baseConn) {
      throw new Error('Stale-tolerant queries require a Hyperdrive binding or database URL');
    }

    return {
      connectionString: baseConn,
      cacheBypassed: false,
    };
  }

  /**
   * Executes a database query adhering to the consistency contract.
   */
  public async query<T = any>(
    sql: string,
    params: any[] = [],
    intent: QueryIntent = 'strongly_consistent'
  ): Promise<HyperdriveQueryResult<T>> {
    const start = performance.now();
    const { connectionString, cacheBypassed } = this.resolveConnectionString(intent);

    const rows = (await this.queryExecutor(connectionString, sql, params)) as T[];
    const latencyMs = Number((performance.now() - start).toFixed(2));

    return {
      rows,
      rowCount: rows.length,
      latencyMs,
      cacheBypassed,
      routedMode: cacheBypassed ? 'direct_origin' : 'cached_edge',
    };
  }

  /**
   * Helper: Room admission check (strictly strongly_consistent)
   */
  public async verifyAdmissionEntitlement(
    roomId: string,
    userId: string
  ): Promise<HyperdriveQueryResult<{ allowed: boolean; role: string }>> {
    return this.query<{ allowed: boolean; role: string }>(
      'SELECT allowed, role FROM room_memberships WHERE room_id = $1 AND user_id = $2',
      [roomId, userId],
      'strongly_consistent' // NEVER stale-tolerant
    );
  }

  /**
   * Helper: Public room existence check (stale-tolerant cached)
   */
  public async checkRoomExists(
    roomId: string
  ): Promise<HyperdriveQueryResult<{ id: string; active: boolean }>> {
    return this.query<{ id: string; active: boolean }>(
      'SELECT id, active FROM rooms WHERE id = $1',
      [roomId],
      'stale_tolerant' // Permissible for caching
    );
  }
}

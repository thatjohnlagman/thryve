// Shared mock for `@/lib/supabase` used by the API route tests.
//
// Usage in a test file:
//
//   vi.mock("@/lib/supabase", async () => {
//     const { supabaseMock } = await import("../helpers/supabase-mock")
//     return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
//   })
//
//   beforeEach(() => supabaseMock.reset())
//
// Then register per-table handlers, e.g.:
//
//   supabaseMock.onTable("team_members", (ctx) =>
//     ctx.single ? { data: membership, error: null } : { data: [], error: null })
//
// `onTable` handlers are matched in registration order; the first one whose
// `match` (if any) accepts the query context wins. Unhandled queries resolve to
// `{ data: null, error: null }`.

import { vi } from "vitest"

export type QueryAction = "select" | "insert" | "update" | "delete"

export interface QueryCtx {
  table: string
  action: QueryAction
  /** `select()` argument, e.g. `"*, profiles:user_id (first_name)"` */
  selectArg: string | undefined
  /** filter/chain calls after the action, in order: eq/in/order/range/... */
  chain: Array<{ method: string; args: any[] }>
  /** true when `.single()` was chained */
  single: boolean
  /** payload passed to `.insert()` / `.update()` */
  payload: any
}

export interface QueryResult {
  data?: any
  error?: any
}

interface Builder {
  in(...args: any[]): Builder
}

type Handler = (ctx: QueryCtx) => QueryResult | void

interface Registration {
  table: string
  match?: (ctx: QueryCtx) => boolean
  handler: Handler
}

class Builder implements PromiseLike<any> {
  private ctx: QueryCtx

  constructor(
    private readonly mock: SupabaseMock,
    table: string,
  ) {
    this.ctx = { table, action: "select", selectArg: undefined, chain: [], single: false, payload: undefined }
    // `in` can't be declared as a class field name in every parser, so assign it here.
    this.in = this.filter("in")
  }

  select(arg?: string) {
    this.ctx.selectArg = arg
    return this
  }

  insert(payload: any) {
    this.ctx.action = "insert"
    this.ctx.payload = payload
    return this
  }

  update(payload: any) {
    this.ctx.action = "update"
    this.ctx.payload = payload
    return this
  }

  delete() {
    this.ctx.action = "delete"
    return this
  }

  private filter(method: string) {
    return (...args: any[]) => {
      this.ctx.chain.push({ method, args })
      return this
    }
  }

  eq = this.filter("eq")
  neq = this.filter("neq")
  gt = this.filter("gt")
  lt = this.filter("lt")
  gte = this.filter("gte")
  lte = this.filter("lte")
  like = this.filter("like")
  ilike = this.filter("ilike")
  order = this.filter("order")
  range = this.filter("range")
  limit = this.filter("limit")
  offset = this.filter("offset")

  single() {
    this.ctx.single = true
    return this
  }

  maybeSingle() {
    this.ctx.single = true
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.mock.dispatch(this.ctx)).then(onfulfilled, onrejected)
  }
}

export class SupabaseMock {
  readonly registrations: Registration[] = []
  readonly queries: QueryCtx[] = []
  readonly rpcCalls: Array<{ fn: string; args: any[] }> = []

  readonly auth = {
    getUser: vi.fn(async (_token?: string) => ({ data: { user: null as any }, error: null as any })),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }

  readonly client = {
    auth: this.auth,
    from: (table: string) => new Builder(this, table),
    rpc: vi.fn(async (fn: string, ...args: any[]) => {
      this.rpcCalls.push({ fn, args })
      return { data: null, error: null }
    }),
    storage: {
      from: vi.fn(() => ({ download: vi.fn(async () => ({ data: null, error: null })) })),
    },
  }

  /** Register a handler for a table. Optional `match` filters query contexts. */
  onTable(table: string, handler: Handler, match?: (ctx: QueryCtx) => boolean) {
    this.registrations.push({ table, match, handler })
    return this
  }

  /** Set the auth.getUser() result. */
  setUser(user: any, error: any = null) {
    this.auth.getUser.mockResolvedValue({ data: { user }, error })
  }

  /** Make `rpc()` resolve with `data` while still recording the call. */
  mockRpc(data: any, error: any = null) {
    this.client.rpc.mockImplementation(async (fn: string, ...args: any[]) => {
      this.rpcCalls.push({ fn, args })
      return { data, error }
    })
  }

  dispatch(ctx: QueryCtx): QueryResult {
    this.queries.push(ctx)
    for (const reg of this.registrations) {
      if (reg.table !== ctx.table) continue
      if (reg.match && !reg.match(ctx)) continue
      const result = reg.handler(ctx)
      if (result !== undefined) return result
    }
    return { data: null, error: null }
  }

  /** Convenience: find the recorded query matching a predicate. */
  findQuery(predicate: (ctx: QueryCtx) => boolean): QueryCtx | undefined {
    return this.queries.find(predicate)
  }

  reset() {
    this.registrations.length = 0
    this.queries.length = 0
    this.rpcCalls.length = 0
    this.auth.getUser.mockReset()
    this.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    this.auth.signUp.mockReset()
    this.auth.signInWithPassword.mockReset()
    this.auth.signOut.mockReset()
    this.client.rpc.mockReset()
    this.client.rpc.mockImplementation(async (fn: string, ...args: any[]) => {
      this.rpcCalls.push({ fn, args })
      return { data: null, error: null }
    })
  }
}

/** Singleton shared between the mocked module and the test file. */
export const supabaseMock = new SupabaseMock()

/**
 * Minimal hand-rolled `chrome.*` mock.
 *
 * Only the surface this extension touches is implemented. Areas are independent
 * objects so a test can prove, for example, that the API key never lands in
 * `storage.sync`.
 */

type Listener<T extends unknown[]> = (...args: T) => void;

export interface FakeArea {
  data: Record<string, unknown>;
  get: (keys?: string | string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

type ChangeSet = Record<string, { newValue?: unknown; oldValue?: unknown }>;

function createArea(
  name: "sync" | "local",
  emit: (changes: ChangeSet, areaName: string) => void,
): FakeArea {
  const data: Record<string, unknown> = {};

  return {
    data,
    async get(keys) {
      if (keys === undefined) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of list) {
        if (key in data) result[key] = data[key];
      }
      return result;
    },
    async set(items) {
      const changes: ChangeSet = {};
      for (const [key, newValue] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: structuredClone(newValue) };
      }
      Object.assign(data, structuredClone(items));
      // The real API fires onChanged for writes; the mock must too or the
      // subscribe tests would pass without exercising anything.
      emit(changes, name);
    },
    async remove(key) {
      const oldValue = data[key];
      delete data[key];
      emit({ [key]: { oldValue, newValue: undefined } }, name);
    },
  };
}

export interface FakeChrome {
  storage: {
    sync: FakeArea;
    local: FakeArea;
    onChanged: {
      addListener: (listener: Listener<[Record<string, { newValue?: unknown }>, string]>) => void;
      removeListener: (listener: Listener<[Record<string, { newValue?: unknown }>, string]>) => void;
      emit: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;
    };
  };
  permissions: {
    contains: (request: { origins?: string[] }) => Promise<boolean>;
    request: (request: { origins?: string[] }) => Promise<boolean>;
    remove: (request: { origins?: string[] }) => Promise<boolean>;
  };
  __grantedOrigins: Set<string>;
  __nextRequestResult: boolean;
  __reset: () => void;
}

export function installChromeMock(): FakeChrome {
  const listeners = new Set<Listener<[Record<string, { newValue?: unknown }>, string]>>();

  const emit = (changes: ChangeSet, areaName: string) => {
    for (const listener of listeners) listener(changes, areaName);
  };

  const sync = createArea("sync", emit);
  const local = createArea("local", emit);

  const mock: FakeChrome = {
    storage: {
      sync,
      local,
      onChanged: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        },
        emit: (changes, areaName) => emit(changes, areaName),
      },
    },
    permissions: {
      async contains(request) {
        return (request.origins ?? []).every((origin) => mock.__grantedOrigins.has(origin));
      },
      async request(request) {
        if (!mock.__nextRequestResult) return false;
        for (const origin of request.origins ?? []) mock.__grantedOrigins.add(origin);
        return true;
      },
      async remove(request) {
        for (const origin of request.origins ?? []) mock.__grantedOrigins.delete(origin);
        return true;
      },
    },
    __grantedOrigins: new Set<string>(),
    __nextRequestResult: true,
    __reset() {
      sync.data = {};
      local.data = {};
      listeners.clear();
      mock.__grantedOrigins.clear();
      mock.__nextRequestResult = true;
    },
  };

  (globalThis as { chrome?: unknown }).chrome = mock;
  return mock;
}

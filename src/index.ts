export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointSpec<Params = unknown, Body = unknown, Response = unknown> {
  method: HttpMethod;
  path: string;
  _params?: Params;
  _body?: Body;
  _response?: Response;
}

export type ApiSpec = Record<string, EndpointSpec<any, any, any>>;

export function endpoint<P = void, B = void, R = unknown>(method: HttpMethod, path: string): EndpointSpec<P, B, R> {
  return { method, path };
}

function fillPath(path: string, params: Record<string, any>): string {
  return path.replace(/:(\w+)/g, (_, k) => encodeURIComponent(String(params[k] ?? "")));
}

export interface ClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export type TypedClient<S extends ApiSpec> = {
  [K in keyof S]: S[K] extends EndpointSpec<infer P, infer B, infer R>
    ? (args: (P extends void ? {} : { params: P }) & (B extends void ? {} : { body: B })) => Promise<R>
    : never;
};

export function createTypedClient<S extends ApiSpec>(spec: S, config: ClientConfig): TypedClient<S> {
  const fetchFn = config.fetch ?? fetch;
  const client = {} as any;
  for (const [key, ep] of Object.entries(spec)) {
    client[key] = async (args: any = {}) => {
      const params = args.params ?? {};
      const url = `${config.baseURL.replace(/\/$/, "")}${fillPath(ep.path, params)}`;
      const hasBody = args.body !== undefined;
      const res = await fetchFn(url, {
        method: ep.method,
        headers: { "Content-Type": "application/json", ...config.headers },
        body: hasBody ? JSON.stringify(args.body) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    };
  }
  return client as TypedClient<S>;
}

export function defineApi<S extends ApiSpec>(spec: S): S {
  return spec;
}

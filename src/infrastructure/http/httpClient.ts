export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultHeaders: Record<string, string> = {}
  ) {}

  async post<TBody, TResponse>(
    path: string,
    body: TBody,
    headers: Record<string, string> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.defaultHeaders,
        ...headers
      },
      body: JSON.stringify(body)
    });
  }

  async get<TResponse>(path: string, headers: Record<string, string> = {}): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "GET",
      headers: {
        ...this.defaultHeaders,
        ...headers
      }
    });
  }

  async put<TBody, TResponse>(
    path: string,
    body: TBody,
    headers: Record<string, string> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...this.defaultHeaders,
        ...headers
      },
      body: JSON.stringify(body)
    });
  }

  private async request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = undefined;
      }

      throw new HttpError(
        `HTTP request failed with status ${response.status}`,
        response.status,
        details
      );
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  }
}

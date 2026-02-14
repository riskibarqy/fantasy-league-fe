export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

type ApiErrorEnvelope = {
  error?: {
    message?: string;
  };
};

type ApiSuccessEnvelope<TData> = {
  apiVersion: string;
  data?: TData;
};

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
        getErrorMessage(response.status, details),
        response.status,
        details
      );
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    const payload = (await response.json()) as unknown;
    return unwrapPayload<TResponse>(payload);
  }
}

const isApiSuccessEnvelope = (payload: unknown): payload is ApiSuccessEnvelope<unknown> => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return typeof record.apiVersion === "string" && ("data" in record || "error" in record);
};

const unwrapPayload = <TResponse>(payload: unknown): TResponse => {
  if (isApiSuccessEnvelope(payload)) {
    return payload.data as TResponse;
  }

  return payload as TResponse;
};

const getErrorMessage = (statusCode: number, details: unknown): string => {
  if (details && typeof details === "object") {
    const error = (details as ApiErrorEnvelope).error;
    if (error && typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }
  }

  return `HTTP request failed with status ${statusCode}`;
};

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type Problem = { title?: string; detail?: string; errors?: Record<string, string[]> };

async function parseProblem(response: Response): Promise<Problem> {
  try {
    return (await response.json()) as Problem;
  } catch {
    return {};
  }
}

async function readProblem(response: Response): Promise<ApiError> {
  const problem = await parseProblem(response);
  const fieldErrors = problem.errors ?? {};
  const firstFieldError = Object.values(fieldErrors)[0]?.[0];
  const message = problem.detail ?? firstFieldError ?? problem.title ?? `The server answered ${response.status}.`;

  return new ApiError(response.status, message, fieldErrors);
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(0, "The server could not be reached.");
  }

  if (!response.ok) {
    throw await readProblem(response);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>("POST", path, body, signal),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

export function exportUrl(from: string, to: string, project?: string): string {
  const query = new URLSearchParams({ from, to });

  if (project) {
    query.set("project", project);
  }

  return `/api/entries/export.csv?${query.toString()}`;
}

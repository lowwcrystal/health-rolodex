/** The only place the frontend makes AJAX calls (jQuery `$.ajax`). Every API module goes through `request`. */

import $ from "jquery";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

/** Flask answers with JSON; read it as text so an empty body is not treated as an error. */
function parseJson(text: string | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    $.ajax({
      url: `/api${path}`,
      method,
      dataType: "text",
      contentType: body === undefined ? false : "application/json",
      data: body === undefined ? undefined : JSON.stringify(body),
      processData: false,
    })
      .done((text: string) => resolve(parseJson(text) as T))
      .fail((xhr: JQuery.jqXHR) => {
        if (xhr.status === 0) {
          reject(new ApiError("Can't reach the server. Check your connection and try again.", 0));
          return;
        }
        const data = parseJson(xhr.responseText);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : `Request failed (${xhr.status}).`;
        reject(new ApiError(message, xhr.status));
      });
  });
}

export const get = <T>(path: string) => request<T>("GET", path);
export const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
export const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
export const del = <T>(path: string) => request<T>("DELETE", path);

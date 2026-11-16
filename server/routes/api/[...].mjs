import { Readable } from "node:stream";
import { defineHandler } from "nitro/h3";
import { handleApiRequest } from "../../../scripts/app-api.mjs";

// Nitro's Vercel adapter is based on Fetch Request/Response and does not
// support H3 Node middleware. Adapt the existing Node HTTP API contract at
// the route boundary without starting a persistent server.
export default defineHandler(async (event) => {
  const input = event.req;
  const requestBody = input.body ? Readable.fromWeb(input.body) : null;
  const request = {
    method: input.method,
    url: input.url,
    headers: Object.fromEntries(input.headers),
    async *[Symbol.asyncIterator]() {
      if (requestBody) yield* requestBody;
    },
  };

  let status = 200;
  const headers = new Headers();
  const chunks = [];
  const response = {
    setHeader(name, value) { headers.set(name, String(value)); return this; },
    writeHead(code, values = {}) {
      status = code;
      for (const [name, value] of Object.entries(values)) headers.set(name, String(value));
      return this;
    },
    end(value) {
      if (value !== undefined && value !== null) chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
      return this;
    },
  };

  await handleApiRequest(request, response);
  const body = chunks.length ? Buffer.concat(chunks) : null;
  return new Response(body, { status, headers });
});

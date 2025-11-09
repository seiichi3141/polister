import { NextResponse } from "next/server";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";

import { middlewareAuth } from "@/shared/lib/auth/middleware";

const BASIC_REALM = process.env.BASIC_AUTH_REALM ?? "Restricted Area";
const boardImportAuthMiddleware = middlewareAuth((req, _event) => {
  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}) as unknown as NextMiddleware;

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${BASIC_REALM}"`,
    },
  });
}

function handleBasicAuth(request: NextRequest) {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return null;
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const encodedCredentials = authHeader.slice("Basic ".length).trim();

  let decodedCredentials: string;
  try {
    decodedCredentials = globalThis.atob(encodedCredentials);
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decodedCredentials.indexOf(":");

  if (separatorIndex === -1) {
    return unauthorizedResponse();
  }

  const providedUsername = decodedCredentials.slice(0, separatorIndex);
  const providedPassword = decodedCredentials.slice(separatorIndex + 1);

  if (providedUsername !== username || providedPassword !== password) {
    return unauthorizedResponse();
  }

  return null;
}

function requiresBoardImportAuth(pathname: string) {
  if (pathname === "/board-imports") {
    return true;
  }

  return pathname.startsWith("/board-imports/");
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const basicAuthFailure = handleBasicAuth(request);

  if (basicAuthFailure) {
    return basicAuthFailure;
  }

  if (requiresBoardImportAuth(request.nextUrl.pathname)) {
    return boardImportAuthMiddleware(request, event);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

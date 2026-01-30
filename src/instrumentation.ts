import * as Sentry from "@sentry/nextjs";
import type { LangfuseSpan } from "@langfuse/otel";

/**
 * Next.js Instrumentation for Sentry + Langfuse
 *
 * This file initializes:
 * - Sentry for error tracking
 * - Langfuse OpenTelemetry for AI observability
 *
 * @see https://langfuse.com/docs/integrations/vercel-ai-sdk
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Initialize Langfuse OpenTelemetry tracing for AI observability
    // Only in Node.js runtime (not Edge)
    if (process.env.LANGFUSE_SECRET_KEY) {
      const { LangfuseSpanProcessor } = await import("@langfuse/otel");
      const { NodeTracerProvider } = await import(
        "@opentelemetry/sdk-trace-node"
      );

      // Filter out Next.js infrastructure spans to reduce noise
      const shouldExportSpan = (span: LangfuseSpan) => {
        return span.otelSpan.instrumentationScope.name !== "next.js";
      };

      const langfuseSpanProcessor = new LangfuseSpanProcessor({
        shouldExportSpan,
      });

      const tracerProvider = new NodeTracerProvider({
        spanProcessors: [langfuseSpanProcessor],
      });

      tracerProvider.register();
      console.log("[Instrumentation] Langfuse OpenTelemetry tracing initialized");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;


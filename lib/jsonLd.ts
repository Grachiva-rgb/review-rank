/**
 * XSS-safe JSON-LD serialisation for use with dangerouslySetInnerHTML.
 *
 * `JSON.stringify` correctly encodes `"` as `\"` inside string values, but it
 * does NOT encode `<` or `>`. A business name containing `</script>` would
 * break out of the inline script block when the HTML parser encounters it
 * before JSON parsing completes.
 *
 * This utility replaces `<`, `>`, and `&` with their Unicode JSON escapes
 * (`\u003c`, `\u003e`, `\u0026`). These are valid inside JSON string values
 * and are invisible to JSON parsers while being opaque to the HTML parser.
 *
 * Usage:
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: jsonLd(myObject) }}
 *   />
 */
export function jsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

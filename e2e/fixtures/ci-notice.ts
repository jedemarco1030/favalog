/**
 * Emit a GitHub Actions `::notice::` workflow command so a SKIPPED journey is
 * visible in the job summary instead of hiding inside a skipped count. Outside
 * CI this is a no-op, so local runs stay quiet.
 */
export function emitCiNotice(title: string, message: string): void {
  if (!process.env.CI) return;
  const escape = (value: string) =>
    value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  // The workflow command must reach stdout to be picked up by GitHub Actions.
  console.log(`::notice title=${escape(title)}::${escape(message)}`);
}

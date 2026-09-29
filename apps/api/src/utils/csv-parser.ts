const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export function extractEmails(input: string) {
  return [...new Set(input.match(EMAIL)?.map(value => value.toLowerCase()) ?? [])];
}

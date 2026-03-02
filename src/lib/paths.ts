export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function apiPath(route: string): string {
  return `${BASE_PATH}${route}`;
}

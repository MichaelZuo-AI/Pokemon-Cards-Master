export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function apiPath(route: string): string {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  return `${BASE_PATH}${normalized}`;
}

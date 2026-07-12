/// <mls fileReference="_102029_/l2/clientBoundarySources.ts" enhancement="_blank"/>

/**
 * The only L4 sources whose values cross the browser/BFF boundary.
 * Keep backend validation and frontend contract generation aligned by importing this module.
 */
export const CLIENT_BOUNDARY_SOURCES = ['userInput', 'selectedEntity', 'routeParam'] as const;

export type ClientBoundarySource = typeof CLIENT_BOUNDARY_SOURCES[number];
export type ClientInputPresentation = 'form' | 'selection' | 'route';

export function isClientBoundarySource(source: unknown): source is ClientBoundarySource {
  return typeof source === 'string' && (CLIENT_BOUNDARY_SOURCES as readonly string[]).includes(source);
}

export function clientInputPresentation(source: unknown): ClientInputPresentation | null {
  if (source === 'userInput') return 'form';
  if (source === 'selectedEntity') return 'selection';
  if (source === 'routeParam') return 'route';
  return null;
}

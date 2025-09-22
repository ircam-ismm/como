export const EOL = navigator.userAgent.indexOf('Windows') !== -1 ? '\r\n' : '\n';

/**
 * return `web-${nodeId}` or `id` as given in url query parameters
 * @param {*} nodeId
 */
export function getId(nodeId) {
  const queryParams = new URLSearchParams(window.location.search);
  return queryParams.has('id') ? queryParams.get('id') : `web-${nodeId}`;
}

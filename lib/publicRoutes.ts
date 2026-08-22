export function isPrivacyPath(pathname: string) {
  return pathname === "/privacy" || pathname === "/privacy/";
}

export function isPublicIndexPath(pathname: string) {
  return pathname === "/" || isPrivacyPath(pathname);
}

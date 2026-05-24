// Hook: guard admin notification spam
// Export shouldNotify(convo, notifiedRef, toastRef)

export function shouldNotify(convo, notifiedRef, toastRef) {
  const now = Date.now();
  // debounce per convo 500ms
  const last = toastRef.current?.[convo.id] || 0;
  if (now - last < 500) return false;
  // check unread count change
  const prev = notifiedRef.current?.[convo.id] || 0;
  if (convo.unread <= prev) return false;
  // update refs
  if (!toastRef.current) toastRef.current = {};
  toastRef.current[convo.id] = now;
  if (!notifiedRef.current) notifiedRef.current = {};
  notifiedRef.current[convo.id] = convo.unread;
  return true;
}

/** Tells the header to refresh its Inbox count after a request is accepted, declined or sent. */
const EVENT = "inbox-changed";

export function notifyInboxChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export function onInboxChanged(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

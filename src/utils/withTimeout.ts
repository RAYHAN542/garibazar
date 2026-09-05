/**
 * 🔧 Fixes: Firestore query hanging forever with no timeout.
 *
 * Firestore's getDocs() has no built-in timeout -- if the WebView/network
 * never resolves or rejects the request (flaky mobile data, a dropped
 * connection, a misbehaving WebView), the awaiting code just hangs
 * indefinitely and the UI is stuck on a loading skeleton forever with no
 * way for the user to know something went wrong or to retry.
 *
 * Wrap any promise with a hard deadline: if it doesn't settle in time,
 * we reject with a clear, recognizable error instead of hanging silently.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`[${label}] timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label, ms));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

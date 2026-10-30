import { useEffect, useState } from "react";
import { useVoidStore } from "@/lib/void-store";

export function useHydrated() {
  const [ready, setReady] = useState(() => useVoidStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useVoidStore.persist.onFinishHydration(() => setReady(true));
    if (useVoidStore.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);

  return ready;
}

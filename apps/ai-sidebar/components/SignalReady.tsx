"use client";

import { useEffect } from "react";
import { signal } from "@crystallize/app-signal";

export function SignalReady() {
  useEffect(() => {
    // Signal that the app is ready
    signal.send("ready").catch(console.error);
  }, []);

  return null;
}

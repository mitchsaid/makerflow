"use client";

import { useEffect } from "react";
import { listenForInstallOffer } from "@/components/install-store";

/** Keeps the browser's offer to install the app, for the "Install MakerFlow" row on the More tab. Renders nothing. */
export function InstallListener() {
  useEffect(() => listenForInstallOffer(), []);
  return null;
}

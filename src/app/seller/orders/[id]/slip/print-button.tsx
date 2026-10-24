"use client";

import { Btn } from "../../../ui";

// The one client island on the packing slip — everything else is a
// server render so the printed sheet needs zero hydration.
export default function PrintButton() {
  return <Btn onClick={() => window.print()}>Print</Btn>;
}

"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────
// Serviceable-location dropdown backing (mission X2).
//
// Every active ServiceLocation row from /api/catalog/locations
// becomes a <datalist> option attached to the storefront pincode
// inputs (nurseries search, checkout address, sell application).
//
// The option VALUE is the bare pincode and the city/state ride as
// the label — picking a suggestion fills the input with exactly
// what the 6-digit validators expect, never the label text. An
// empty list renders an empty datalist: inputs stay free-text,
// exactly as before. One fetch per page, cached per module mount.
// ─────────────────────────────────────────────────────────────

export const LOCATION_LIST_ID = "tv-location-options";

export type ServiceLocationLite = { pincode: string; city: string; state: string };

export function useServiceLocations(): ServiceLocationLite[] {
  const [locs, setLocs] = useState<ServiceLocationLite[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/catalog/locations")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (alive && data && Array.isArray(data.locations)) {
          setLocs(
            data.locations.filter(
              (l: unknown): l is ServiceLocationLite =>
                !!l && typeof l === "object" && typeof (l as ServiceLocationLite).pincode === "string",
            ),
          );
        }
      })
      .catch(() => {
        // dropdown suggestions are a nicety — never break the input
      });
    return () => {
      alive = false;
    };
  }, []);
  return locs;
}

export function LocationDatalist() {
  const locs = useServiceLocations();
  return (
    <datalist id={LOCATION_LIST_ID}>
      {locs.map((l) => (
        <option key={l.pincode} value={l.pincode}>
          {`${l.city}${l.state ? `, ${l.state}` : ""} — ${l.pincode}`}
        </option>
      ))}
    </datalist>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function mapRowToUiProperty(row) {
  // Keep a stable "UI property" shape for the rest of Home.js
  const rent = Number(row.rent || 0);
  return {
    id: row.id,
    user_id: row.user_id,

    // PropVault-ish aliases (so the UI doesn't explode)
    name: row.title || "",
    title: row.title || "",
    address: row.address || "",
    type: row.type || "",
    status: row.status || "",
    rent,
    image_url: row.image_url || "",

    // Optional UI-only fields (not stored unless you extend DB later)
    city: "",
    state: "",
    pin: "",
    yearOfPurchase: "",
    purchasePrice: 0,
    currentValue: 0,

    // Derived toggles for existing UI sections
    hasLoan: false,
    emiDetails: null,
    onRent: rent > 0,
    rentalDetails:
      rent > 0
        ? {
            tenantName: "",
            monthlyRent: rent,
            collectionDay: 1,
            leaseStart: "",
            leaseEnd: "",
            securityDeposit: 0,
            receivedByMonth: {},
          }
        : null,

    documents: [],
    rentalHistory: [],
  };
}

export function useProperties() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [properties, setProperties] = useState([]);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userData?.user?.id;
      if (!userId) {
        setProperties([]);
        return;
      }

      const { data, error: qErr } = await supabase
        .from("properties")
        .select("id,user_id,title,address,type,status,rent,image_url,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;

      setProperties((data || []).map(mapRowToUiProperty));
    } catch (e) {
      setError(e?.message || "Failed to load properties");
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const insertProperty = useCallback(
    async (payload) => {
      setError("");
      setSaving(true);
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const userId = userData?.user?.id;
        if (!userId) throw new Error("Not signed in");

        const row = {
          user_id: userId,
          title: payload.title,
          address: payload.address,
          type: payload.type,
          status: payload.status,
          rent: Number(payload.rent || 0),
          image_url: payload.image_url || null,
        };

        const { data: inserted, error: insErr } = await supabase
          .from("properties")
          .insert([row])
          .select("id")
          .single();
        if (insErr) throw insErr;

        await refresh();
        return { ok: true, data: inserted };
      } catch (e) {
        const msg = e?.message || "Failed to save property";
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  const deleteProperty = useCallback(
    async (id) => {
      setError("");
      setSaving(true);
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const userId = userData?.user?.id;
        if (!userId) throw new Error("Not signed in");

        const { error: delErr } = await supabase
          .from("properties")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (delErr) throw delErr;

        await refresh();
        return { ok: true };
      } catch (e) {
        const msg = e?.message || "Failed to delete property";
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  const busy = useMemo(() => loading || saving, [loading, saving]);

  return {
    properties,
    loading,
    saving,
    busy,
    error,
    refresh,
    insertProperty,
    deleteProperty,
  };



return error ? { ok: false } : { ok: true, data };
}
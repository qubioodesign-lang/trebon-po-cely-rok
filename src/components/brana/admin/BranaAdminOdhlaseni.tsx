"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { odhlasitAdmin } from "@/app/admin/actions";

/**
 * Odhlášení z administrace BRÁNY.
 * Maže stejnou session cookie jako administrace Třeboně.
 */
export function BranaAdminOdhlaseni() {
  const router = useRouter();
  const [probiha, setProbiha] = useState(false);

  const handleOdhlaseni = async () => {
    setProbiha(true);
    try {
      await odhlasitAdmin();
      router.refresh();
    } finally {
      setProbiha(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleOdhlaseni}
      disabled={probiha}
      className="odkaz-jemny text-sm"
    >
      odhlásit se
    </button>
  );
}

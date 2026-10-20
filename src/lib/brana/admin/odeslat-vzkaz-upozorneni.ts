import "server-only";

import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
import { odeslatBranaWebPush } from "@/lib/brana/admin/odeslat-brana-web-push";
import {
  nacistUpozorneniNastaveniProScheduler,
  validovatPushSubscriptionVstup,
} from "@/lib/brana/admin/upozorneni-uloziste";
import {
  BRANA_VZKAZ_UPOZORNENI_PAYLOAD,
  odeslatUpozorneniNaNovyVzkazS,
  type BranaVzkazPushVysledek,
} from "@/lib/brana/vzkaz/upozorneni-po-ulozeni";

/**
 * Po úspěšně uloženém vzkazu: jeden Web Push na existující subscription.
 * Nemění razítka skenů, subscription ani uložený vzkaz.
 */
export async function odeslatUpozorneniNaNovyVzkaz(): Promise<BranaVzkazPushVysledek> {
  return odeslatUpozorneniNaNovyVzkazS({
    maKonfiguraci: maBranaAdminBlobKonfiguraci,
    nacist: nacistUpozorneniNastaveniProScheduler,
    validovat: validovatPushSubscriptionVstup,
    odeslat: (subscription, payload) =>
      odeslatBranaWebPush(subscription, payload, "brana-vzkaz-push"),
  });
}

export { BRANA_VZKAZ_UPOZORNENI_PAYLOAD };

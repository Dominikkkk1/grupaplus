import { createClient } from "@/lib/supabase/server";
import { CarrierSettingsClient, type CarrierSetting } from "@/components/orders/carrier-settings-client";

export const dynamic = "force-dynamic";

export default async function CarrierSettingsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("carrier_settings")
    .select("carrier, pickup_time, notes");

  return <CarrierSettingsClient settings={(data ?? []) as unknown as CarrierSetting[]} />;
}

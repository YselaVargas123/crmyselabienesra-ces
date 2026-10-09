import { supabase } from "./supabase";
import { setUmbrales, type Umbrales } from "./format";

/** Lee los umbrales guardados. Si no existen (o falla), se usan los valores por defecto. */
export async function cargarUmbrales(): Promise<void> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "umbrales").maybeSingle();
  const v = data?.value as Partial<Umbrales> | undefined;
  if (v && Number.isFinite(v.riesgo) && Number.isFinite(v.estancada)) setUmbrales({ riesgo: Number(v.riesgo), estancada: Number(v.estancada) });
}
export async function guardarUmbrales(u: Umbrales): Promise<boolean> {
  const { error } = await supabase.from("app_settings").upsert({ key: "umbrales", value: u }, { onConflict: "key" });
  if (error) return false;
  setUmbrales(u);
  return true;
}

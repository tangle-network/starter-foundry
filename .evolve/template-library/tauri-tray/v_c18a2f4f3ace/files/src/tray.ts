import { invoke } from "@tauri-apps/api/core";

export async function syncNow(): Promise<void> {
  await invoke<void>("sync_now");
}

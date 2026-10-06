import { MockAdapter } from "./mock"
import { ZkAdapter } from "./zk"
import type { DeviceAdapter, DeviceRow } from "./types"

export function adapterFor(device: DeviceRow): DeviceAdapter {
  return device.mode === "PULL" ? new ZkAdapter(device) : new MockAdapter(device)
}

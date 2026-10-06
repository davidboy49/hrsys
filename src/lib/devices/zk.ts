import type { DeviceAdapter, DeviceRow, RawPunch } from "./types"

/**
 * Real ZKTeco connection (pull mode, TCP port 4370).
 *
 * Not enabled yet. To switch it on later:
 *   1. npm i node-zklib
 *   2. implement the two methods below with `new ZKLib(ip, port, 10000, 4000)`:
 *        createSocket() -> getInfo() / getAttendances() -> disconnect()
 *      and map each record { deviceUserId, recordTime } to a RawPunch.
 *   3. set the device mode to PULL on the Attendance screen.
 * Vercel cannot reach devices on a private LAN. For that use PUSH mode (the device posts to
 * /iclock/cdata, already implemented) or run a small sync agent on the local network.
 */
export class ZkAdapter implements DeviceAdapter {
  constructor(private device: DeviceRow) {}

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: `Pull mode is not enabled in this build (${this.device.ip}:${this.device.port}). Use Mock or Push.` }
  }

  async fetchPunches(_since: Date | null): Promise<RawPunch[]> {
    void _since
    throw new Error("Pull mode is not enabled in this build. Use Mock or Push.")
  }
}

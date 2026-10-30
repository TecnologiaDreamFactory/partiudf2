import { Injectable } from '@nestjs/common';

export interface LastLocation {
  lat: number;
  lng: number;
  ts: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
}

@Injectable()
export class RealtimeStateService {
  private readonly lastLocationByTrip = new Map<string, LastLocation>();

  setLastLocation(tripId: string, data: LastLocation): void {
    this.lastLocationByTrip.set(tripId, data);
  }

  getLastLocation(tripId: string): LastLocation | undefined {
    return this.lastLocationByTrip.get(tripId);
  }

  clearLastLocation(tripId: string): void {
    this.lastLocationByTrip.delete(tripId);
  }
}

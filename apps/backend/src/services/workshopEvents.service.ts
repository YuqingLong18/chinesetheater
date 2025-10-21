import type { Response } from 'express';

type WorkshopEvent = {
  type: string;
  payload: unknown;
};

type Subscriber = {
  res: Response;
  heartbeat: NodeJS.Timeout;
};

class WorkshopEventBus {
  private rooms = new Map<number, Set<Subscriber>>();

  subscribe(roomId: number, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const subscriber: Subscriber = {
      res,
      heartbeat: setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch (error) {
          this.unsubscribe(roomId, subscriber);
        }
      }, 25000)
    };

    const set = this.rooms.get(roomId) ?? new Set<Subscriber>();
    set.add(subscriber);
    this.rooms.set(roomId, set);

    res.on('close', () => this.unsubscribe(roomId, subscriber));
    res.on('error', () => this.unsubscribe(roomId, subscriber));

    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ roomId })}\n\n`);
  }

  emit(roomId: number, event: WorkshopEvent) {
    const subscribers = this.rooms.get(roomId);
    if (!subscribers) {
      return;
    }
    const payload = `event: ${event.type}\n` + `data: ${JSON.stringify(event.payload)}\n\n`;
    for (const subscriber of subscribers) {
      try {
        subscriber.res.write(payload);
      } catch (error) {
        this.unsubscribe(roomId, subscriber);
      }
    }
  }

  private unsubscribe(roomId: number, subscriber: Subscriber) {
    const set = this.rooms.get(roomId);
    if (!set) {
      return;
    }
    clearInterval(subscriber.heartbeat);
    set.delete(subscriber);
    try {
      subscriber.res.end();
    } catch (error) {
      // ignore
    }
    if (set.size === 0) {
      this.rooms.delete(roomId);
    }
  }
}

export const workshopEvents = new WorkshopEventBus();

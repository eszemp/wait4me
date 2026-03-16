import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';

@Component({
  selector: 'app-driver-interface',
  imports: [CommonModule],
  templateUrl: './driver-interface.html',
  styleUrl: './driver-interface.css',
})
export class DriverInterface {
  private readonly destroyRef = inject(DestroyRef);

  readonly currentTime = signal(new Date());

  constructor() {
    const timer = window.setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
    });
  }
}

export class Duration {
  public hours: number;
  public minutes: number;
  public seconds: number;
  public totalMinutes: number;
  public totalSeconds: number;
  public durationText: string;

  private constructor(hours: number, minutes: number, seconds: number) {
    this.hours = hours;
    this.minutes = minutes;
    this.seconds = seconds;
    this.totalMinutes = hours * 60 + minutes;
    this.totalSeconds = hours * 3600 + minutes * 60 + seconds;
    this.durationText = this.asOjpDurationText();
  }

  public static initWithDurationSchema(durationS: string | undefined): Duration {
    if (durationS === undefined) {
      return new Duration(0, 0, 0);
    }
    const hoursMatches = durationS.match(/(\d+)H/);
    const minutesMatches = durationS.match(/(\d+)M/);
    const secondsMatches = durationS.match(/(\d+)S/);

    const hours = hoursMatches ? parseInt(hoursMatches[1], 10) : 0;
    const minutes = minutesMatches ? parseInt(minutesMatches[1], 10) : 0;
    const seconds = secondsMatches ? parseInt(secondsMatches[1], 10) : 0;

    return new Duration(hours, minutes, seconds);
  }


  public asOjpDurationText(): string {
    let text = 'PT';
    if (this.hours > 0) text += `${this.hours}H`;
    if (this.minutes > 0 || (this.hours === 0 && this.seconds === 0)) text += `${this.minutes}M`;
    if (this.seconds > 0) text += `${this.seconds}S`;
    return text;
  }

  public static initFromTotalSeconds(totalSeconds: number): Duration {
    const hours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return new Duration(hours, minutes, seconds);
  }

  public plus(otherDuration: Duration): Duration {
    return Duration.initFromTotalSeconds(this.totalSeconds + otherDuration.totalSeconds);
  }

  public format(): string {
    if (this.seconds >= 30){ // round up
      return String(this.totalMinutes + 1);
    }
    else { // round down
      return String(this.totalMinutes);
    }
  }

  public formatWithMinH(): string {
    const parts: string[] = [];
    if (this.hours > 0) parts.push(`${this.hours} h`);
    if (this.minutes > 0) {
      if (this.seconds >= 30){ // round up
        parts.push(`${this.minutes + 1} min`);
      }
      else { // round down
        parts.push(`${this.minutes} min`);
      }
    }
    return parts.join(' ');
  }

  public addToDate(timestamp: Date): Date {
    return new Date(timestamp.getTime() + this.totalSeconds * 1000);
  }

  public subtractFromDate(timestamp: Date): Date {
    return new Date(timestamp.getTime() - this.totalSeconds * 1000);
  }

  public isBiggerThanZero(): boolean {
    return this.totalSeconds >= 30;
  }

}

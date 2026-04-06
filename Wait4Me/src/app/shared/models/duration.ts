export class Duration {
  public hours: number;
  public minutes: number;
  public totalMinutes: number;
  public durationText: string;

  private constructor(hours: number, minutes: number) {
    this.hours = hours;
    this.minutes = minutes;
    this.totalMinutes = hours * 60 + minutes;
    this.durationText = this.asOjpDurationText();
  }

  public static initWithDurationSchema(durationS: string | undefined): Duration {
    if (durationS === undefined) {
      return new Duration(0,0);
    }

    // PT4H19M
    durationS = durationS.replace('PT', '');

    let hours = 0
    const hoursMatches = durationS.match(/([0-9]+?)H/);
    if (hoursMatches) {
      hours = parseInt(hoursMatches[1])
    }

    let minutes = 0
    const minutesMatches = durationS.match(/([0-9]+?)M/);
    if (minutesMatches) {
      minutes = parseInt(minutesMatches[1])
    }

    const duration = new Duration(hours, minutes);
    return duration;
  }

  public asOjpDurationText(): string {
    const parts: string[] = [];

    parts.push('PT');
    if (this.hours > 0) {
      parts.push('' + this.hours + 'H');
    }
    parts.push('' + this.minutes + 'M');

    return parts.join('');
  }

  public static initFromTotalMinutes(totalMinutes: number): Duration {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes - hours * 60;

    const duration = new Duration(hours, minutes);
    return duration;
  }

  public plus(otherDuration: Duration): Duration {
    return Duration.initFromTotalMinutes(this.totalMinutes + otherDuration.totalMinutes)
  }

  public format(): string {
    return String(this.totalMinutes);
  }

  public formatWithMinH(): string {
    const durationParts: string[] = [];
  
    if (this.hours > 0) {
      durationParts.push(this.hours + ' h ');
    }

    durationParts.push(this.minutes + ' min');

    const durationS = durationParts.join('');

    return durationS;
  }

  public addToDate(timestamp: Date): Date {
    // TODO: make more exact then minutes
    const newDate = new Date(timestamp.getTime());
    newDate.setMinutes(newDate.getMinutes() + this.totalMinutes);
    return newDate;
  }

  public subtractFromDate(timestamp: Date): Date {
    const newDate = new Date(timestamp.getTime());
    newDate.setMinutes(newDate.getMinutes() - this.totalMinutes);
    return newDate;
  }

  public isBiggerThanZero(): Boolean {
    return (this.totalMinutes > 0);
  }
}
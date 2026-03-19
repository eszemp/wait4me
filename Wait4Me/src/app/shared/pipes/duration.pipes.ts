import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  standalone: true
})
export class DurationPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    
    // Match hours and minutes
    const matches = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!matches) return value;

    const hours = matches[1] || '0';
    const mins = matches[2] || '00';

    return `${hours}:${mins.padStart(2, '0')} h`;
  }
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import timezones from '@/lib/timezones';
import { format } from 'date-fns';

export default function MeetingFormDateTime({
  formData,
  onDateChange,
  hour,
  minute,
  ampm,
  setAmPm,
  timePopoverOpen,
  setTimePopoverOpen,
  timezone,
  setTimezone,
  handleTimeBoxChange,
  handleTimeConfirm,
}: any) {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <label className="block mb-1 font-medium">Date *</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={
                'w-full justify-start text-left font-normal' +
                (formData.date ? '' : ' text-muted-foreground')
              }
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.date ? (
                format(formData.date, 'MMM,dd yyyy')
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.date}
              onSelect={onDateChange}
              captionLayout="dropdown"
              disabled={(date) => date < new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex-1">
        <label className="block mb-1 font-medium">Time *</label>
        <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={
                'w-full justify-start text-left font-normal' +
                (formData.time ? '' : ' text-muted-foreground')
              }
              type="button"
            >
              {formData.time ? formData.time : <span>Pick a time</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-84 p-4" align="end">
            <div className="mb-2 font-semibold text-start">Choose time</div>
            <div className="flex items-center justify-start gap-2 mb-3">
              <Input
                className="w-16 text-center text-sm font-normal"
                maxLength={2}
                value={hour}
                onChange={(e) =>
                  handleTimeBoxChange('hour', e.target.value.replace(/\D/g, ''))
                }
                placeholder="hh"
              />
              <span className="text-lg font-bold mb-1"> -- </span>
              <Input
                className="w-16 text-center text-sm font-normal"
                maxLength={2}
                value={minute}
                onChange={(e) =>
                  handleTimeBoxChange(
                    'minute',
                    e.target.value.replace(/\D/g, '')
                  )
                }
                placeholder="mm"
              />
              <div className="flex flex-row gap-1 ml-2">
                <Button
                  type="button"
                  size="sm"
                  variant={ampm === 'AM' ? 'default' : 'outline'}
                  className="px-3"
                  onClick={() => setAmPm('AM')}
                >
                  AM
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ampm === 'PM' ? 'default' : 'outline'}
                  className="px-3"
                  onClick={() => setAmPm('PM')}
                >
                  PM
                </Button>
              </div>
            </div>
            <div>
              <label className="block mb-1 font-medium">Timezone</label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz: string) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end mt-3">
              <Button
                type="button"
                size="sm"
                onClick={handleTimeConfirm}
                disabled={!hour || !minute}
              >
                Set Time
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

export default function MeetingFormInvite({
  inviteMethod,
  setInviteMethod,
  INVITE_METHODS,
  inviteInput,
  onInviteInputChange,
  onInviteInputKeyDown,
  invitees,
  removeInvitee,
  onAddInvitee,
}: any) {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-3/4">
        <label className="block mb-1 font-medium">
          {inviteMethod === 'email'
            ? 'Invite via Email'
            : 'Invite via Whatsapp'}
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {invitees.map((item: string, idx: number) => (
            <Badge
              key={item + idx}
              variant="light"
              className="rounded-full px-3 py-1 text-xs flex items-center gap-1"
            >
              {item}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="ml-1 p-0 h-4 w-4"
                onClick={() => removeInvitee(item)}
                aria-label="Remove"
              >
                ×
              </Button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            value={inviteInput}
            onChange={onInviteInputChange}
            onKeyDown={onInviteInputKeyDown}
            placeholder={
              inviteMethod === 'email'
                ? 'Enter email and press Enter or Add'
                : 'Enter WhatsApp number'
            }
            className="flex-1"
          />
          {onAddInvitee && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddInvitee}
              disabled={!inviteInput || !inviteInput.trim()}
              className="h-9 px-3 text-xs shrink-0"
            >
              Add
            </Button>
          )}
        </div>
      </div>
      <div className="w-1/3">
        <label className="block mb-1 font-medium">Method</label>
        <Select value={inviteMethod} onValueChange={setInviteMethod}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent align="end">
            {INVITE_METHODS.map((method: any) => (
              <SelectItem
                key={method.value}
                value={method.value}
                disabled={method.disabled}
              >
                {method.label}
                {method.disabled && (
                  <Badge className="ml-2" variant="secondary">
                    Coming soon
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

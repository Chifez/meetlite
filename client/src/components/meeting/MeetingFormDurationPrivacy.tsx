import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

export default function MeetingFormDurationPrivacy({
  formData,
  onInputChange,
  onPrivacyChange,
}: any) {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <label className="block mb-1 font-medium">Duration (minutes)</label>
        <Input
          name="duration"
          type="number"
          min={1}
          value={formData.duration}
          onChange={onInputChange}
        />
      </div>
      <div className="flex-1">
        <label className="block mb-1 font-medium">Privacy</label>
        <Select value={formData.privacy} onValueChange={onPrivacyChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select privacy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

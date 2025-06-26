import { Input } from '@/components/ui/input';

export default function MeetingFormTitle({
  formData,
  onInputChange,
}: {
  formData: any;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <div>
        <label className="block mb-1 font-medium">Title *</label>
        <Input
          name="title"
          value={formData.title}
          onChange={onInputChange}
          required
        />
      </div>
      <div>
        <label className="block mb-1 font-medium">Description</label>
        <Input
          name="description"
          value={formData.description}
          onChange={onInputChange}
        />
      </div>
    </>
  );
}

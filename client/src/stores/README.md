# State Management with Zustand

This directory contains Zustand stores for managing application state and eliminating prop drilling.

## Stores Overview

### 1. `meetingsStore.ts` - Meetings State Management

Manages all meeting-related state and actions.

**State:**

- `meetings: Meeting[]` - List of meetings
- `loading: boolean` - Loading state for meetings
- `view: 'list' | 'calendar'` - Current view mode
- `deleteDialog` - Delete confirmation dialog state
- `showImportModal` - Import modal visibility
- `importLoading` - Import operation loading state
- `importedEvents` - Events imported from calendar
- `importError` - Import error message

**Actions:**

- `fetchMeetings(userId?)` - Fetch meetings with optional user filtering
- `createMeeting(meetingData)` - Create a new meeting
- `deleteMeeting(meetingId)` - Delete a meeting
- `startMeeting(meetingId)` - Start a meeting
- `completeMeeting(meetingId)` - Complete a meeting
- `importCalendarEvents(type, startDate, endDate)` - Import calendar events
- Modal actions: `openDeleteDialog`, `closeDeleteDialog`, `setShowImportModal`

**Usage:**

```typescript
import { useMeetingsStore } from '@/stores/meetingsStore';

const { meetings, loading, fetchMeetings, deleteMeeting } = useMeetingsStore();
```

### 2. `formStore.ts` - Meeting Form State Management

Manages meeting form state and submission.

**State:**

- `formData: MeetingFormData` - Form data object
- `loading: boolean` - Form submission loading state
- `showScheduleModal: boolean` - Schedule modal visibility

**Actions:**

- Form handlers: `handleInputChange`, `handleDateChange`, `handleTimeChange`, etc.
- Modal actions: `openScheduleModal`, `closeScheduleModal`
- `handleSubmit(onSuccess?)` - Submit form and create meeting

**Usage:**

```typescript
import { useFormStore } from '@/stores/formStore';

const { formData, loading, handleInputChange, handleSubmit } = useFormStore();
```

### 3. `uiStore.ts` - UI State Management

Manages UI-related state like modals, notifications, and theme.

**State:**

- `scheduleModal` - Schedule modal state
- `globalLoading` - Global loading indicator
- `notifications` - Array of notifications
- `theme` - Current theme
- `sidebarOpen` - Sidebar visibility

**Actions:**

- Modal actions: `openScheduleModal`, `closeScheduleModal`
- Notification actions: `addNotification`, `removeNotification`, `clearNotifications`
- Theme actions: `setTheme`, `toggleSidebar`

**Usage:**

```typescript
import { useUIStore } from '@/stores/uiStore';

const { openScheduleModal, addNotification, theme } = useUIStore();
```

## Migration Guide

### Before (Prop Drilling):

```typescript
// Parent component
const [meetings, setMeetings] = useState([]);
const [loading, setLoading] = useState(false);

// Pass down through multiple levels
<MeetingList
  meetings={meetings}
  loading={loading}
  onDelete={handleDelete}
  onStart={handleStart}
/>;
```

### After (Zustand):

```typescript
// Any component can access state directly
const { meetings, loading, deleteMeeting, startMeeting } = useMeetingsStore();

// No props needed
<MeetingList />;
```

## Best Practices

1. **Selective State Access**: Only subscribe to the state you need to prevent unnecessary re-renders.

   ```typescript
   // Good - only subscribes to meetings
   const meetings = useMeetingsStore((state) => state.meetings);

   // Avoid - subscribes to entire store
   const store = useMeetingsStore();
   ```

2. **Action Composition**: Combine multiple actions when needed.

   ```typescript
   const handleMeetingAction = async (meetingId: string) => {
     const { startMeeting, setGlobalLoading } = useMeetingsStore.getState();
     setGlobalLoading(true);
     await startMeeting(meetingId);
     setGlobalLoading(false);
   };
   ```

3. **Error Handling**: Handle errors in the store actions and show appropriate notifications.
   ```typescript
   try {
     await deleteMeeting(meetingId);
     useUIStore.getState().addNotification({
       type: 'success',
       message: 'Meeting deleted successfully',
     });
   } catch (error) {
     useUIStore.getState().addNotification({
       type: 'error',
       message: 'Failed to delete meeting',
     });
   }
   ```

## Integration with Existing Code

1. **Replace useState/useEffect**: Replace local state with store state
2. **Remove Props**: Remove props that are now managed by stores
3. **Update Components**: Update components to use store hooks
4. **Test Thoroughly**: Ensure all functionality works as expected

## Benefits

- **No Prop Drilling**: State is accessible anywhere in the component tree
- **Better Performance**: Components only re-render when their specific state changes
- **Easier Testing**: State logic is centralized and easier to test
- **Better Developer Experience**: Less boilerplate code and clearer data flow

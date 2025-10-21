# Permission Fix - View-Only Mode Updates

## Problem

When the presenter changed permissions to "view-only", remote users could not see updates from the presenter. The code would not update on their screens even though the presenter could type.

## Root Cause

The YJS binding in `code-editor.tsx` was being **destroyed** when `readOnly={true}`:

```typescript
// BEFORE - BROKEN
useEffect(() => {
  if (!yText || readOnly) {
    // ❌ Destroyed binding in read-only mode
    bindingRef.current = null;
    return;
  }
  // ... create binding
}, [yText, readOnly]);
```

This meant:

1. When user loses edit permission → `readOnly` becomes `true`
2. YJS binding is destroyed
3. **YJS observer is removed** - no longer listening to remote updates
4. Remote updates arrive via YJS protocol but don't trigger UI updates
5. User sees frozen/stale content

## Solution

**Keep the YJS observer active even in read-only mode**, but block local changes:

### Changes Made

**1. `code-editor.tsx`** - Keep binding alive in read-only mode:

```typescript
// AFTER - FIXED
useEffect(() => {
  if (!yText) {
    // ✓ Only check yText, not readOnly
    bindingRef.current = null;
    return;
  }

  // Create binding even in read-only mode to receive remote updates
  const binding = createEditorBinding(
    yText,
    () => localValue,
    (newValue) => setLocalValue(newValue),
    () => document.getElementById('code-editor-textarea'),
    readOnly // ✓ Pass readOnly flag to binding
  );
  // ...
}, [yText, readOnly]);
```

**2. `react-simple-code-editor-binding.ts`** - Support read-only mode:

```typescript
export function createEditorBinding(
  yText: Y.Text,
  getValue: () => string,
  onLocalChange: (value: string) => void,
  getTextarea: () => HTMLTextAreaElement | null,
  readOnly: boolean = false // ✓ New parameter
): EditorBinding {
  // YJS observer - ALWAYS active, even in read-only
  const yTextObserver = (event: Y.YTextEvent) => {
    // ... update UI with remote changes
    const newValue = yText.toString();
    isUpdating = true;
    onLocalChange(newValue); // ✓ Updates UI
    isUpdating = false;
  };

  yText.observe(yTextObserver); // ✓ Always observe

  // Local changes handler
  const handleLocalChange = (newValue: string) => {
    if (readOnly) {
      // ✓ Block local changes if read-only
      console.log('Blocked local change - read-only mode');
      return;
    }
    // ... apply local changes to YJS
  };
}
```

**3. `code-editor.tsx`** - Block changes at handler level too:

```typescript
const handleChange = (newValue: string) => {
  // Don't allow changes if read-only
  if (readOnly) {
    // ✓ Double protection
    return;
  }

  if (bindingRef.current) {
    bindingRef.current.onLocalChange(newValue);
  }
};
```

## Flow Diagrams

### Before (Broken)

```
Presenter Types → YJS Update → Server → Remote User
                                              ↓
                                    readOnly=true triggered
                                              ↓
                                    Binding DESTROYED ❌
                                              ↓
                                    YJS observer REMOVED
                                              ↓
                               Updates arrive but not applied
                                              ↓
                                    UI frozen/stale
```

### After (Fixed)

```
Presenter Types → YJS Update → Server → Remote User
                                              ↓
                                    readOnly=true triggered
                                              ↓
                                    Binding KEPT ALIVE ✓
                                              ↓
                                    YJS observer ACTIVE
                                              ↓
                               Updates applied to UI ✓
                                              ↓
                                    UI updates in real-time
                                    (but user cannot type)
```

## Key Insights

1. **Observer vs Editor**:

   - Observer (YJS listener) = receives updates
   - Editor (user input) = sends updates
   - Read-only should disable editor, NOT observer

2. **Two-way binding components**:

   - Must separate "receive updates" from "send updates"
   - Read-only affects sending, not receiving

3. **React useEffect cleanup**:
   - Returning cleanup function removes listeners
   - Need to be careful what triggers cleanup

## Testing

✅ **Test Case 1**: Presenter types, viewer sees updates

- Presenter: Edit permission
- Viewer: View-only permission
- Presenter types → Viewer sees changes ✓

✅ **Test Case 2**: Permission change mid-session

- Both users start with edit permission
- Both can type
- Presenter changes to view-only
- Viewer loses ability to type ✓
- Presenter continues typing → Viewer sees updates ✓

✅ **Test Case 3**: Multiple viewers

- 1 Presenter (edit)
- 2+ Viewers (view-only)
- Presenter types → All viewers see updates ✓

## Files Modified

- `client/src/components/room/collaboration/code-editor.tsx`
- `client/src/lib/yjs/bindings/react-simple-code-editor-binding.ts`

## Benefits

1. ✓ View-only users now see real-time updates
2. ✓ View-only users cannot edit (enforced at multiple levels)
3. ✓ Smooth permission transitions
4. ✓ No UI freezing or stale content

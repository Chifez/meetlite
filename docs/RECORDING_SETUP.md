# Recording Setup Guide

This document covers the setup and configuration required for the MeetLite recording functionality.

## Overview

MeetLite's recording system captures meeting audio/video using Mediasoup's PlainTransport and FFmpeg, stores recordings in Cloudflare R2, and provides AI-powered transcription and summarization.

## Architecture

```
Meeting Room --> Mediasoup Service --> FFmpeg --> Local Storage --> R2 Upload --> AI Processing
                  (Audio/Video)      (Encoding)    (Temp Files)    (Permanent)   (Transcript/Summary)
```

## System Requirements

### FFmpeg Installation

FFmpeg is required for video encoding, audio extraction, and thumbnail generation.

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
```

#### Linux (CentOS/RHEL)

```bash
sudo yum install epel-release
sudo yum install ffmpeg ffmpeg-devel
```

#### macOS

```bash
brew install ffmpeg
```

#### Windows

1. Download FFmpeg from https://ffmpeg.org/download.html
2. Extract to a directory (e.g., `C:\ffmpeg`)
3. Add `C:\ffmpeg\bin` to your system PATH

#### Verify Installation

```bash
ffmpeg -version
```

You should see output showing FFmpeg version and configuration.

## Environment Variables

### Mediasoup Service

Add these to `backend/packages/mediasoup-service/.env`:

```bash
# Recording directory (optional - defaults to {cwd}/recordings)
RECORDINGS_DIR=/path/to/recordings

# Port for Mediasoup service
PORT=3001

# WebSocket origins (comma-separated)
WS_ORIGINS=http://localhost:5174,https://yourdomain.com
```

### Room Service (Cloudflare R2)

Add these to `backend/packages/room-service/.env`:

```bash
# Cloudflare R2 Configuration
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=meetlite-recordings
CLOUDFLARE_R2_SIGNED_URL_EXPIRY=3600

# R2 endpoint (auto-generated from account ID if not set)
# CLOUDFLARE_R2_ENDPOINTS=https://your-account-id.r2.cloudflarestorage.com
```

### Auth Service (for AI Processing)

Add these to `backend/packages/auth-service/.env`:

```bash
# OpenAI API Key (for transcription via Whisper and GPT summaries)
OPENAI_API_KEY=sk-your-api-key

# Optional: Google Speech-to-Text (alternative transcription provider)
GOOGLE_SPEECH_CREDENTIALS=/path/to/credentials.json
```

## Cloudflare R2 Bucket Setup

1. **Create a Cloudflare account** at https://dash.cloudflare.com

2. **Navigate to R2** in the dashboard

3. **Create a new bucket**:
   - Name: `meetlite-recordings`
   - Region: Choose closest to your users

4. **Create API Tokens**:
   - Go to R2 > Manage R2 API Tokens
   - Create a new token with "Object Read & Write" permissions
   - Save the Access Key ID and Secret Access Key

5. **Configure CORS** (if serving directly to browser):
   - Go to bucket settings
   - Add CORS rules for your domains

## Directory Setup

Ensure the recording directory exists and has proper permissions:

```bash
# Create recordings directory
mkdir -p backend/packages/mediasoup-service/recordings

# Set permissions (Linux/macOS)
chmod 755 backend/packages/mediasoup-service/recordings
```

## Testing Checklist

### Pre-Recording Tests

1. **Verify FFmpeg**:
   ```bash
   ffmpeg -version
   # Should output version info
   ```

2. **Verify R2 Connection**:
   ```bash
   # The room-service has a built-in check
   # Look for "R2 configuration valid" in startup logs
   ```

3. **Check Recording Directory**:
   ```bash
   # Verify directory exists and is writable
   ls -la backend/packages/mediasoup-service/recordings
   ```

### Recording Flow Tests

1. **Start a meeting**
2. **Click Record button** in meeting controls
3. **Verify recording indicator** appears
4. **Stop recording** after a few minutes
5. **Check local storage** for temp files
6. **Verify R2 upload** (check R2 dashboard)
7. **Test playback** from recordings page

### AI Processing Tests

1. **Upload a recording** or wait for auto-upload
2. **Click "Generate Transcript"** in recording details
3. **Verify transcript** is generated
4. **Click "Generate Summary"** 
5. **Verify summary** content quality

## Troubleshooting

### Recording Fails to Start

**Symptoms**: Recording button doesn't respond or shows error

**Solutions**:
1. Check mediasoup-service logs for errors
2. Verify FFmpeg is installed and in PATH
3. Check recording directory permissions
4. Ensure PlainTransport is correctly configured

### Upload to R2 Fails

**Symptoms**: Recording completes locally but doesn't appear in cloud

**Solutions**:
1. Verify R2 credentials are correct
2. Check network connectivity to Cloudflare
3. Look for R2-related errors in room-service logs
4. Verify bucket name matches configuration

### Transcription Fails

**Symptoms**: Transcript button shows "Failed" status

**Solutions**:
1. Verify OpenAI API key is valid
2. Check audio file format (should be extractable)
3. Look for AI service errors in logs
4. Ensure file size is under OpenAI's limits (25MB for Whisper)

### No Audio in Recording

**Symptoms**: Recording plays but no sound

**Solutions**:
1. Check audio track is being captured
2. Verify FFmpeg audio codec support
3. Check media track constraints in meeting

## Performance Considerations

### Storage

- Recordings are stored temporarily on local disk during capture
- Average storage: ~50MB per hour of 720p recording
- Clean up local files after successful R2 upload

### Processing

- FFmpeg uses significant CPU during encoding
- Consider separate worker for AI processing
- Limit concurrent recordings based on server capacity

### Costs

- Cloudflare R2: $0.015 per GB stored, no egress fees
- OpenAI Whisper: $0.006 per minute of audio
- GPT-4 Summaries: ~$0.01-0.10 per summary depending on length

## Security Notes

1. **API Keys**: Never commit API keys to version control
2. **Signed URLs**: Use short expiry times (default: 1 hour)
3. **Access Control**: Recordings inherit meeting permissions
4. **Encryption**: R2 encrypts data at rest by default



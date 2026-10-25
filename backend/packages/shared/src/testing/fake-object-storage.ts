export interface StoredObject {
  key: string;
  contentType: string;
  data: Buffer;
  tenantId?: string;
  size: number;
  uploadedAt: Date;
}

export interface ActiveMultipartUpload {
  uploadId: string;
  key: string;
  contentType: string;
  tenantId?: string;
  parts: Map<number, Buffer>;
  initiatedAt: Date;
}

/**
 * Deterministic Object Storage Fake (S3 / R2).
 * Operates in memory without hitting AWS or Cloudflare R2 endpoints.
 */
export class FakeObjectStorage {
  private objects = new Map<string, StoredObject>();
  private activeUploads = new Map<string, ActiveMultipartUpload>();
  private uploadCounter = 0;

  async putObject(key: string, data: Buffer, contentType = 'application/octet-stream', tenantId?: string): Promise<void> {
    this.objects.set(key, {
      key,
      contentType,
      data,
      tenantId,
      size: data.length,
      uploadedAt: new Date(),
    });
  }

  async getObject(key: string, requesterTenantId?: string): Promise<StoredObject | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    if (obj.tenantId && requesterTenantId && obj.tenantId !== requesterTenantId) {
      return null; // Deny cross-tenant access without revealing existence
    }
    return obj;
  }

  async deleteObject(key: string, requesterTenantId?: string): Promise<boolean> {
    const obj = this.objects.get(key);
    if (!obj) return false;
    if (obj.tenantId && requesterTenantId && obj.tenantId !== requesterTenantId) {
      return false;
    }
    return this.objects.delete(key);
  }

  async createMultipartUpload(key: string, contentType: string, tenantId?: string): Promise<{ uploadId: string; key: string }> {
    this.uploadCounter += 1;
    const uploadId = `mp_upload_${this.uploadCounter}`;
    this.activeUploads.set(uploadId, {
      uploadId,
      key,
      contentType,
      tenantId,
      parts: new Map(),
      initiatedAt: new Date(),
    });
    return { uploadId, key };
  }

  async uploadPart(uploadId: string, partNumber: number, data: Buffer): Promise<{ etag: string; partNumber: number }> {
    const upload = this.activeUploads.get(uploadId);
    if (!upload) {
      throw new Error(`Multipart upload ${uploadId} not found`);
    }
    if (partNumber < 1 || partNumber > 10000) {
      throw new Error(`Invalid part number: ${partNumber}`);
    }
    upload.parts.set(partNumber, data);
    return {
      etag: `etag_${uploadId}_${partNumber}`,
      partNumber,
    };
  }

  async completeMultipartUpload(
    uploadId: string,
    parts: { partNumber: number; etag?: string }[]
  ): Promise<StoredObject> {
    const upload = this.activeUploads.get(uploadId);
    if (!upload) {
      throw new Error(`Multipart upload ${uploadId} not found`);
    }

    // Verify all declared parts exist
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const buffers: Buffer[] = [];
    for (const p of sortedParts) {
      const partData = upload.parts.get(p.partNumber);
      if (!partData) {
        throw new Error(`Missing part ${p.partNumber} for upload ${uploadId}`);
      }
      buffers.push(partData);
    }

    const combined = Buffer.concat(buffers);
    const obj: StoredObject = {
      key: upload.key,
      contentType: upload.contentType,
      tenantId: upload.tenantId,
      data: combined,
      size: combined.length,
      uploadedAt: new Date(),
    };

    this.objects.set(upload.key, obj);
    this.activeUploads.delete(uploadId);
    return obj;
  }

  async abortMultipartUpload(uploadId: string): Promise<boolean> {
    const existed = this.activeUploads.has(uploadId);
    this.activeUploads.delete(uploadId);
    return existed;
  }

  hasObject(key: string): boolean {
    return this.objects.has(key);
  }

  getUpload(uploadId: string): ActiveMultipartUpload | undefined {
    return this.activeUploads.get(uploadId);
  }

  clear(): void {
    this.objects.clear();
    this.activeUploads.clear();
    this.uploadCounter = 0;
  }
}

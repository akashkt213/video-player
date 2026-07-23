import { query } from '../db.js';

export enum VideoStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export const videoModel = {
    async createVideoRecord(videoData: { title: string,status: VideoStatus }) {
        const result = await query(
          `INSERT INTO videos (title, status) VALUES ($1, $2) RETURNING *`,
          [videoData.title, videoData.status],
        );
        return result.rows[0];
      }
}
